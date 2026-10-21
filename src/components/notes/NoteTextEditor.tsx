import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import NotePresenceBanner from "@/components/notes/NotePresenceBanner";
import EditorTourTip from "@/components/notes/EditorTourTip";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { configs } from "@/configs";
import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useAutofocusNewNote } from "@/hooks/useAutofocusNewNote";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName, stripHtml } from "@/libs/ai";
import i18n from "@/libs/i18n";
import {
  selectorAIAssistant,
  selectorDeveloperMode,
  selectorVoiceRecognition,
  selectorWebhook_addTextNote,
} from "@/slicers/settingsSlice";
import type { TextNote } from "@/types";
import { convertToMB, getTextLength, getTextSize, isStringEmpty } from "@/utils/string";
import { toast } from "@/utils/toast";
import { voiceTextToHtml } from "@/utils/voiceTranscript";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import type { ReactElement } from "react";
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TouchableOpacityProps } from "react-native";
import { Animated, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MagnifyingGlassIcon from "react-native-heroicons/outline/MagnifyingGlassIcon";
import { KeyboardAvoidingView, KeyboardStickyView } from "react-native-keyboard-controller";
import { actions, RichEditor, RichToolbar } from "react-native-pell-rich-editor";
import { useSelector } from "react-redux";
import heading1Icon from "~/assets/actions/heading1.png";

interface Props {
  initialNote: TextNote;
}

// First-paint guess for the formatting bar's height (dismiss button + RichToolbar),
// replaced by the real measured height on its first layout. It only needs to be at
// least the real height so the bar parks fully below the screen while the keyboard
// is down (and so the editor reserves enough room for it while the keyboard is up).
const BAR_HEIGHT_ESTIMATE = 100;

const TOOLBAR_LABEL_KEYS: Record<string, string> = {
  [actions.undo]: "a11y.format.undo",
  [actions.redo]: "a11y.format.redo",
  [actions.insertImage]: "a11y.format.image",
  [actions.heading1]: "a11y.format.heading",
  [actions.setBold]: "a11y.format.bold",
  [actions.setItalic]: "a11y.format.italic",
  [actions.setStrikethrough]: "a11y.format.strikethrough",
  [actions.setUnderline]: "a11y.format.underline",
  [actions.alignLeft]: "a11y.format.align_left",
  [actions.alignCenter]: "a11y.format.align_center",
  [actions.setSubscript]: "a11y.format.subscript",
  [actions.setSuperscript]: "a11y.format.superscript",
  [actions.insertBulletsList]: "a11y.format.bullet_list",
  [actions.insertOrderedList]: "a11y.format.numbered_list",
  [actions.code]: "a11y.format.code",
};

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

// Every other action is a format the cursor's text either has or not.
const NON_TOGGLE_ACTIONS = new Set<string>([actions.undo, actions.redo, actions.insertImage]);

const renderToolbarAction = (
  RichToolbar.prototype as unknown as {
    _defaultRenderAction(action: string, selected: boolean): ReactElement;
  }
)._defaultRenderAction;

// RichToolbar renders its action buttons with no role or name and has no prop to add them, so decorate the
// buttons its default renderer returns (`_renderAction` calls it through `this`, so the override is used). It has no
// prop for its list's padding either: the first and last buttons get a margin, so they don't touch the screen edges.
class LabeledRichToolbar extends RichToolbar {
  _defaultRenderAction(action: string, selected: boolean) {
    const isToggle = !NON_TOGGLE_ACTIONS.has(action);
    const button = renderToolbarAction.call(this, action, selected) as ReactElement<TouchableOpacityProps>;
    const list = this.props.actions ?? [];
    return cloneElement(button, {
      style: [
        button.props.style,
        action === list[0] && styles.firstToolbarAction,
        action === list[list.length - 1] && styles.lastToolbarAction,
      ],
      accessibilityRole: isToggle ? "checkbox" : "button",
      accessibilityLabel: TOOLBAR_LABEL_KEYS[action] ? i18n.t(TOOLBAR_LABEL_KEYS[action]) : undefined,
      "aria-checked": isToggle ? selected : undefined,
    });
  }
}

export default function NoteTextEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const devMode = useSelector(selectorDeveloperMode);

  const aiAssistant = useSelector(selectorAIAssistant);
  const voiceRecognition = useSelector(selectorVoiceRecognition);
  const showAiActions = aiAssistant.enabled && aiAssistant.modelDownloaded;
  const showVoiceButton = voiceRecognition.enabled;

  const memoInitialNote = useMemo<TextNote>(() => ({ ...initialNote, type: initialNote.type || "text" }), [initialNote]);
  const isEmpty = useCallback((n: TextNote) => isStringEmpty(n.title) && isStringEmpty(n.text), []);
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

  const { note, setNoteAsync, updateNoteAsync, flushNote, updateNoteWebhook, autoTitle } = useNoteEditor<TextNote>({
    initialNote: memoInitialNote,
    defaultType: "text",
    addWebhookSelector: selectorWebhook_addTextNote,
    addAction: "note/addTextNote",
    isEmpty,
    buildPayloadExtras,
    getTitleSource: (n) => stripHtml(n.text),
    // Changed on another device while open here: the WebView editor holds its own copy of the content (a page still
    // loading gets it once it's up).
    onRemoteChange: (remote, previous) => {
      if (remote.text === previous.text) return;
      if (editorReadyRef.current) showRemote(remote.text);
      setNoteTextLength(getTextLength(remote.text));
      setNoteTextSize(getTextSize(remote.text));
    },
  });

  const [showFindReplace, setShowFindReplace] = useState(false);
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
      duration: 220,
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

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.3,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const image = result.assets[0];

    const manipResult = await ImageManipulator.manipulateAsync(image.uri, [], {
      compress: 0.3,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    richTextEditor.current?.insertImage(`data:image/jpeg;base64,${manipResult.base64}`);
  }, []);

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

      if (!isUnlimited && textSize > configs.notes.sizeLimit) {
        toast(t("noteLimitReached"));
        richTextEditor.current?.setContentHTML(noteRef.current.text); // revert
        return;
      }

      setNoteTextLength(getTextLength(textVal));
      setNoteTextSize(textSize);

      setNoteAsync({ ...noteRef.current, text: textVal });
    },
    [setNoteAsync, t]
  );

  const onEditorChange = useCallback(
    (html: string) => {
      // Typed over the content a reload has replaced since (see reloadsSentRef).
      if (reloadsShownRef.current !== reloadsSentRef.current) return;
      setText(html);
    },
    [setText]
  );

  const onEditorMessage = useCallback((message: { type?: string; data?: unknown }) => {
    if (message?.type === RELOAD_SHOWN) reloadsShownRef.current = message.data as number;
  }, []);

  const onEditorInitialized = useCallback(() => {
    editorReadyRef.current = true;
    setEditorInitialized(true);
    // Changed on another device while the page was loading: it loaded the text the screen opened with.
    if (noteRef.current.text !== initialNote.text) showRemote(noteRef.current.text);
  }, [initialNote.text, showRemote]);

  // The formatting toolbar rides on top of the keyboard in a KeyboardStickyView
  // (see render): it stays glued to the keyboard's top edge and slides off-screen
  // as the keyboard closes — entirely on the UI thread, with no keyboard listeners,
  // no per-keystroke re-render, and no display:none/flex toggle (that toggle is what
  // made the toolbar pop in with a jump on note creation). `barHeight` is its measured
  // height: the sticky view parks itself exactly that far below the screen when the
  // keyboard is down, and the editor reserves the same amount of extra keyboard offset
  // so the caret never lands behind the floating bar.
  const [barHeight, setBarHeight] = useState(BAR_HEIGHT_ESTIMATE);

  useFocusEffect(
    useCallback(() => {
      return () => {
        richTextEditor.current?.dismissKeyboard();
      };
    }, [])
  );

  const editorStyle = useMemo(
    () => ({
      backgroundColor: "transparent",
      color: COLOR.softWhite,
      placeholderColor: COLOR.textMuted,
      cssText: richTextSyle,
      // Horizontal inset lives here (not on containerStyle) so it matches the header
      // and toolbar margins on every platform: on web the webview is a plain <iframe>
      // that ignores containerStyle, so only this content padding aligns the text.
      // The gap from the toolbar is handled by editorWrapper's paddingBottom (a real
      // layout gap outside the iframe) — content padding-bottom can't do it because the
      // iframe's bottom edge is the scroll viewport edge, so the caret always lands on it.
      contentCSSText: `padding: ${PADDING_MARGIN.sm}px ${PADDING_MARGIN.lg}px ${PADDING_MARGIN.sm}px;`,
    }),
    []
  );

  const toolbarActions = useMemo(
    () => [
      actions.undo,
      actions.redo,
      actions.insertImage,
      actions.heading1,
      actions.setBold,
      actions.setItalic,
      actions.setStrikethrough,
      actions.setUnderline,
      actions.alignLeft,
      actions.alignCenter,
      actions.setSubscript,
      actions.setSuperscript,
      actions.insertBulletsList,
      actions.insertOrderedList,
      actions.code,
    ],
    []
  );

  const toolbarIconMap = useMemo(
    () => ({
      heading1: heading1Icon,
    }),
    []
  );

  const plainNoteText = useMemo(() => stripHtml(note.text), [note.text]);

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
              onPress={() => setShowFindReplace((prev) => !prev)}
              testID={showFindReplace ? undefined : SHORTCUT_TARGET.find}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.search_in_note")}
              aria-expanded={showFindReplace}
            >
              <IconChip>
                <MagnifyingGlassIcon size={20} color={showFindReplace ? COLOR.accentSoft : COLOR.softWhite} />
              </IconChip>
            </TouchableOpacity>

            <NoteSettingsButton note={note} setNote={setNoteAsync} flushNote={flushNote} />
          </View>
          <NotePresenceBanner noteId={note.id} />

          <View style={styles.subtitleWrapper}>
            <Text style={[styles.subtitle, { flexGrow: 1 }]}>
              {noteTextLength} {t("note.characters")}
            </Text>
            <Text style={[styles.subtitle, { flexGrow: 1 }]}>
              {convertToMB(noteTextSize)} MB /{" "}
              {devMode.enabled && devMode.unlimitedTextSpace ? "∞" : `${convertToMB(configs.notes.sizeLimit)} MB`}
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
            onClose={() => setShowFindReplace(false)}
            editorRef={richTextEditor}
            plainText={plainNoteText}
            style={{ marginTop: PADDING_MARGIN.md }}
          />

          {/* The editor fades in from transparent once pell has painted (see effect
              above), so the rich content dissolves over the app background — the user
              briefly sees an empty editor, never a flash of unformatted text. */}
          <Animated.View style={[styles.editorWrapper, { opacity: editorOpacity }]}>
            <RichEditor
              containerStyle={styles.richTextContainer}
              androidLayerType="hardware"
              useContainer={false}
              disabled={note.readOnly}
              ref={richTextEditor}
              allowFileAccess={true}
              onChange={onEditorChange}
              onMessage={onEditorMessage}
              initialContentHTML={initialNote.text}
              placeholder={t("note.description_placeholder")}
              pasteAsPlainText
              editorStyle={editorStyle}
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
                    onTitleGenerated={(title) => updateNoteAsync((current) => ({ ...current, title }))}
                    onCategorySuggested={(name) => {
                      const cat = findCategoryByName(name);
                      if (cat) updateNoteAsync((current) => ({ ...current, category: cat }));
                    }}
                    onHtmlChanged={(html) => {
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
                    style={dockButtonStyle}
                  />
                )}
              </View>
            </EditorActionDock>
          )}

          {/* On web there is no soft keyboard, so the formatting toolbar is simply
            docked at the bottom of the editor. Native renders it in a
            KeyboardStickyView outside the KAV (see below) so it can stick to the
            keyboard's edge. */}
          {Platform.OS === "web" && (
            <LabeledRichToolbar
              style={[styles.richToolbarContainer, styles.richToolbarContainerDesktop]}
              // On web, capping the inner list at the bar width (rather than pinning it to
              // 100%) lets it keep its intrinsic width when the icons fit — so the bar's
              // alignItems:center centers them — while still capping + falling back to
              // react-native-web's horizontal overflow-x scrolling on narrow viewports.
              flatContainerStyle={styles.richToolbarFlatContainer}
              editor={richTextEditor}
              onPressAddImage={pickImage}
              iconSize={22}
              iconTint={COLOR.softWhite}
              selectedIconTint={COLOR.accentSoft}
              unselectedButtonStyle={styles.toolbarAction}
              selectedButtonStyle={styles.toolbarActionSelected}
              actions={toolbarActions}
              iconMap={toolbarIconMap}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Native: the formatting toolbar glued to the top edge of the keyboard. It
          slides up with the keyboard and parks fully below the screen (offset.closed
          = its own height) when the keyboard is down — no React state, no reflow. */}
      {Platform.OS !== "web" && (
        <KeyboardStickyView offset={{ closed: barHeight, opened: 0 }} style={styles.stickyToolbar}>
          <View onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
            {Platform.OS === "ios" && (
              <DismissKeyboardButton showKeyboardDismiss onPress={() => richTextEditor.current?.dismissKeyboard()} />
            )}
            <LabeledRichToolbar
              style={styles.richToolbarContainer}
              editor={richTextEditor}
              onPressAddImage={pickImage}
              iconSize={22}
              iconTint={COLOR.softWhite}
              selectedIconTint={COLOR.accentSoft}
              unselectedButtonStyle={styles.toolbarAction}
              selectedButtonStyle={styles.toolbarActionSelected}
              actions={toolbarActions}
              iconMap={toolbarIconMap}
            />
          </View>
        </KeyboardStickyView>
      )}

      <EditorTourTip />
    </View>
  );
}

