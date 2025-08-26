import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowPathIcon } from "react-native-heroicons/outline";
import { useDispatch } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import SafeAreaView from "@/components/SafeAreaView";
import { addNote } from "@/slicers/notesSlice";
import { defaultNote } from "@/configs/default";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import CodeInput from "../../components/inputs/CodeInput";
import { setSecretCode } from "../../slicers/settingsSlice";

const CODE_PHASE = {
  firstCode: [i18n.t("setupcode.firstCode_1"), i18n.t("setupcode.firstCode_2")],
  repeatCode: [i18n.t("setupcode.repeatCode")],
  savedCode: [i18n.t("setupcode.savedCode")],
};

export default function SetupSecretCodeScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const [phase, setPhase] = useState("firstCode");
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState(false);

  const dispatch = useDispatch();

  const handleCodeChange = (code) => {
    switch (phase) {
      case "firstCode":
        setNewCode(code);
        setPhase("repeatCode");
        setCode("");
        break;
      case "repeatCode":
        if (code !== newCode) {
          setError(true);
          return;
        }

        AsyncStorage.setItem("@firstScreen", "/home");

        dispatch(setSecretCode(code));
        dispatch(addNote(defaultNote()));

        setPhase("savedCode");
        setTimeout(() => {
          setCode("");
          router.replace("/home");
        }, 1500);
        break;
      default:
        break;
    }
  };

  const onChangeCode = useCallback((text) => {
    setError(false);
    setCode(text);
  }, []);

  const onSubmit = useCallback((codeValue) => handleCodeChange(codeValue), [phase]);

  const redoInsert = () => {
    setPhase("firstCode");
    setNewCode("");
    setCode("");
    setError(false);
  };

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
        <View style={styles.headerSide} />

        <Text style={styles.headerTitle}>{t("setupcode.title")}</Text>

        <TouchableOpacity activeOpacity={0.7} onPress={redoInsert}>
          <ArrowPathIcon size={28} color={COLOR.softWhite} />
        </TouchableOpacity>

        <View style={styles.headerSide} />
      </View>

      <View style={styles.codeInputWrapper}>
        {!error ? (
          CODE_PHASE[phase].map((msg, idx) => (
            <Text
              key={idx}
              style={[styles.codeTextSuggestion, idx === CODE_PHASE[phase].length - 1 && styles.codeTextSuggestionLast]}
            >
              {msg}
            </Text>
          ))
        ) : (
          <Text style={[styles.codeTextSuggestion, styles.codeTextSuggestionError]}>{t("setupcode.error")}</Text>
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
  headerSide: {
    padding: PADDING_MARGIN.md,
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
    fontSize: FONTSIZE.paragraph,
  },
  codeTextSuggestionLast: {
    marginBottom: PADDING_MARGIN.xl,
  },
  codeTextSuggestionError: {
    color: COLOR.important,
    marginBottom: PADDING_MARGIN.xl,
  },
});
