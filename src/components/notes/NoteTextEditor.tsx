import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import LinkDialog from "@/components/notes/LinkDialog";
import NoteImageMenu from "@/components/notes/NoteImageMenu";
import NoteLinkMenu from "@/components/notes/NoteLinkMenu";
import NoteLinkPicker from "@/components/notes/NoteLinkPicker";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import VersionBand, { type VersionPreview } from "@/components/notes/VersionBand";
import EditorTourTip from "@/components/notes/EditorTourTip";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import TextFormatBar, { TEXT_FORMAT_BAR_HEIGHT } from "@/components/notes/TextFormatBar";
import type { InsertKind, TextFormatBarRef } from "@/components/notes/TextFormatBar";
import { takeDictateOnOpen } from "@/libs/launch";
import { takeFindOnOpen } from "@/libs/search/findOnOpen";
import { isTextNoteEmpty } from "@/utils/noteEmpty";
import { createTextFindTarget } from "@/libs/findTarget";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { noteTextLimit } from "@/libs/cloud";
import { EDITOR_SANITIZE_JS } from "@/generated/editor-sanitize";
import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { DURATION } from "@/constants/motion";
import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName, stripHtml } from "@/libs/ai";
import i18n from "@/libs/i18n";
import type {
  EditorImage,
  EditorLink,
  EditorLinkStart,
  EditorPicker,
  EditorState,
  FormatCommand,
  ImageChange,
  LineType,
  PickerKey,
} from "@/libs/richTextEditor";
import { normalizeLink } from "@/libs/links";
import { storeUnlockedNote } from "@/libs/registry";
import { pickNotes } from "@/libs/search/picker";
import { useRouter } from "@/hooks/useRouter";
import { useSecret } from "@/hooks/useSecret";
import { getNotesFilteredPerCategory } from "@/slicers/notesSlice";
import { reportPageError } from "@/libs/diagnostics";
import { PAGE_ERROR_MESSAGE, PAGE_ERROR_SCRIPT } from "@/libs/pageErrors";
import { printNote, setPrintable } from "@/libs/print";
import { reducePhoto } from "@/libs/reducePhoto";
import {
  COUNT_MESSAGE,
  formatCommand,
  IMAGE_FAILED_MESSAGE,
  IMAGE_IN_MESSAGE,
  IMAGE_MESSAGE,
  imageCommand,
  lineCommand,
  LINK_CANCEL_COMMAND,
  LINK_MESSAGE,
  LINK_START_COMMAND,
  LINK_START_MESSAGE,
  linkCommand,
  NOTE_LINK_MESSAGE,
  noteLinkCommand,
  PICK_START_COMMAND,
  PICKER_CLOSE_COMMAND,
  PICKER_KEY_MESSAGE,
  FIND_ESCAPE_MESSAGE,
  PICKER_MESSAGE,
  pickerShownCommand,
  RICH_TEXT_SCRIPT,
  RICH_TEXT_STYLE,
  RULE_COMMAND,
  STATE_MESSAGE,
  TOUCH_MESSAGE,
  UNLINK_COMMAND,
} from "@/libs/richTextEditor";
import {
  selectorAIAssistant,
  selectorDeveloperMode,
  selectorShowHidden,
  selectorVoiceRecognition,
  selectorWebhook_addTextNote,
} from "@/slicers/settingsSlice";
import type { Note, TextNote } from "@/types";
import { convertToMB, getTextLength, getTextSize, isStringEmpty } from "@/utils/string";
import { openUrl } from "@/utils/openUrl";
import { toast } from "@/utils/toast";
import { voiceTextToHtml } from "@/utils/voiceTranscript";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewInstance } from "react-native";
import { Animated, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MagnifyingGlassIcon from "react-native-heroicons/outline/MagnifyingGlassIcon";
import { KeyboardAvoidingView, KeyboardStickyView } from "react-native-keyboard-controller";
import { RichEditor } from "react-native-pell-rich-editor";
import { useSelector } from "react-redux";

interface Props {
  initialNote: TextNote;
  /** A kept version on screen (spec B.9): read only, no menu, nothing reaches the store. */
  preview?: VersionPreview;
}

// DOMPurify in the editor's page, before any note is loaded (LL-060). What guarantees it is `injectedJavaScript`: the
// script ends the web iframe's page, and Android evaluates it when the page finished, ahead of the onLoad that sets the
// note. `injectedJavaScriptBeforeContentLoaded` is only an earlier try (Android may run it before the page exists).
// `true;` ends what the phone's WebView evaluates.
// The page's own errors are forwarded first, so a failure of the sanitizer or of the page reaches Sentry (ADR-035).
const EDITOR_SANITIZE_SCRIPT = `${PAGE_ERROR_SCRIPT}\n${EDITOR_SANITIZE_JS}\ntrue;`;

// Run inside the editor's page (`command`, where `$` is its document) around a reload with another device's change:
// a focused editor's caret keeps its place in the text, shifted by what changed before it, instead of jumping to the
// start. The page handles messages in order, so the save sees the old content and the restore the new one.

// The content as text with a line break before each line (block) and for each <br>, so the end of a line and the start
// of the next are different positions; `points` maps positions back into the DOM.
const LINEAR_TEXT = `
  function linear(root) {
    var text = "", points = [], blocks = /^(DIV|P|LI|H[1-6]|PRE|BLOCKQUOTE|UL|OL)$/;
    (function walk(node) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) {
          points.push({ node: child, start: text.length });
          text += child.data;
        } else if (child.nodeName === "BR") {
          text += "\\n";
        } else if (child.nodeType === 1) {
          var block = blocks.test(child.nodeName);
          if (block && text) text += "\\n";
          if (block) points.push({ node: child, start: text.length, block: true });
          walk(child);
        }
      }
    })(root);
    return { text: text, points: points };
  }
`;
const SAVE_CARET = `${LINEAR_TEXT}
  var c = $.querySelector(".pell-content"), s = $.getSelection();
  window.__fmCaret = null;
  if (!c || !$.hasFocus() || !s.rangeCount || !c.contains(s.focusNode)) return;
  var r = $.createRange();
  r.selectNodeContents(c);
  r.setEnd(s.focusNode, s.focusOffset);
  var before = $.createElement("div");
  before.appendChild(r.cloneContents());
  window.__fmCaret = { at: linear(before).text.length, text: linear(c).text };
`;
/** The page's message that a reload is on screen. */
const RELOAD_SHOWN = "FASTMEMO_RELOAD_SHOWN";
/** Tells the screen that reload `reload` is on the page (see `reloadsSentRef`), then restores the caret. */
const restoreCaret = (reload: number) => `${LINEAR_TEXT}
  (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({ type: "${RELOAD_SHOWN}", data: ${reload} }));
  var saved = window.__fmCaret, c = $.querySelector(".pell-content");
  window.__fmCaret = null;
  if (!saved || !c) return;
  var now = linear(c), old = saved.text, text = now.text, from = 0, tail = 0;
  while (from < old.length && from < text.length && old[from] === text[from]) from++;
  while (tail < old.length - from && tail < text.length - from && old[old.length - 1 - tail] === text[text.length - 1 - tail]) tail++;
  var at = saved.at <= from ? saved.at : saved.at >= old.length - tail ? saved.at + text.length - old.length : text.length - tail;
  var point = null;
  for (var i = 0; i < now.points.length && now.points[i].start <= at; i++) {
    var p = now.points[i];
    if (p.block ? p.start === at : at <= p.start + p.node.length) point = p;
  }
  var s = $.getSelection();
  if (point) s.collapse(point.node, point.block ? 0 : at - point.start);
  else { s.selectAllChildren(c); s.collapseToEnd(); }
`;

/** The bar's state before the page has said where the caret is: a plain text line. */
const PLAIN_STATE: EditorState = {
  line: "p",
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  sub: false,
  sup: false,
  center: false,
  code: false,
  highlight: false,
  link: false,
};

/** Every live note, as the home orders them: what a link to a note is picked from, and followed to. */
const selectLinkableNotes = getNotesFilteredPerCategory(
  { order: 0, name: "All", icon: "", index: true, selected: false },
  true
);

/** The find bar's target for the note's page in `editorRef`, whose text is `textRef`'s. */
function textFindTarget(editorRef: React.RefObject<any>, textRef: React.RefObject<string>) {
  return createTextFindTarget(
    (script) => runInEditor(editorRef, script),
    () => textRef.current,
    () => editorRef.current?.focusContentEditor()
  );
}

/** A script run in the note's page: injectJavascript on native, the editor's command (postMessage, then eval) on web. */
function runInEditor(editorRef: React.RefObject<any>, script: string) {
  if (!editorRef.current) return;
  if (Platform.OS !== "web") editorRef.current.injectJavascript?.(script);
  else editorRef.current.command?.(script);
}

export default function NoteTextEditor({ initialNote, preview }: Props) {
  const { t } = useTranslation();

  const devMode = useSelector(selectorDeveloperMode);

  const aiAssistant = useSelector(selectorAIAssistant);
  const voiceRecognition = useSelector(selectorVoiceRecognition);
  const showAiActions = aiAssistant.enabled && aiAssistant.modelDownloaded;
  const showVoiceButton = voiceRecognition.enabled;

  const memoInitialNote = useMemo<TextNote>(() => ({ ...initialNote, type: initialNote.type || "text" }), [initialNote]);
  const isEmpty = useCallback((n: TextNote) => isTextNoteEmpty(n), []);
  const buildPayloadExtras = useCallback((n: TextNote) => ({ text: n.text }), []);

  const [noteTextLength, setNoteTextLength] = useState(() => getTextLength(memoInitialNote.text));
  const [noteTextSize, setNoteTextSize] = useState(() => getTextSize(memoInitialNote.text));

  const richTextEditor = useRef(null);
  const editorReadyRef = useRef(false);

  // Reloads sent to the editor's page, and the last one it has on screen: until it does, what the page reports was typed
  // over the content the reload replaces, and would undo the other device's change.
  const reloadsSentRef = useRef(0);
  const reloadsShownRef = useRef(0);
  const showRemote = useCallback((html: string) => {
    const reload = ++reloadsSentRef.current;
    richTextEditor.current?.command(SAVE_CARET);
    richTextEditor.current?.setContentHTML(html);
    richTextEditor.current?.command(restoreCaret(reload));
  }, []);

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle, keepVersion } = useNoteEditor<TextNote>(
    {
      initialNote: memoInitialNote,
      defaultType: "text",
      addWebhookSelector: selectorWebhook_addTextNote,
      addAction: "note/addTextNote",
      isEmpty,
      buildPayloadExtras,
      getTitleSource: (n) => stripHtml(n.text),
      preview: !!preview,
      // Changed on another device while open here: the WebView editor holds its own copy of the content (a page still
      // loading gets it once it's up).
      onRemoteChange: (remote, previous) => {
        if (remote.text === previous.text) return;
        if (editorReadyRef.current) showRemote(remote.text);
        // The character count follows from the page (COUNT_MESSAGE) once it shows the new text.
        setNoteTextSize(getTextSize(remote.text));
      },
    }
  );

  const [showFindReplace, setShowFindReplace] = useState(false);
  // Opened from a search result: its word, shown in the find bar once the page is ready.
  const [findWord, setFindWord] = useState<string | undefined>(undefined);
  const pendingFindRef = useRef<string | null>(null);
  useEffect(() => {
    const found = takeFindOnOpen(initialNote.id);
    if (found) pendingFindRef.current = found.word;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // An image tapped in the editor, and where on screen: its menu is open.
  const [tappedImage, setTappedImage] = useState<{ image: EditorImage; at: { x: number; y: number } } | null>(null);
  const editorBoxRef = useRef<ViewInstance>(null);
  // A link tapped in the editor, and where on screen: its menu is open.
  const [tappedLink, setTappedLink] = useState<{ link: EditorLink; at: { x: number; y: number } } | null>(null);
  // The link dialog, open with what it starts from; `key` mounts it anew for each link.
  const [linkDialog, setLinkDialog] = useState<(EditorLinkStart & { key: number }) | null>(null);
  // The RichEditor (a WebView) is mounted immediately into a reserved, flex-sized
  // box — never gated behind an idle timer — so the editor is present as the
  // screen fades in instead of flashing empty and popping in later. The WebView
  // engine is pre-warmed app-wide (see WebViewWarmup), so this mount is cheap.
  const [editorInitialized, setEditorInitialized] = useState(false);

  // The editor starts fully transparent — so the user sees the plain app background
  // ("an empty editor") while pell's WebView spins up — and fades in once it has
  // painted, so the rich content dissolves into view instead of popping in or
  // flashing as unformatted text.
  const [editorOpacity] = useState(() => new Animated.Value(0));

  // Only a brand-new note (created and never updated) autofocuses the editor, so
  // opening an existing note just lets the user read without popping the keyboard.
  const autofocus = useAutofocusNewNote(initialNote);
  const transitionDone = useScreenTransitionEnd();
  const didFocusRef = useRef(false);

  // Focus once the editor's WebView bridge has actually initialized AND the
  // screen transition has settled. Focusing on a fixed timer instead raced the
  // bridge (so it often no-op'd) and fired mid-transition (causing the jumps).
  useEffect(() => {
    if (didFocusRef.current) return;
    if (!autofocus) return;
    if (!editorInitialized || !transitionDone) return;
    didFocusRef.current = true;
    richTextEditor.current?.focusContentEditor();
  }, [editorInitialized, transitionDone, autofocus]);

  // A new text note opened to dictate (a link, a launcher shortcut: `@/libs/launch`): the dictation sheet once the page is
  // ready and the screen settled, as its button opens it; with voice recognition off, a toast says so.
  const [dictateAsked] = useState(() => initialNote.createdAt === initialNote.updatedAt && takeDictateOnOpen());
  const dictateNow = dictateAsked && editorInitialized && transitionDone;
  useEffect(() => {
    if (dictateNow && !showVoiceButton) toast(t("launch.dictation_off"), "top");
    // once, when the page is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictateNow]);

  // Safety net: never leave the loading cover up forever if pell's init callback
  // somehow never fires.
  useEffect(() => {
    const id = setTimeout(() => setEditorInitialized(true), 3000);
    return () => clearTimeout(id);
  }, []);

  // Once the editor has painted, fade it in over the app background.
  useEffect(() => {
    if (!editorInitialized) return;
    const animation = Animated.timing(editorOpacity, {
      toValue: 1,
      duration: DURATION.base,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [editorInitialized, editorOpacity]);

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const devModeRef = useRef(devMode);
  useEffect(() => {
    devModeRef.current = devMode;
  }, [devMode]);

  // What pictures put in since the page last sent the note: setText hasn't counted them yet.
  const incomingSizeRef = useRef(0);
  /**
   * Every way a picture comes in (the picker, a paste, a drop): reduced to 1600 px on its long side as JPEG, as a phone
   * photo would otherwise weigh megabytes in the note (LL-083); then put at the caret. false when it didn't fit the note,
   * or couldn't be read. `width` / `height` are the picker's, when it knows them.
   */
  const insertImageFrom = useCallback(
    async (uri: string, width?: number, height?: number): Promise<boolean> => {
      let base64 = "";
      try {
        base64 = await reducePhoto(uri, width, height);
      } catch {}
      if (!base64) {
        toast(t("note.image.not_added"));
        return false;
      }
      const html = `<div><img src="data:image/jpeg;base64,${base64}"></div>`;
      const size = getTextSize(html);
      const dm = devModeRef.current;
      const total = getTextSize(noteRef.current.text) + incomingSizeRef.current + size;
      if (!(dm.enabled && dm.unlimitedTextSpace) && total > noteTextLimit(noteRef.current.local)) {
        toast(t("noteLimitReached"));
        return false;
      }
      incomingSizeRef.current += size;
      const src = `data:image/jpeg;base64,${base64}`;
      richTextEditor.current?.focusContentEditor();
      richTextEditor.current?.command(`window.__fm && window.__fm.insertImage(${JSON.stringify(src)})`);
      return true;
    },
    [t]
  );

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true });

    if (result.canceled || !result.assets?.length) return;

    const image = result.assets[0];
    await insertImageFrom(image.uri, image.width, image.height);
  }, [insertImageFrom]);

  const setTitle = useCallback(
    (titleVal: string) => {
      setNoteAsync({ ...noteRef.current, title: titleVal });
    },
    [setNoteAsync]
  );

  const setText = useCallback(
    (textVal: string) => {
      const textSize = getTextSize(textVal);

      const dm = devModeRef.current;
      const isUnlimited = dm.enabled && dm.unlimitedTextSpace;

      // Over the limit, only what makes the note smaller goes in: a note already over it (a cloud with a smaller limit)
      // can still be cut down.
      const limit = noteTextLimit(noteRef.current.local);
      if (!isUnlimited && textSize > limit && textSize > getTextSize(noteRef.current.text)) {
        toast(t("noteLimitReached"));
        richTextEditor.current?.setContentHTML(noteRef.current.text); // revert
        return;
      }

      incomingSizeRef.current = 0;
      setNoteTextSize(textSize);

      setNoteAsync({ ...noteRef.current, text: textVal });
    },
    [setNoteAsync, t]
  );

  const onEditorChange = useCallback(
    (html: string) => {
      // Typed over the content a reload has replaced since (see reloadsSentRef).
      if (reloadsShownRef.current !== reloadsSentRef.current) return;
      // The page keeps a zero-width space after inline code it made, for the caret: never part of the note.
      setText(html.includes("\u200b") ? html.replace(/\u200b/g, "") : html);
    },
    [setText]
  );

  // What the page says about the caret (STATE_MESSAGE): the bar lights its controls by it.
  const [formatState, setFormatState] = useState<EditorState>(PLAIN_STATE);
  const formatBarRef = useRef<TextFormatBarRef>(null);
  // The picker of a link to a note: open from [[ in the text, or from the bar's menu with a field of its own.
  const [picker, setPicker] = useState<{ query: string; fromMenu: boolean } | null>(null);
  const [pickerSelected, setPickerSelected] = useState(0);
  // The page's messages about links to other notes, handled by the latest render (they read its notes and picker).
  const noteLinkEventsRef = useRef({
    trigger: (_: EditorPicker) => {},
    key: (_: PickerKey) => {},
    follow: (_: string) => {},
  });

  // What the find bar searches: the note's page. Its count follows the text as it changes.
  const plainTextRef = useRef("");
  // The target reads the two refs only when the bar searches, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [findTarget] = useState(() => textFindTarget(richTextEditor, plainTextRef));

  const onEditorMessage = useCallback(
    (message: { type?: string; data?: unknown }) => {
      if (message?.type === FIND_ESCAPE_MESSAGE) findTarget.escaped();
      if (message?.type === RELOAD_SHOWN) reloadsShownRef.current = message.data as number;
      if (message?.type === STATE_MESSAGE) setFormatState(message.data as EditorState);
      // A touch on the text closes the bar's menu.
      if (message?.type === TOUCH_MESSAGE) formatBarRef.current?.closeMenu();
      // The page counts what it shows after every change (typing, a reload, an undo): the app doesn't parse the note.
      if (message?.type === COUNT_MESSAGE && typeof message.data === "number") setNoteTextLength(message.data);
      if (message?.type === IMAGE_MESSAGE) {
        const image = message.data as EditorImage;
        // The page gives the point in itself: the editor's box is where the page is on screen.
        editorBoxRef.current?.measureInWindow((x, y) => setTappedImage({ image, at: { x: x + image.x, y: y + image.y } }));
      }
      if (message?.type === LINK_MESSAGE) {
        const link = message.data as EditorLink;
        // Read-only, or a Cmd/Ctrl click: the link opens at once. Only the system ever opens it, never the page.
        if (link.direct) openLink(link.href);
        else editorBoxRef.current?.measureInWindow((x, y) => setTappedLink({ link, at: { x: x + link.x, y: y + link.y } }));
      }
      if (message?.type === LINK_START_MESSAGE) setLinkDialog({ ...(message.data as EditorLinkStart), key: Date.now() });
      if (message?.type === PICKER_MESSAGE) noteLinkEventsRef.current.trigger(message.data as EditorPicker);
      if (message?.type === PICKER_KEY_MESSAGE) noteLinkEventsRef.current.key(message.data as PickerKey);
      if (message?.type === NOTE_LINK_MESSAGE && typeof message.data === "string")
        noteLinkEventsRef.current.follow(message.data);
      if (message?.type === IMAGE_FAILED_MESSAGE) toast(i18n.t("note.image.failed"));
      if (message?.type === PAGE_ERROR_MESSAGE) reportPageError("richtext", message.data);
      // Pictures pasted or dropped: one after the other, in order; what doesn't fit is left out, with the ones after it.
      if (message?.type === IMAGE_IN_MESSAGE) {
        const images = (message.data as { images?: string[] } | null)?.images ?? [];
        void (async () => {
          for (const uri of images) if (!(await insertImageFrom(uri))) break;
        })();
      }
    },
    [insertImageFrom, findTarget]
  );

  const changeImage = useCallback((image: EditorImage, change: ImageChange, value?: string) => {
    richTextEditor.current?.command(imageCommand(image, change, value));
  }, []);
  const closeImageMenu = useCallback(() => setTappedImage(null), []);
  const closeLinkMenu = useCallback(() => setTappedLink(null), []);

  const onEditorInitialized = useCallback(() => {
    editorReadyRef.current = true;
    richTextEditor.current?.command(RICH_TEXT_SCRIPT);
    setEditorInitialized(true);
    // Changed on another device while the page was loading: it loaded the text the screen opened with.
    if (noteRef.current.text !== initialNote.text) showRemote(noteRef.current.text);
    if (pendingFindRef.current) {
      setFindWord(pendingFindRef.current);
      setShowFindReplace(true);
      pendingFindRef.current = null;
    }
  }, [initialNote.text, showRemote]);

  // The formatting toolbar rides on top of the keyboard in a KeyboardStickyView
  // (see render): it stays glued to the keyboard's top edge and slides off-screen
  // as the keyboard closes — entirely on the UI thread, with no keyboard listeners,
  // no per-keystroke re-render, and no display:none/flex toggle (that toggle is what
  // made the toolbar pop in with a jump on note creation). `barHeight` is its height
  // (the bar's own, which an open menu never changes, and on iOS the dismiss button
  // above it): the sticky view parks itself exactly that far below the screen when the
  // keyboard is down, and the editor reserves the same amount of extra keyboard offset
  // so the caret never lands behind the floating bar. A read-only note has no bar.
  const [dismissHeight, setDismissHeight] = useState(0);
  const barHeight = note.readOnly ? 0 : TEXT_FORMAT_BAR_HEIGHT + dismissHeight;

  useFocusEffect(
    useCallback(() => {
      return () => {
        richTextEditor.current?.dismissKeyboard();
      };
    }, [])
  );

  // Ctrl/Cmd + P prints this note while it is on screen (spec C.5); a version's preview isn't the note.
  useFocusEffect(
    useCallback(() => {
      if (preview) return;
      setPrintable(() => void printNote(noteRef.current.title, noteRef.current.text).catch(() => {}));
      return () => setPrintable(null);
    }, [preview])
  );

  // The bar's choices go to the page, focused first only if it lost the focus: on Android focusContentEditor moves the
  // focus through a hidden field first (the library can't tell the keyboard is up there), which drops the selection.
  const pageFocusedRef = useRef(false);
  const onPageFocus = useCallback(() => (pageFocusedRef.current = true), []);
  const onPageBlur = useCallback(() => (pageFocusedRef.current = false), []);
  const sendToPage = useCallback((script: string) => {
    if (!pageFocusedRef.current) richTextEditor.current?.focusContentEditor();
    richTextEditor.current?.command(script);
  }, []);
  const onLine = useCallback((type: LineType) => sendToPage(lineCommand(type)), [sendToPage]);
  const onFormat = useCallback((command: FormatCommand) => sendToPage(formatCommand(command)), [sendToPage]);
  const onInsert = useCallback(
    (kind: InsertKind) => {
      if (kind === "image") pickImage();
      else if (kind === "link") sendToPage(LINK_START_COMMAND);
      else if (kind === "noteLink") {
        // The picker's field takes the focus: the page remembers the caret first.
        richTextEditor.current?.command(PICK_START_COMMAND);
        setPicker({ query: "", fromMenu: true });
        setPickerSelected(0);
      } else if (kind === "rule") sendToPage(RULE_COMMAND);
    },
    [pickImage, sendToPage]
  );

  // Links to another note (spec B.4): the picker, open from [[ in the text or from the bar's menu, and a tap on a link.
  const router = useRouter();
  const { unlockWithSecret } = useSecret();
  const showHidden = useSelector(selectorShowHidden);
  const linkableNotes = useSelector(selectLinkableNotes);
  const picked = useMemo(
    () => (picker ? pickNotes(linkableNotes, picker.query, { excludeId: note.id, showHidden }) : []),
    [picker, linkableNotes, note.id, showHidden]
  );
  // The page hands the arrows, Enter and Esc over only while there are rows to move through.
  const rowsShown = !!picker && !picker.fromMenu && picked.length > 0;
  useEffect(() => {
    richTextEditor.current?.command(pickerShownCommand(rowsShown));
  }, [rowsShown]);

  const pickNote = useCallback(
    (target: Note) => {
      setPicker(null);
      sendToPage(noteLinkCommand(target.id, isStringEmpty(target.title) ? t("empty_title") : target.title));
    },
    [sendToPage, t]
  );
  const closePicker = useCallback(() => {
    setPicker(null);
    richTextEditor.current?.command(PICKER_CLOSE_COMMAND);
  }, []);
  const onPickerKey = useCallback(
    (key: PickerKey) => {
      if (key === "up") setPickerSelected((i) => Math.max(0, i - 1));
      else if (key === "down") setPickerSelected((i) => Math.min(picked.length - 1, i + 1));
      else if (key === "escape") closePicker();
      else if (picked[pickerSelected]) pickNote(picked[pickerSelected]);
    },
    [picked, pickerSelected, pickNote, closePicker]
  );
  const onPickerSearch = useCallback((query: string) => {
    setPicker({ query, fromMenu: true });
    setPickerSelected(0);
  }, []);

  // A tap on a note link: the note it names, if this device still has it; the code first for a hidden one while hidden
  // notes aren't shown (a protected one is asked by its own screen). Back returns here.
  const followNoteLink = useCallback(
    (id: string) => {
      flushNote();
      const target = linkableNotes.find((n) => n.id === id);
      if (!target) return toast(t("note.not_found"));
      if (target.hidden && !showHidden) {
        unlockWithSecret((codeRouter, isFingerprint) => {
          if (target.locked) storeUnlockedNote(id);
          if (isFingerprint) codeRouter.push(`/notes/${id}`);
          else codeRouter.replace(`/notes/${id}`);
        }, "none");
        return;
      }
      router.push(`/notes/${id}`);
    },
    [flushNote, linkableNotes, showHidden, unlockWithSecret, router, t]
  );

  useEffect(() => {
    noteLinkEventsRef.current = {
      trigger: (data) => {
        setPicker((current) => (current?.fromMenu ? current : data.open ? { query: data.query, fromMenu: false } : null));
        setPickerSelected(0);
      },
      key: onPickerKey,
      follow: followNoteLink,
    };
  }, [onPickerKey, followNoteLink]);

  const pickerView =
    picker && (picked.length > 0 || picker.fromMenu) ? (
      <NoteLinkPicker
        notes={picked}
        query={picker.query}
        selected={pickerSelected}
        onPick={pickNote}
        search={picker.fromMenu ? { value: picker.query, onChange: onPickerSearch, onKey: onPickerKey } : undefined}
      />
    ) : undefined;

  const confirmLink = useCallback(
    (href: string, text: string) => {
      setLinkDialog(null);
      sendToPage(linkCommand(href, text));
    },
    [sendToPage]
  );
  const cancelLink = useCallback(() => {
    setLinkDialog(null);
    richTextEditor.current?.command(LINK_CANCEL_COMMAND);
  }, []);
  // The caret is in the tapped link (the tap put it there): the dialog edits that link.
  const editTappedLink = useCallback(() => sendToPage(LINK_START_COMMAND), [sendToPage]);
  const unlinkTapped = useCallback(() => sendToPage(UNLINK_COMMAND), [sendToPage]);
  const openTappedLink = useCallback(() => tappedLink && openLink(tappedLink.link.href), [tappedLink]);

  // Built only while the find bar is open: stripping a long note at every pause costs for nothing otherwise.
  const plainNoteText = useMemo(() => (showFindReplace ? stripHtml(note.text) : ""), [showFindReplace, note.text]);
  useEffect(() => {
    plainTextRef.current = plainNoteText;
    findTarget.refresh();
  }, [plainNoteText, findTarget]);

  return (
    <View style={styles.root}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.container}>
        <View>
          <View style={styles.header}>
            <BackButton chip tourTarget="back" callback={updateNoteWebhook} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                style={styles.titleInput}
                onChangeText={setTitle}
                value={note.title}
                editable={!note.readOnly}
                cursorColor={COLOR.softWhite}
                placeholder={autoTitle || t("note.title_placeholder")}
                placeholderTextColor={COLOR.textMuted}
                maxLength={96}
              />
            </View>

            <TouchableOpacity
              style={styles.searchToggle}
              onPress={() => {
                setShowFindReplace((prev) => !prev);
                setFindWord(undefined);
              }}
              testID={showFindReplace ? undefined : SHORTCUT_TARGET.find}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.search_in_note")}
              aria-expanded={showFindReplace}
            >
              <IconChip>
                <MagnifyingGlassIcon size={20} color={showFindReplace ? COLOR.accentSoft : COLOR.softWhite} />
              </IconChip>
            </TouchableOpacity>

            {preview ? (
              <View style={styles.menuSpacer} />
            ) : (
              <NoteSettingsButton note={note} setNote={setNoteAsync} flushNote={flushNote} />
            )}
          </View>
          {preview ? <VersionBand preview={preview} /> : <NotePresenceBanner noteId={note.id} />}

          <View style={styles.subtitleWrapper}>
            <Text style={[styles.subtitle, { flexGrow: 1 }]}>
              {noteTextLength} {t("note.characters")}
            </Text>
            <Text style={[styles.subtitle, { flexGrow: 1 }]}>
              {convertToMB(noteTextSize)} MB /{" "}
              {devMode.enabled && devMode.unlimitedTextSpace ? "∞" : `${convertToMB(noteTextLimit(note.local))} MB`}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          // Lift the editor an extra `barHeight` so its bottom clears the toolbar that
          // floats on the keyboard's edge (rendered in the KeyboardStickyView below).
          keyboardVerticalOffset={barHeight}
          style={{
            position: "relative",
            flex: 1,
            maxWidth: Platform.OS === "web" ? 800 : undefined,
            width: SIZE.full,
            marginHorizontal: Platform.OS === "web" ? "auto" : PADDING_MARGIN.xs,
            paddingVertical: Platform.OS === "web" ? PADDING_MARGIN.lg : 0,
          }}
        >
          <FindReplaceBar
            visible={showFindReplace}
            onClose={() => {
              setShowFindReplace(false);
              setFindWord(undefined);
            }}
            target={findTarget}
            onBeforeReplaceAll={() => keepVersion("replace")}
            readOnly={note.readOnly}
            initialQuery={findWord}
            style={{ marginTop: PADDING_MARGIN.md }}
          />

          {/* The editor fades in from transparent once pell has painted (see effect
              above), so the rich content dissolves over the app background — the user
              briefly sees an empty editor, never a flash of unformatted text. */}
          <Animated.View ref={editorBoxRef} style={[styles.editorWrapper, { opacity: editorOpacity }]}>
            <RichEditor
              containerStyle={styles.richTextContainer}
              androidLayerType="hardware"
              useContainer={false}
              disabled={note.readOnly}
              ref={richTextEditor}
              allowFileAccess={true}
              onChange={onEditorChange}
              onMessage={onEditorMessage}
              onFocus={onPageFocus}
              onBlur={onPageBlur}
              initialContentHTML={initialNote.text}
              placeholder={t("note.description_placeholder")}
              pasteAsPlainText
              injectedJavaScriptBeforeContentLoaded={EDITOR_SANITIZE_SCRIPT}
              injectedJavaScript={EDITOR_SANITIZE_SCRIPT}
              editorStyle={RICH_TEXT_STYLE}
              editorInitializedCallback={onEditorInitialized}
            />
          </Animated.View>

          {/* Auxiliary actions live in a dedicated bar below the editor (not floating over
            the text) so there is a clear separation from the rich text content.
            Rendered from mount (not gated on editor init) so the bottom area never
            reflows/pops in when the editor finishes loading on note creation. */}
          {!note.readOnly && (showAiActions || showVoiceButton) && (
            <EditorActionDock>
              <View style={dockGroupStyle}>
                {showAiActions && (
                  <AIEditorActions
                    noteType="text"
                    getContent={() => stripHtml(note.text)}
                    getHtml={() => note.text}
                    noteTitle={note.title}
                    categoryName={note.category.name}
                    onTitleGenerated={(title) => updateNoteAsync((current) => ({ ...current, title }))}
                    onCategorySuggested={(name) => {
                      const cat = findCategoryByName(name);
                      if (cat) updateNoteAsync((current) => ({ ...current, category: cat }));
                    }}
                    onHtmlChanged={(html) => {
                      // the note before the AI's rewrite is kept as a version (spec B.9)
                      keepVersion("ai");
                      richTextEditor.current?.setContentHTML(html);
                      setText(html);
                    }}
                    style={dockButtonStyle}
                    menuBottomOffset={110}
                  />
                )}

                {showVoiceButton && (
                  <VoiceRecognitionButton
                    onInsert={(text) => {
                      const html = voiceTextToHtml(text, { lists: true });
                      // the dictation sheet dismissed the keyboard; refocus so the
                      // text lands at the caret, then insert
                      richTextEditor.current?.focusContentEditor();
                      setTimeout(() => richTextEditor.current?.insertHTML(html), 50);
                    }}
                    aiCleanup
                    openNow={dictateNow}
                    style={dockButtonStyle}
                  />
                )}
              </View>
            </EditorActionDock>
          )}

          {/* On web there is no soft keyboard, so the formatting bar is simply docked at the bottom of the editor.
            Native renders it in a KeyboardStickyView outside the KAV (see below) so it can stick to the keyboard's
            edge. A read-only note has no bar. */}
          {Platform.OS === "web" && !note.readOnly && (
            <TextFormatBar
              ref={formatBarRef}
              docked
              state={formatState}
              onLine={onLine}
              onFormat={onFormat}
              onInsert={onInsert}
              above={pickerView}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Native: the formatting toolbar glued to the top edge of the keyboard. It
          slides up with the keyboard and parks fully below the screen (offset.closed
          = its own height) when the keyboard is down — no React state, no reflow. */}
      {Platform.OS !== "web" && !note.readOnly && (
        <KeyboardStickyView offset={{ closed: barHeight, opened: 0 }} style={styles.stickyToolbar}>
          {/* A menu opens above the bar, over the text: it never counts in barHeight. */}
          <View>
            {Platform.OS === "ios" && (
              <View onLayout={(e) => setDismissHeight(e.nativeEvent.layout.height)}>
                <DismissKeyboardButton showKeyboardDismiss onPress={() => richTextEditor.current?.dismissKeyboard()} />
              </View>
            )}
            <TextFormatBar
              ref={formatBarRef}
              state={formatState}
              onLine={onLine}
              onFormat={onFormat}
              onInsert={onInsert}
              above={pickerView}
            />
          </View>
        </KeyboardStickyView>
      )}

      <NoteImageMenu
        image={tappedImage?.image ?? null}
        at={tappedImage?.at ?? null}
        onChange={changeImage}
        onClose={closeImageMenu}
      />

      <NoteLinkMenu
        link={tappedLink?.link ?? null}
        at={tappedLink?.at ?? null}
        onOpen={openTappedLink}
        onEdit={editTappedLink}
        onRemove={unlinkTapped}
        onClose={closeLinkMenu}
      />

      {linkDialog && (
        <LinkDialog
          key={linkDialog.key}
          visible
          initialText={linkDialog.text}
          initialAddress={linkDialog.href ?? ""}
          onConfirm={confirmLink}
          onClose={cancelLink}
        />
      )}

      {!preview && <EditorTourTip />}
    </View>
  );
}

/** A link's address, opened by the system when it is one a note may hold: the page never opens anything itself. */
function openLink(href: string) {
  const link = normalizeLink(href);
  if (link) openUrl(link);
  else toast(i18n.t("note.link.invalid"));
}

const styles = StyleSheet.create({
  // where the note menu sits, so the title stays centred while a version is shown
  menuSpacer: {
    width: 42,
  },
  root: {
    flex: 1,
  },
  container: {
    height: SIZE.full,
    paddingVertical: PADDING_MARGIN.lg,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  titleInput: {
    textAlign: "center",
    // Android misplaces the caret of an empty centered TextInput (drifts to the
    // bottom/right until typing starts); these two keep it centered.
    textAlignVertical: "center",
    includeFontPadding: false,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginHorizontal: PADDING_MARGIN.sm,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    borderRadius: BORDER.normal,
  },
  searchToggle: {
    marginRight: PADDING_MARGIN.sm,
  },
  subtitleWrapper: {
    flexGrow: 1,
    marginTop: PADDING_MARGIN.sm,
    marginHorizontal: PADDING_MARGIN.xl,
    flexDirection: "row",
  },
  subtitle: {
    marginTop: PADDING_MARGIN.xs,
    textAlign: "center",
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.medium,
    color: COLOR.textSecondary,
  },
  editorWrapper: {
    // The editor's <iframe> fills this box at height:100%, so its bottom edge sits on
    // this padding — guaranteeing a real gap before the toolbar that the caret can't
    // cross while typing (CSS inside the iframe can't achieve this on its own).
    flex: 1,
    paddingBottom: PADDING_MARGIN.lg,
  },
  richTextContainer: {
    // Horizontal inset is applied via the editor's contentCSSText instead, so it stays
    // consistent on web (where this containerStyle is ignored by the iframe webview).
    paddingTop: PADDING_MARGIN.sm,
    paddingBottom: PADDING_MARGIN.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Native formatting bar: pinned to the bottom of the screen, full width. The
  // KeyboardStickyView translates it up to sit on the keyboard's edge (and below the
  // screen when the keyboard is closed); it must stay outside the SafeAreaView's
  // padding so "bottom: 0" is the true screen edge it sticks up from.
  stickyToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  textWrapper: {
    marginVertical: PADDING_MARGIN.xl,
  },
  text: {
    fontSize: FONTSIZE.paragraph,
    lineHeight: 24,
    color: COLOR.textPrimary,
    paddingBottom: PADDING_MARGIN.lg,
  },
});
