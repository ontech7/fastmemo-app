import { configs } from "@/configs";
import { useFocusEffect } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Keyboard, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView, KeyboardController } from "react-native-keyboard-controller";
import { actions, RichEditor, RichToolbar } from "react-native-pell-rich-editor";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import DismissKeyboardButton from "@/components/buttons/DismissKeyboardButton";
import NoteSettingsButton from "@/components/buttons/NoteSettingsButton";
import VoiceRecognitionButton from "@/components/buttons/VoiceRecognitionButton.native";
import SafeAreaView from "@/components/SafeAreaView";
import { storeDirtyNoteId } from "@/libs/registry";
import { addNote, deleteNote, temporaryDeleteNote } from "@/slicers/notesSlice";
import {
  selectorWebhook_addTextNote,
  selectorWebhook_deleteNote,
  selectorWebhook_temporaryDeleteNote,
  selectorWebhook_updateNote,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { convertToMB, getTextLength, getTextSize, isStringEmpty } from "@/utils/string";
import { toast } from "@/utils/toast";
import { webhook } from "@/utils/webhook";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function NoteTextEditor({ initialNote }) {
  const { t } = useTranslation();

  const webhook_addTextNote = useSelector(selectorWebhook_addTextNote);
  const webhook_updateNote = useSelector(selectorWebhook_updateNote);
  const webhook_deleteNote = useSelector(selectorWebhook_deleteNote);
  const webhook_temporaryDeleteNote = useSelector(selectorWebhook_temporaryDeleteNote);

  const dispatch = useDispatch();

  const [note, setNote] = useState({
    ...initialNote,
    type: initialNote.type || "text",
  });

  const [noteTextLength, setNoteTextLength] = useState(getTextLength(note.text));
  const [noteTextSize, setNoteTextSize] = useState(getTextSize(note.text));

  const isNewlyCreated = note.createdAt === note.updatedAt;

  useEffect(() => {
    if (!isNewlyCreated) {
      return;
    }

    webhook(webhook_addTextNote, {
      action: "note/addTextNote",
      id: note.id,
      type: note.type || "text",
      title: note.title,
      text: note.text,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      important: note.important,
      readOnly: note.readOnly,
      hidden: note.hidden,
      locked: note.locked,
      category: {
        iconId: note.category.icon,
        name: note.category.name,
      },
    });
  }, [isNewlyCreated]);

  const updateNoteGlobal = useCallback(
    (currNote) => {
      if (isStringEmpty(currNote.title) && isStringEmpty(currNote.text)) {
        dispatch(temporaryDeleteNote(currNote.id));
        dispatch(deleteNote(currNote.id));
      } else {
        dispatch(
          addNote({
            ...currNote,
            type: currNote.type || "text",
            updatedAt: Date.now(),
            date: formatDateTime(),
          })
        );
      }
    },
    [dispatch]
  );

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
  }, [note.id]);

  useEffect(() => {
    return () => {
      dirtyRef.current = false;
    };
  }, []);

  const setNoteAsync = useCallback(
    (currNote) => {
      if (!dirtyRef.current) {
        storeDirtyNoteId(currNote.id);
        dirtyRef.current = true;
      }
      setNote(currNote);
      updateNoteGlobal(currNote);
    },
    [updateNoteGlobal]
  );

  const richTextEditor = useRef(null);

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
    (titleVal) => {
      setNoteAsync({ ...note, title: titleVal });
    },
    [note, setNoteAsync]
  );

  const setText = useCallback(
    (textVal) => {
      const textSize = getTextSize(textVal);

      if (textSize > configs.notes.sizeLimit) {
        toast(t("noteLimitReached"));
        richTextEditor.current?.setContentHTML(note.text); // revert
        return;
      }

      setNoteTextLength(getTextLength(textVal));
      setNoteTextSize(textSize);

      setNoteAsync({ ...note, text: textVal });
    },
    [note, setNoteAsync, t]
  );

  const updateNoteWebhook = useCallback(async () => {
    if (isStringEmpty(note.title) && isStringEmpty(note.text)) {
      await webhook(webhook_temporaryDeleteNote, {
        action: "note/temporaryDeleteNote",
        id: note.id,
      });
      await webhook(webhook_deleteNote, {
        action: "note/deleteNote",
        id: note.id,
      });
    } else {
      await webhook(webhook_updateNote, {
        action: "note/updateNote",
        id: note.id,
        type: note.type || "text",
        title: note.title,
        text: note.text,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        important: note.important,
        readOnly: note.readOnly,
        hidden: note.hidden,
        locked: note.locked,
        category: {
          iconId: note.category.icon,
          name: note.category.name,
        },
      });
    }
  }, [note, webhook_updateNote, webhook_deleteNote, webhook_temporaryDeleteNote]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      updateNoteWebhook();
      return false;
    });

    return () => backHandler.remove();
  }, [updateNoteWebhook]);

  const [isKeyboardShown, setIsKeyboardShown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        KeyboardController.dismiss();
        Keyboard.dismiss();
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

          <NoteSettingsButton note={note} setNote={setNoteAsync} />
        </View>

        <View style={styles.subtitleWrapper}>
          <Text style={[styles.subtitle, { flexGrow: 1 }]}>
            {noteTextLength} {t("note.characters")}
          </Text>
          <Text style={[styles.subtitle, { flexGrow: 1 }]}>
            {convertToMB(configs.notes.sizeLimit)} MB / {convertToMB(noteTextSize)} MB
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
