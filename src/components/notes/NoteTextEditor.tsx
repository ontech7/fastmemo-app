import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import IconChip from "@/components/ui/IconChip";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";
import { useNoteEditor } from "@/hooks/useNoteEditor";
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
import { useFocusEffect } from "expo-router";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { runWhenIdle } from "@/utils/idle";
import { MagnifyingGlassIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { actions, RichEditor, RichToolbar } from "react-native-pell-rich-editor";
import { useSelector } from "react-redux";

interface Props {
  initialNote: TextNote;
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

  const { note, setNoteAsync, updateNoteWebhook } = useNoteEditor<TextNote>({
    initialNote: memoInitialNote,
    defaultType: "text",
    addWebhookSelector: selectorWebhook_addTextNote,
    addAction: "note/addTextNote",
    isEmpty,
    buildPayloadExtras,
  });

  const [noteTextLength, setNoteTextLength] = useState(getTextLength(note.text));
  const [noteTextSize, setNoteTextSize] = useState(getTextSize(note.text));

  const richTextEditor = useRef(null);

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    const task = runWhenIdle(() => {
      setEditorReady(true);
    });
    return () => task.cancel();
  }, []);

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

  const [isKeyboardShown, setIsKeyboardShown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        richTextEditor.current?.dismissKeyboard();
      };
    }, [])
  );

  useEffect(() => {
    const show = () => setIsKeyboardShown(true);
    const hide = () => setIsKeyboardShown(false);

    const subs = [
      Keyboard.addListener("keyboardWillShow", show),
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardWillHide", hide),
      Keyboard.addListener("keyboardDidHide", hide),
    ];

    return () => subs.forEach((s) => s.remove());
  }, []);

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
      heading1: require("../../assets/actions/heading1.png"),
    }),
    []
  );

  const plainNoteText = useMemo(() => stripHtml(note.text), [note.text]);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

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
              placeholder={t("note.title_placeholder")}
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
            {devMode.enabled && devMode.unlimitedTextSpace ? "∞" : `${convertToMB(configs.notes.sizeLimit)} MB`} /{" "}
            {convertToMB(noteTextSize)} MB
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          position: "relative",
          flex: 1,
          maxWidth: Platform.OS === "web" ? 800 : undefined,
          width: SIZE.full,
          marginHorizontal: Platform.OS === "web" ? "auto" : 0,
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

        {editorReady && (
          <View style={styles.editorWrapper}>
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
            />
          </View>
        )}

        {/* Auxiliary actions live in a dedicated bar below the editor (not floating over
            the text) so there is a clear separation from the rich text content. */}
        {editorReady && !note.readOnly && (showAiActions || showVoiceButton) && (
          <View style={styles.actionDock}>
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
                style={styles.dockAiButton}
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
                style={styles.dockVoiceButton}
              />
            )}
          </View>
        )}

        <DismissKeyboardButton
          showKeyboardDismiss={isKeyboardShown}
          onPress={() => richTextEditor.current?.dismissKeyboard()}
        />

        {editorReady && (
          <RichToolbar
            style={[
              styles.richToolbarContainer,
              Platform.OS === "web" && styles.richToolbarContainerDesktop,
              { display: Platform.OS !== "web" && !isKeyboardShown ? "none" : "flex" },
            ]}
            // On web, capping the inner list at the bar width (rather than pinning it to
            // 100%) lets it keep its intrinsic width when the icons fit — so the bar's
            // alignItems:center centers them — while still capping + falling back to
            // react-native-web's horizontal overflow-x scrolling on narrow viewports.
            flatContainerStyle={Platform.OS === "web" ? styles.richToolbarFlatContainer : undefined}
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
  );
}

const styles = StyleSheet.create({
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
  actionDock: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.lg,
    paddingHorizontal: PADDING_MARGIN.xl,
    paddingTop: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS.border,
  },
  dockAiButton: {
    position: "relative",
    bottom: 0,
    left: 0,
  },
  dockVoiceButton: {
    position: "relative",
    bottom: 0,
    right: 0,
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
