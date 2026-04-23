import AIEditorActions from "@/components/ai/AIEditorActions";
import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton";
import FindReplaceBar from "@/components/notes/FindReplaceBar";
import SafeAreaView from "@/components/SafeAreaView";
import { configs } from "@/configs";
import { useNoteEditor } from "@/hooks/useNoteEditor";
import { findCategoryByName, stripHtml } from "@/libs/ai";
import { selectorDeveloperMode, selectorWebhook_addTextNote } from "@/slicers/settingsSlice";
import { convertToMB, getTextLength, getTextSize, isStringEmpty } from "@/utils/string";
import { toast } from "@/utils/toast";
import { useFocusEffect } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MagnifyingGlassIcon } from "react-native-heroicons/outline";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { actions, RichEditor, RichToolbar } from "react-native-pell-rich-editor";
import { useSelector } from "react-redux";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import type { TextNote } from "@/types";

interface Props {
  initialNote: TextNote;
}

export default function NoteTextEditor({ initialNote }: Props) {
  const { t } = useTranslation();

  const devMode = useSelector(selectorDeveloperMode);

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
      setNoteAsync({ ...note, title: titleVal });
    },
    [note, setNoteAsync]
  );

  const setText = useCallback(
    (textVal: string) => {
      const textSize = getTextSize(textVal);

      const isUnlimited = devMode.enabled && devMode.unlimitedTextSpace;
      if (!isUnlimited && textSize > configs.notes.sizeLimit) {
        toast(t("noteLimitReached"));
        richTextEditor.current?.setContentHTML(note.text); // revert
        return;
      }

      setNoteTextLength(getTextLength(textVal));
      setNoteTextSize(textSize);

      setNoteAsync({ ...note, text: textVal });
    },
    [note, setNoteAsync, t, devMode]
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

  return (
    <SafeAreaView style={styles.container}>
      <View>
        <View style={styles.header}>
          <BackButton callback={updateNoteWebhook} />

          <View style={{ flexGrow: 1 }}>
            <TextInput
              style={styles.titleInput}
              onChangeText={setTitle}
              value={note.title}
              editable={!note.readOnly}
              cursorColor={COLOR.softWhite}
              placeholder={t("note.title_placeholder")}
              placeholderTextColor={COLOR.placeholder}
              maxLength={96}
            />
          </View>

          <TouchableOpacity
            style={{ padding: PADDING_MARGIN.sm, marginRight: PADDING_MARGIN.xs }}
            onPress={() => setShowFindReplace((prev) => !prev)}
          >
            <MagnifyingGlassIcon size={22} color={showFindReplace ? COLOR.oceanBreeze : COLOR.softWhite} />
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
          plainText={stripHtml(note.text)}
          style={{ marginTop: PADDING_MARGIN.md }}
        />

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
          editorStyle={{
            backgroundColor: COLOR.darkBlue,
            color: COLOR.softWhite,
            placeholderColor: COLOR.placeholder,
            cssText: richTextSyle,
          }}
        />

        <DismissKeyboardButton
          showKeyboardDismiss={isKeyboardShown}
          onPress={() => richTextEditor.current?.dismissKeyboard()}
        />

        <RichToolbar
          style={[
            styles.richToolbarContainer,
            Platform.OS === "web" && styles.richToolbarContainerDesktop,
            { display: Platform.OS !== "web" && !isKeyboardShown ? "none" : "flex" },
          ]}
          editor={richTextEditor}
          onPressAddImage={pickImage}
          iconSize={20}
          iconTint={COLOR.softWhite}
          selectedIconTint={COLOR.lightBlue}
          actions={[
            actions.insertImage,
            actions.heading1,
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.alignLeft,
            actions.alignCenter,
            actions.setSubscript,
            actions.setSuperscript,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.code,
          ]}
          iconMap={{
            heading1: require("../../assets/actions/heading1.png"),
          }}
        />

        {!note.readOnly && (
          <VoiceRecognitionButton
            setTranscript={(transcript, isFinal) => {
              richTextEditor.current?.setContentHTML(note.text + " " + transcript);
              if (isFinal) setText(note.text + " " + transcript);
            }}
            style={{ right: 40 }}
          />
        )}

        {!note.readOnly && (
          <AIEditorActions
            noteType="text"
            getContent={() => stripHtml(note.text)}
            noteTitle={note.title}
            onTitleGenerated={(title) => setNoteAsync({ ...note, title })}
            onSummaryGenerated={(summary) => {
              richTextEditor.current?.setContentHTML(summary);
              setText(summary);
            }}
            onContinueGenerated={(continuation) => {
              const newText = note.text + " " + continuation;
              richTextEditor.current?.setContentHTML(newText);
              setText(newText);
            }}
            onTextFormatted={(html) => {
              richTextEditor.current?.setContentHTML(html);
              setText(html);
            }}
            onCategorySuggested={(name) => {
              const cat = findCategoryByName(name);
              if (cat) setNoteAsync({ ...note, category: cat });
            }}
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
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  titleInput: {
    textAlign: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    marginHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
    borderRadius: BORDER.normal,
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
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.lightBlue,
  },
  richTextContainer: {
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingTop: PADDING_MARGIN.lg,
    paddingBottom: PADDING_MARGIN.xs,
  },
  richToolbarContainer: {
    width: SIZE.full,
    height: 38,
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.normal,
  },
  richToolbarContainerDesktop: {
    borderRadius: BORDER.normal,
  },
  textWrapper: {
    marginVertical: PADDING_MARGIN.xl,
  },
  text: {
    fontSize: FONTSIZE.paragraph,
    lineHeight: 24,
    color: COLOR.softWhite,
    paddingBottom: PADDING_MARGIN.lg,
  },
});

/* RICH TEXT STYLE */

const richTextSyle = `
  pre {
    background-color: ${COLOR.blue};
  }
  img {
    width: auto;
    border-radius: ${BORDER.normal}px;
  }
`;