const styles = StyleSheet.create({
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
  richToolbarContainer: {
    width: SIZE.full,
    // The 44 high buttons centered in the padding (the height counts the top border too).
    height: 44 + 2 * PADDING_MARGIN.sm + 1,
    paddingVertical: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderTopWidth: 1,
    borderTopColor: GLASS.border,
  },
  // A 48x44 touch target per button; the selected format gets a soft fill besides its tint.
  toolbarAction: {
    width: 48,
    height: 44,
    borderRadius: BORDER.normal,
  },
  toolbarActionSelected: {
    width: 48,
    height: 44,
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fillStrong,
  },
  firstToolbarAction: {
    marginLeft: PADDING_MARGIN.md,
  },
  lastToolbarAction: {
    marginRight: PADDING_MARGIN.md,
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
  richToolbarContainerDesktop: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
    // drop the full-width pin so the horizontal margins below actually inset the
    // bar from the window edges (the parent stretches it back to fill the gap).
    width: "auto",
    marginHorizontal: PADDING_MARGIN.lg,
    // A border all round: one more pixel than the pinned bar's top one.
    height: 44 + 2 * PADDING_MARGIN.sm + 2,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  richToolbarFlatContainer: {
    maxWidth: SIZE.full,
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

/* RICH TEXT STYLE */

const richTextSyle = `
  pre {
    background-color: ${COLOR.surfaceMuted};
  }
  img {
    width: auto;
    border-radius: ${BORDER.normal}px;
  }
`;
