import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import EditorActionDock, { dockButtonStyle, dockGroupStyle } from "@/components/notes/EditorActionDock";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { useScreenTransitionEnd } from "@/hooks/useScreenTransitionEnd";
import { findCategoryByName, stripHtml } from "@/libs/ai";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MagnifyingGlassIcon } from "react-native-heroicons/outline";
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
const BAR_HEIGHT_ESTIMATE = 76;

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

  const { note, setNoteAsync, updateNoteWebhook, autoTitle } = useNoteEditor<TextNote>({
    initialNote: memoInitialNote,
    defaultType: "text",
    addWebhookSelector: selectorWebhook_addTextNote,
    addAction: "note/addTextNote",
    isEmpty,
    buildPayloadExtras,
    getTitleSource: (n) => stripHtml(n.text),
  });

  const [noteTextLength, setNoteTextLength] = useState(getTextLength(note.text));
  const [noteTextSize, setNoteTextSize] = useState(getTextSize(note.text));

  const richTextEditor = useRef(null);

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
  const isNewNote = useMemo(() => initialNote.createdAt === initialNote.updatedAt, [initialNote]);
  const transitionDone = useScreenTransitionEnd();
  const didFocusRef = useRef(false);

  // Focus once the editor's WebView bridge has actually initialized AND the
  // screen transition has settled. Focusing on a fixed timer instead raced the
  // bridge (so it often no-op'd) and fired mid-transition (causing the jumps).
  useEffect(() => {
    if (didFocusRef.current) return;
    if (!isNewNote || initialNote.readOnly) return;
    if (!editorInitialized || !transitionDone) return;
    didFocusRef.current = true;
    richTextEditor.current?.focusContentEditor();
  }, [editorInitialized, transitionDone, isNewNote, initialNote.readOnly]);

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
            <BackButton chip callback={updateNoteWebhook} />

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

            <TouchableOpacity style={styles.searchToggle} onPress={() => setShowFindReplace((prev) => !prev)}>
              <IconChip>
                <MagnifyingGlassIcon size={20} color={showFindReplace ? COLOR.accentSoft : COLOR.softWhite} />
              </IconChip>
            </TouchableOpacity>

            <NoteSettingsButton note={note} setNote={setNoteAsync} />
          </View>

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
              onChange={setText}
              initialContentHTML={initialNote.text}
              placeholder={t("note.description_placeholder")}
              pasteAsPlainText
              editorStyle={editorStyle}
              editorInitializedCallback={() => setEditorInitialized(true)}
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
                    noteTitle={note.title}
                    onTitleGenerated={(title) => setNoteAsync({ ...note, title })}
                    onSummaryGenerated={(summary) => {
                      richTextEditor.current?.setContentHTML(summary);
                      setText(summary);
                    }}
                    onCategorySuggested={(name) => {
                      const cat = findCategoryByName(name);
                      if (cat) setNoteAsync({ ...note, category: cat });
                    }}
                    onTextRewritten={(rewritten) => {
                      const html = voiceTextToHtml(rewritten, { leadingSpace: false });
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
                      const html = voiceTextToHtml(text);
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
            <RichToolbar
              style={[styles.richToolbarContainer, styles.richToolbarContainerDesktop]}
              // On web, capping the inner list at the bar width (rather than pinning it to
              // 100%) lets it keep its intrinsic width when the icons fit — so the bar's
              // alignItems:center centers them — while still capping + falling back to
              // react-native-web's horizontal overflow-x scrolling on narrow viewports.
              flatContainerStyle={styles.richToolbarFlatContainer}
              editor={richTextEditor}
              onPressAddImage={pickImage}
              iconSize={20}
              iconTint={COLOR.softWhite}
              selectedIconTint={COLOR.accentSoft}
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
            <RichToolbar
              style={styles.richToolbarContainer}
              editor={richTextEditor}
              onPressAddImage={pickImage}
              iconSize={20}
              iconTint={COLOR.softWhite}
              selectedIconTint={COLOR.accentSoft}
              actions={toolbarActions}
              iconMap={toolbarIconMap}
            />
          </View>
        </KeyboardStickyView>
      )}
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
    height: 38,
    backgroundColor: COLOR.surface,
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
