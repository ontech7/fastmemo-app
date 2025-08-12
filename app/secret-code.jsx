import React, { useCallback, useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import { retrieveNote, retrieveSecretCodeCallback, storeNote } from "@/libs/registry";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import BackButton from "../components/buttons/BackButton";
import CodeInput from "../components/inputs/CodeInput";
import { toggleProtectedNotes } from "../slicers/notesSlice";
import { selectorCurrentSecretCode, setSecretCode } from "../slicers/settingsSlice";

const CODE_PHASE = {
  oldCode: i18n.t("secretcode.oldCode"),
  newCode: i18n.t("secretcode.newCode"),
  repeatCode: i18n.t("secretcode.repeatCode"),
  savedCode: i18n.t("secretcode.savedCode"),
  unlockCode: i18n.t("secretcode.unlockCode"),
  toggleProtectedNote: i18n.t("secretcode.toggleProtectedNote"),
  toggleProtectedSelectedNotes: i18n.t("secretcode.toggleProtectedSelectedNotes"),
  toggleCloudSync: i18n.t("secretcode.toggleCloudSync"),
  toggleGeneric: i18n.t("secretcode.toggleGeneric"),
};

export default function SecretCodeScreen() {
  const { t } = useTranslation();

  const note = retrieveNote();
  const callback = retrieveSecretCodeCallback();

  const { startPhase, selectedNotes } = useLocalSearchParams();

  const [phase, setPhase] = useState(startPhase);
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState(false);

  const router = useRouter();

  const dispatch = useDispatch();

  const currentSecretCode = useSelector(selectorCurrentSecretCode);

  const handleCodeChange = (code) => {
    switch (phase) {
      case "oldCode":
        if (code !== currentSecretCode) {
          setError(true);
          return;
        }

        setPhase("newCode");
        setCode("");

        break;
      case "newCode":
        setNewCode(code);
        setPhase("repeatCode");
        setCode("");

        break;
      case "repeatCode":
        if (code !== newCode) {
          setError(true);
          return;
        }

        dispatch(setSecretCode(code));
        setPhase("savedCode");
        setTimeout(() => {
          setCode("");
          router.back();
        }, 1500);

        break;
      case "unlockCode":
        if (code !== currentSecretCode) {
          setError(true);
          return;
        }

        router.replace((note.type || "text") === "text" ? "/notes/text" : "/notes/todo");

        break;
      case "toggleProtectedNote":
        if (code !== currentSecretCode) {
          setError(true);
          return;
        }

        storeNote({ ...note, locked: !note.locked });

        router.push((note.type || "text") === "text" ? "/notes/text" : "/notes/todo");

        break;
      case "toggleProtectedSelectedNotes":
        if (code !== currentSecretCode) {
          setError(true);
          return;
        }

        dispatch(toggleProtectedNotes(selectedNotes));

        router.dismissAll();

        break;
      case "toggleGeneric":
        if (code !== currentSecretCode) {
          setError(true);
          return;
        }

        callback();

        router.dismiss();

        break;
      default:
        break;
    }
  };

  const onChangeCode = useCallback((text) => {
    setError(false);
    setCode(text);
  }, []);

  const onSubmit = useCallback(
    (codeValue) => {
      handleCodeChange(codeValue);
    },
    [phase]
  );

  // vibration feedback when error and reset state
  useEffect(() => {
    if (!error) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    setTimeout(() => {
      setCode("");
      setError(false);
    }, 750);
  }, [error]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("secretcode.title")}</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <View style={styles.codeInputWrapper}>
        {!error ? (
          <Text style={styles.codeTextSuggestion}>{CODE_PHASE[phase]}</Text>
        ) : (
          <Text style={[styles.codeTextSuggestion, { color: COLOR.important, marginBottom: PADDING_MARGIN.xl }]}>
            {t("secretcode.error")}
          </Text>
        )}

        <CodeInput value={code} onChangeCode={onChangeCode} onSubmit={onSubmit} disabled={error} />
      </View>
    </SafeAreaView>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  codeInputWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  codeTextSuggestion: {
    color: COLOR.softWhite,
    textAlign: "center",
    marginBottom: PADDING_MARGIN.xl,
    fontSize: FONTSIZE.paragraph,
  },
});
