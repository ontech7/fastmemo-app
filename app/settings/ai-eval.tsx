import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import type { EvalReport, EvalResult } from "@/libs/ai";
import { AI_MODELS, DEFAULT_MODEL_ID, isModelDownloaded, isNativeModuleAvailable, runAIEval } from "@/libs/ai";
import { selectorAIAssistant } from "@/slicers/settingsSlice";

/**
 * Developer options -> AI evaluation: the fixed inputs of `evalFixtures` run on the selected model, with the load time,
 * each action's time and speed, and its output. The report is saved as JSON and can be shared (docs/AI_QWEN35_UPGRADE.md §8).
 */
export default function AIEvalScreen() {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);
  const modelId = aiSettings.selectedModel || DEFAULT_MODEL_ID;
  const available = Platform.OS !== "web" && isNativeModuleAvailable();

  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<EvalResult[]>([]);
  const [report, setReport] = useState<EvalReport | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (available) isModelDownloaded(modelId).then(setDownloaded);
  }, [available, modelId]);

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
    setFailed(false);
    setResults([]);
    setReport(null);
    setProgress({ done: 0, total: 0 });
    const done = await runAIEval(
      modelId,
      (result, count, total) => {
        setResults((previous) => [...previous, result]);
        setProgress({ done: count, total });
      },
      () => stopRef.current
    );
    setRunning(false);
    if (done) setReport(done);
    else setFailed(true);
  };

  const share = () => {
    if (report?.file) Sharing.shareAsync(report.file, { mimeType: "application/json" });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("aieval.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!available ? (
          <Text style={styles.message}>{t("aieval.unavailable")}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.modelName}>{AI_MODELS[modelId]?.name ?? modelId}</Text>
              {downloaded === false && <Text style={styles.message}>{t("aieval.no_model")}</Text>}
              {report && <Text style={styles.meta}>{t("aieval.load", { ms: report.loadMs })}</Text>}
              {(running || progress.total > 0) && (
                <Text style={styles.meta}>{t("aieval.progress", { done: progress.done, total: progress.total })}</Text>
              )}
              {failed && <Text style={styles.error}>{t("aieval.failed")}</Text>}

              <View style={styles.actions}>
                {running ? (
                  <TouchableOpacity style={styles.button} onPress={() => (stopRef.current = true)} activeOpacity={0.7}>
                    <Text style={styles.buttonText}>{t("aieval.stop")}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, !downloaded && styles.buttonDisabled]}
                    onPress={run}
                    disabled={!downloaded}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.buttonText}>{t("aieval.run")}</Text>
                  </TouchableOpacity>
                )}
                {report?.file && !running && (
                  <TouchableOpacity style={styles.button} onPress={share} activeOpacity={0.7}>
                    <Text style={styles.buttonText}>{t("aieval.share")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {results.map((result) => (
              <View key={result.id} style={styles.result}>
                <Text style={styles.resultHead}>
                  {`${result.id} · ${result.ms} ms`}
                  {result.timings?.predictedMs
                    ? ` · ${Math.round((result.timings.predictedN * 1000) / result.timings.predictedMs)} tok/s`
                    : ""}
                </Text>
                <Text style={[styles.resultOutput, !result.success && styles.error]} numberOfLines={6}>
                  {result.success ? result.output : (result.error ?? "")}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
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
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  scrollContent: {
    paddingBottom: PADDING_MARGIN.xl * 2,
    gap: PADDING_MARGIN.md,
  },
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.lg,
    gap: PADDING_MARGIN.xs,
  },
  modelName: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  meta: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  message: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  error: {
    color: COLOR.importantIcon,
  },
  actions: {
    flexDirection: "row",
    gap: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.md,
  },
  button: {
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.lg,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    borderWidth: 1,
    borderColor: COLOR.accentMutedBorder,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  result: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.md,
    gap: PADDING_MARGIN.xs,
  },
  resultHead: {
    color: COLOR.textMuted,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
  resultOutput: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
  },
});
