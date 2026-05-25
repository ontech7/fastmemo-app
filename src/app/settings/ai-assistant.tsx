import * as Device from "expo-device";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import SelectableCardList, { type SelectableCardItem } from "@/components/lists/SelectableCardList";
import { selectorAIAssistant, setAIAssistant } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import type { AIModelId, AIModelInfo } from "@/libs/ai";
import {
  AI_MODELS,
  cancelDownload,
  DEFAULT_MODEL_ID,
  deleteModel,
  downloadModel,
  isModelDownloaded,
  isNativeModuleAvailable,
  releaseContext,
} from "@/libs/ai";

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const aiSettings = useSelector(selectorAIAssistant);
  const selectedModelId = aiSettings.selectedModel || DEFAULT_MODEL_ID;

  const [modelDownloaded, setModelDownloaded] = useState(aiSettings.modelDownloaded);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [nativeAvailable, setNativeAvailable] = useState(true);

  const deviceRam = Device.totalMemory ?? 0;

  const modelCardItems = useMemo<SelectableCardItem<AIModelId>[]>(() => {
    const models = Platform.OS === "web" ? [] : (Object.values(AI_MODELS) as AIModelInfo[]);
    return models.map((model) => {
      const canRun = deviceRam >= model.minRamBytes;
      return {
        id: model.id,
        label: model.name,
        description: t(model.description),
        extra: <Text style={styles.modelSize}>{model.sizeLabel}</Text>,
        disabled: !canRun,
        disabledLabel: t("ai.model_unavailable"),
      };
    });
  }, [deviceRam, t]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (!isNativeModuleAvailable()) {
      setNativeAvailable(false);
      return;
    }

    const checkModel = async () => {
      const downloaded = await isModelDownloaded(selectedModelId);
      setModelDownloaded(downloaded);
      if (downloaded !== aiSettings.modelDownloaded) {
        dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: downloaded }));
      }
    };

    checkModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId]);

  const selectModel = useCallback(
    async (modelId: AIModelId) => {
      if (Platform.OS === "web" || modelId === selectedModelId) return;

      // Release current context when switching models
      releaseContext();

      const downloaded = await isModelDownloaded(modelId);
      setModelDownloaded(downloaded);
      dispatch(
        setAIAssistant({
          ...aiSettings,
          selectedModel: modelId,
          modelDownloaded: downloaded,
          enabled: downloaded ? aiSettings.enabled : false,
        })
      );
    },
    [aiSettings, selectedModelId, dispatch]
  );

  const toggleEnabled = useCallback(
    (value: boolean) => {
      dispatch(setAIAssistant({ ...aiSettings, enabled: value }));
      if (!value && Platform.OS !== "web") releaseContext();
    },
    [aiSettings, dispatch]
  );

  const handleDownload = useCallback(async () => {
    if (Platform.OS === "web") return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const success = await downloadModel(selectedModelId, (progress) => {
      setDownloadProgress(progress);
    });

    setIsDownloading(false);
    setModelDownloaded(success);
    dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: success, enabled: success ? aiSettings.enabled : false }));
  }, [aiSettings, selectedModelId, dispatch]);

  const handleCancelDownload = useCallback(async () => {
    if (Platform.OS === "web") return;

    await cancelDownload();
    setIsDownloading(false);
    setDownloadProgress(0);
    setModelDownloaded(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (Platform.OS === "web") return;

    await deleteModel(selectedModelId);
    setModelDownloaded(false);
    dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: false, enabled: false }));
  }, [aiSettings, selectedModelId, dispatch]);

  if (Platform.OS === "web" || !nativeAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <BackButton chip />
          <Text style={styles.headerTitle}>{t("ai.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.unavailableContainer}>
          <Text style={styles.unavailableText}>
            {Platform.OS === "web" ? t("ai.unavailable_web") : t("ai.native_rebuild_needed")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("ai.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Model selection */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("ai.model")}</Text>
          </View>

          <SelectableCardList<AIModelId> items={modelCardItems} selectedId={selectedModelId} onSelect={selectModel} />
        </View>

        {/* Status + Download/Delete */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionList}>
            <View style={styles.sectionItemList}>
              <Text style={styles.sectionItemList_title}>{t("ai.status")}</Text>
              <Text style={[styles.sectionItemList_text, modelDownloaded && styles.statusReady]}>
                {isDownloading
                  ? `${t("ai.downloading")} ${Math.round(downloadProgress * 100)}%`
                  : modelDownloaded
                    ? t("ai.downloaded")
                    : t("ai.not_downloaded")}
              </Text>
            </View>

            {!modelDownloaded && !isDownloading && (
              <TouchableOpacity
                style={[styles.sectionItemList, styles.sectionItemList_last, styles.actionButton]}
                onPress={handleDownload}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionItemList_title, styles.actionText]}>{t("ai.download_model")}</Text>
              </TouchableOpacity>
            )}
            {isDownloading && (
              <View style={[styles.sectionItemList, styles.sectionItemList_last, styles.downloadingRow]}>
                <Text style={[styles.sectionItemList_title, styles.actionText]}>
                  {`${t("ai.downloading")} ${Math.round(downloadProgress * 100)}%`}
                </Text>
                <TouchableOpacity onPress={handleCancelDownload} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>{t("ai.cancel")}</Text>
                </TouchableOpacity>
              </View>
            )}
            {modelDownloaded && !isDownloading && (
              <TouchableOpacity
                style={[styles.sectionItemList, styles.sectionItemList_last, styles.deleteButton]}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionItemList_title, styles.deleteText]}>{t("ai.delete_model")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isDownloading && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
            </View>
          )}
        </View>

        {/* Settings toggles */}
        {modelDownloaded && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>{t("ai.settings")}</Text>
            </View>

            <View style={styles.sectionList}>
              <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
                <Text style={styles.sectionItemList_title}>{t("ai.enabled")}</Text>
                <Switch
                  trackColor={{ false: COLOR.surfaceMuted, true: COLOR.accentMuted }}
                  thumbColor={COLOR.softWhite}
                  onValueChange={toggleEnabled}
                  value={aiSettings.enabled}
                  style={{ height: 25 }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Capabilities */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("ai.capabilities_title")}</Text>
          </View>

          <View style={styles.sectionList}>
            {[
              { key: "ai.cap.generate_title" },
              { key: "ai.cap.summarize", min: "1.5B" },
              { key: "ai.cap.continue_writing", min: "1.5B" },
              { key: "ai.cap.format_text", min: "3B" },
              { key: "ai.cap.suggest_items" },
              { key: "ai.cap.suggest_category" },
              { key: "ai.cap.explain_code", min: "7B" },
              { key: "ai.cap.add_comments", min: "7B" },
            ].map((item, index, arr) => (
              <View key={item.key} style={[styles.capabilityItem, index === arr.length - 1 && styles.sectionItemList_last]}>
                <Text style={styles.capabilityText}>{t(item.key)}</Text>
                {item.min && (
                  <Text style={styles.capabilityMin}>
                    {t("ai.editor.min_model")} {item.min}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={[styles.sectionWrapper, { marginBottom: PADDING_MARGIN.xl * 2 }]}>
          <Text style={styles.infoText}>{t("ai.info")}</Text>
        </View>
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
  scroll: {
    paddingHorizontal: PADDING_MARGIN.lg,
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
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
  },
  sectionHeaderTitle: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontFamily: FONT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  statusReady: {
    color: COLOR.codeMint,
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: COLOR.importantIcon,
    fontFamily: FONT.semiBold,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLOR.surfaceMuted,
    borderRadius: 2,
    marginTop: PADDING_MARGIN.sm,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLOR.accentMuted,
    borderRadius: 2,
  },
  infoText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 18,
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  unavailableText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
  },
  modelSize: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  capabilityItem: {
    backgroundColor: COLOR.surface,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  capabilityText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 20,
  },
  capabilityMin: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small - 1,
    marginTop: 2,
  },
  downloadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelText: {
    color: COLOR.important,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
});
