import * as Device from "expo-device";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import ProgressBar from "@/components/ui/ProgressBar";
import SelectableCardList, { type SelectableCardItem } from "@/components/lists/SelectableCardList";
import { selectorAIAssistant, selectorAIModelIsLegacy, setAIAssistant } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import type { AIModelId, AIModelInfo, ModelDownloadProgress } from "@/libs/ai";
import {
  addAIStatusListener,
  AI_MODELS,
  cancelDownload,
  DEFAULT_MODEL_ID,
  deleteModel,
  deleteOrphanedModelFiles,
  downloadModel,
  getDownloadFailure,
  getModelDownload,
  getOrphanedModelFiles,
  isModelDownloaded,
  isNativeModuleAvailable,
  releaseContext,
} from "@/libs/ai";

const MB = 1024 * 1024;
const GB = 1024 * MB;

const formatBytes = (bytes: number) => (bytes >= GB ? `${(bytes / GB).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`);

/** Bytes taken by model files no model of today uses (the Qwen 2.5 ones of earlier versions, partial downloads). */
const oldModelsBytes = async () => (await getOrphanedModelFiles()).reduce((sum, file) => sum + file.size, 0);

const subscribeToAI = (onChange: () => void) => addAIStatusListener(onChange);

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const aiSettings = useSelector(selectorAIAssistant);
  const storedModelIsLegacy = useSelector(selectorAIModelIsLegacy);
  const selectedModelId = aiSettings.selectedModel || DEFAULT_MODEL_ID;
  const [oldBytes, setOldBytes] = useState(0);
  const [confirmDeleteOld, setConfirmDeleteOld] = useState(false);

  const [modelDownloaded, setModelDownloaded] = useState(aiSettings.modelDownloaded);
  // A download goes on when the screen closes, the screen off or the app in the background (ADR-028): opened again, the
  // screen shows it.
  const download: ModelDownloadProgress | null = useSyncExternalStore(subscribeToAI, getModelDownload);
  const isDownloading = download !== null;
  const downloadProgress = download?.progress ?? 0;
  const [nativeAvailable, setNativeAvailable] = useState(true);

  const deviceRam = Device.totalMemory ?? 0;
  // The 2B where it runs comfortably (a 6 GB class phone and up), the 0.8B below.
  const recommendedId: AIModelId = deviceRam >= 5 * GB ? "qwen3.5-2b" : "qwen3.5-0.8b";

  const modelCardItems = useMemo<SelectableCardItem<AIModelId>[]>(() => {
    const models = Platform.OS === "web" ? [] : (Object.values(AI_MODELS) as AIModelInfo[]);
    return models.map((model) => {
      const canRun = deviceRam >= model.minRamBytes;
      return {
        id: model.id,
        label: model.name,
        description: t(model.description),
        extra: (
          <View style={styles.modelExtra}>
            {model.id === recommendedId && canRun && <Text style={styles.recommended}>{t("ai.recommended")}</Text>}
            <Text style={styles.modelSize}>{model.sizeLabel}</Text>
          </View>
        ),
        disabled: !canRun,
        disabledLabel: t("ai.model_unavailable"),
      };
    });
  }, [deviceRam, recommendedId, t]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (!isNativeModuleAvailable()) {
      setNativeAvailable(false);
      return;
    }

    const checkModel = async () => {
      const downloaded = await isModelDownloaded(selectedModelId);
      setModelDownloaded(downloaded);
      // A Qwen 2.5 id stored by an earlier version is stored as the tier replacing it (read so already).
      if (downloaded !== aiSettings.modelDownloaded || storedModelIsLegacy) {
        dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: downloaded }));
      }
    };

    checkModel();
    oldModelsBytes().then(setOldBytes);
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

  // A download's end, even one before the screen opened: done (the module turned the AI on), cancelled or failed.
  useEffect(() => {
    if (isDownloading || Platform.OS === "web") return;
    isModelDownloaded(selectedModelId).then(setModelDownloaded);
    // a download clears the old models' files
    oldModelsBytes().then(setOldBytes);
  }, [isDownloading, selectedModelId]);

  // A failure while the screen is open is said.
  useEffect(() => {
    if (Platform.OS === "web") return;
    return addAIStatusListener((status) => {
      const failure = status === "error" ? getDownloadFailure() : null;
      if (failure) toast(t(failure === "no_space" ? "ai.download_no_space" : "ai.download_failed"));
    });
  }, [t]);

  const handleDownload = useCallback(() => {
    if (Platform.OS === "web") return;
    void downloadModel(selectedModelId);
  }, [selectedModelId]);

  const handleCancelDownload = useCallback(async () => {
    if (Platform.OS === "web") return;
    await cancelDownload();
  }, []);

  const handleDeleteOld = useCallback(async () => {
    setConfirmDeleteOld(false);
    const freed = await deleteOrphanedModelFiles();
    setOldBytes(await oldModelsBytes());
    toast(t("ai.old_models_deleted", { size: formatBytes(freed) }));
  }, [t]);

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

      <ConfirmOrCancelDialog
        open={confirmDeleteOld}
        description={t("ai.old_models_confirm", { size: formatBytes(oldBytes) })}
        confirmLabel={t("ai.old_models_delete")}
        onConfirm={handleDeleteOld}
        onCancel={() => setConfirmDeleteOld(false)}
      />

      <ScrollView style={styles.scroll}>
        {/* The Qwen 2.5 files of earlier versions: dead weight now */}
        {oldBytes > 0 && !isDownloading && (
          <View style={[styles.sectionWrapper, styles.oldModelsCard]}>
            <Text style={styles.oldModelsTitle}>{t("ai.old_models_title", { size: formatBytes(oldBytes) })}</Text>
            <Text style={styles.oldModelsText}>{t("ai.old_models_desc")}</Text>
            <TouchableOpacity
              style={styles.oldModelsButton}
              onPress={() => setConfirmDeleteOld(true)}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.deleteText}>{t("ai.old_models_delete")}</Text>
            </TouchableOpacity>
          </View>
        )}

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
                  ? download.waiting
                    ? t("ai.download_waiting")
                    : `${t("ai.downloading")} ${Math.round(downloadProgress * 100)}%`
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
                  {download.waiting
                    ? t("ai.download_waiting")
                    : `${t("ai.downloading")} ${Math.round(downloadProgress * 100)}%`}
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
            <>
              <ProgressBar progress={downloadProgress} style={styles.progressBar} />
              <Text style={styles.downloadHint}>{t("ai.download_background")}</Text>
            </>
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
              { key: "ai.cap.summarize", min: "2B" },
              { key: "ai.cap.fix_grammar", min: "2B" },
              { key: "ai.cap.shorten", min: "2B" },
              { key: "ai.cap.translate", min: "2B" },
              { key: "ai.cap.suggest_items", min: "2B" },
              { key: "ai.cap.suggest_category" },
              { key: "ai.cap.voice_cleanup" },
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
    fontSize: FONTSIZE.subtitle,
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
  progressBar: {
    marginTop: PADDING_MARGIN.sm,
  },
  downloadHint: {
    marginTop: PADDING_MARGIN.sm,
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
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
  modelExtra: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  recommended: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
    overflow: "hidden",
  },
  oldModelsCard: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    padding: PADDING_MARGIN.lg,
    gap: PADDING_MARGIN.sm,
  },
  oldModelsTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  oldModelsText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 18,
  },
  oldModelsButton: {
    alignSelf: "flex-start",
    paddingVertical: PADDING_MARGIN.xs,
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
