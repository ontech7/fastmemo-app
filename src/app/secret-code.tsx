import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import SafeAreaView from "@/components/SafeAreaView";
import { useRouter } from "@/hooks/useRouter";
import Haptics from "@/libs/haptics";
import { retrieveSecretCodeCallback } from "@/libs/registry";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

import BackButton from "@/components/buttons/BackButton";
import CodeInput from "@/components/inputs/CodeInput";
import AppBackground from "@/components/ui/AppBackground";
import { selectorCurrentSecretCode, setSecretCode } from "@/slicers/settingsSlice";

const getCodePhase = (t: (key: string) => string) => ({
  oldCode: t("secretcode.oldCode"),
  newCode: t("secretcode.newCode"),
  repeatCode: t("secretcode.repeatCode"),
  savedCode: t("secretcode.savedCode"),
  unlockCode: t("secretcode.unlockCode"),
});

export default function SecretCodeScreen() {
  const { t } = useTranslation();

  const callback = retrieveSecretCodeCallback();

  const { startPhase } = useLocalSearchParams<{ startPhase: string; noteId: string }>();

  const [phase, setPhase] = useState(startPhase);
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState(false);

  const router = useRouter();

  const dispatch = useDispatch();

  const currentSecretCode = useSelector(selectorCurrentSecretCode);

  const handleCodeChange = (code: string) => {
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

        callback?.();

        break;
      default:
        break;
    }
  };

  const onChangeCode = useCallback((text: string) => {
    setError(false);
    setCode(text);
  }, []);

  const onSubmit = useCallback(
    (codeValue: string) => {
      handleCodeChange(codeValue);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const codePhase = getCodePhase(t);
  const phaseText = codePhase[phase as keyof ReturnType<typeof getCodePhase>] || "";

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("secretcode.title")}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.codeInputWrapper}>
        {!error ? (
          <Text style={styles.codeTextSuggestion}>{phaseText}</Text>
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
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  codeInputWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  codeTextSuggestion: {
    color: COLOR.textSecondary,
    textAlign: "center",
    marginBottom: PADDING_MARGIN.xl,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.paragraph,
  },
});
