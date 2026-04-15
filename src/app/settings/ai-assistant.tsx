import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { CheckCircleIcon } from "react-native-heroicons/solid";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import { selectorAIAssistant, setAIAssistant } from "@/slicers/settingsSlice";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import type { AIModelId, AIModelInfo } from "@/libs/ai";
import { DEFAULT_MODEL_ID } from "@/libs/ai";

// Dynamic import to avoid web/Tauri crash
let aiLib: typeof import("@/libs/ai") | null = null;
if (Platform.OS !== "web") {
  aiLib = require("@/libs/ai");
}

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const aiSettings = useSelector(selectorAIAssistant);
  const selectedModelId = aiSettings.selectedModel || DEFAULT_MODEL_ID;

  const [modelDownloaded, setModelDownloaded] = useState(aiSettings.modelDownloaded);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [nativeAvailable, setNativeAvailable] = useState(true);

  const models = aiLib ? (Object.values(aiLib.AI_MODELS) as AIModelInfo[]) : [];
  const selectedModel = aiLib ? aiLib.AI_MODELS[selectedModelId] : null;

  useEffect(() => {
    if (!aiLib) return;

    if (!aiLib.isNativeModuleAvailable()) {
      setNativeAvailable(false);
      return;
    }

    const checkModel = async () => {
      const downloaded = await aiLib!.isModelDownloaded(selectedModelId);
      setModelDownloaded(downloaded);
      if (downloaded !== aiSettings.modelDownloaded) {
        dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: downloaded }));
      }
    };

    checkModel();
  }, [selectedModelId]);

  const selectModel = useCallback(
    async (modelId: AIModelId) => {
      if (!aiLib || modelId === selectedModelId) return;

      // Release current context when switching models
      aiLib.releaseContext();

      const downloaded = await aiLib!.isModelDownloaded(modelId);
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
      if (!value && aiLib) aiLib.releaseContext();
    },
    [aiSettings, dispatch]
  );

  const handleDownload = useCallback(async () => {
    if (!aiLib) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const success = await aiLib.downloadModel(selectedModelId, (progress) => {
      setDownloadProgress(progress);
    });

    setIsDownloading(false);
    setModelDownloaded(success);
    dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: success, enabled: success ? aiSettings.enabled : false }));
  }, [aiSettings, selectedModelId, dispatch]);

  const handleCancelDownload = useCallback(async () => {
    if (!aiLib) return;

    await aiLib.cancelDownload();
    setIsDownloading(false);
    setDownloadProgress(0);
    setModelDownloaded(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!aiLib) return;

    await aiLib.deleteModel(selectedModelId);
    setModelDownloaded(false);
    dispatch(setAIAssistant({ ...aiSettings, modelDownloaded: false, enabled: false }));
  }, [aiSettings, selectedModelId, dispatch]);

  if (Platform.OS === "web" || !nativeAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>{t("ai.title")}</Text>
          <View style={{ padding: PADDING_MARGIN.md }} />
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
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("ai.title")}</Text>
        <View style={{ padding: PADDING_MARGIN.md }} />
      </View>

      <ScrollView>
        {/* Model selection */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("ai.model")}</Text>
          </View>

          <View style={styles.sectionList}>
            {models.map((model, index) => {
              const isSelected = model.id === selectedModelId;
              const isLast = index === models.length - 1;
              return (
                <TouchableOpacity
                  key={model.id}
                  style={[styles.modelItem, isLast && styles.sectionItemList_last, isSelected && styles.modelItemSelected]}
                  onPress={() => selectModel(model.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.modelHeader}>
                      <Text style={[styles.sectionItemList_title, isSelected && styles.modelTextSelected]}>{model.name}</Text>
                      <Text style={styles.modelSize}>{model.sizeLabel}</Text>
                    </View>
                    <Text style={styles.modelDescription}>{t(model.description)}</Text>
                  </View>
                  {isSelected && <CheckCircleIcon size={20} color={COLOR.oceanBreeze} />}
                </TouchableOpacity>
              );
            })}
          </View>
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
              <View style={styles.sectionItemList}>
                <Text style={styles.sectionItemList_title}>{t("ai.enabled")}</Text>
                <Switch
                  trackColor={{ false: COLOR.lightGray, true: COLOR.darkOceanBreeze + "60" }}
                  thumbColor={aiSettings.enabled ? COLOR.oceanBreeze : COLOR.softWhite}
                  onValueChange={toggleEnabled}
                  value={aiSettings.enabled}
                  style={{ height: 25 }}
                />
              </View>

              <View style={[styles.sectionItemList, styles.sectionItemList_last]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionItemList_title}>{t("ai.voice_only")}</Text>
                  <Text style={styles.voiceOnlyHint}>{t("ai.voice_only_hint")}</Text>
                </View>
                <Switch
                  trackColor={{ false: COLOR.lightGray, true: COLOR.darkOceanBreeze + "60" }}
                  thumbColor={aiSettings.voiceOnly ? COLOR.oceanBreeze : COLOR.softWhite}
                  onValueChange={(value) => {
                    dispatch(setAIAssistant({ ...aiSettings, voiceOnly: value }));
                  }}
                  value={aiSettings.voiceOnly || false}
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
              "ai.cap.create_note",
              "ai.cap.create_todo",
              "ai.cap.create_kanban",
              "ai.cap.delete_note",
              "ai.cap.toggle_property",
              "ai.cap.change_category",
              "ai.cap.rename_note",
              "ai.cap.add_todo_items",
              "ai.cap.convert_note",
              "ai.cap.merge_notes",
              "ai.cap.create_category",
              "ai.cap.restore_note",
              "ai.cap.switch_category",
              "ai.cap.change_setting",
            ].map((key, index, arr) => (
              <View key={key} style={[styles.capabilityItem, index === arr.length - 1 && styles.sectionItemList_last]}>
                <Text style={styles.capabilityText}>{t(key)}</Text>
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
  sectionWrapper: {
    marginTop: PADDING_MARGIN.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1.5,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.medium,
  },
  statusReady: {
    color: "#4CAF50",
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: COLOR.oceanBreeze,
    fontWeight: FONTWEIGHT.semiBold,
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: COLOR.importantIcon,
    fontWeight: FONTWEIGHT.semiBold,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLOR.blue,
    borderRadius: 2,
    marginTop: PADDING_MARGIN.sm,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLOR.oceanBreeze,
    borderRadius: 2,
  },
  infoText: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    lineHeight: 18,
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  unavailableText: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1.5,
    borderColor: COLOR.darkBlue,
    gap: PADDING_MARGIN.md,
  },
  modelItemSelected: {
    backgroundColor: COLOR.blue,
  },
  modelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modelTextSelected: {
    color: COLOR.oceanBreeze,
  },
  modelSize: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
  },
  modelDescription: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    lineHeight: 16,
  },
  capabilityItem: {
    backgroundColor: COLOR.boldBlue,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  capabilityText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.small,
    lineHeight: 20,
  },
  voiceOnlyHint: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    marginTop: 2,
  },
  downloadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelText: {
    color: COLOR.important,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
