import { configs } from "@/configs";
import * as Sentry from "@sentry/react-native";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, PlusIcon, XMarkIcon } from "react-native-heroicons/outline";
import { useDispatch, useStore } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import LottieView from "@/components/LottieAnimation";
import SafeAreaView from "@/components/SafeAreaView";
import { useRouter } from "@/hooks/useRouter";
import { setReportDate } from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

import lottieJson from "../../assets/lottie/Logo.json";

const topicList = [
  "crash",
  "notes",
  "categories",
  "cloud",
  "webhooks",
  "export_import",
  "translations",
  "suggestions",
  "other",
];

export default function ReportScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const dispatch = useDispatch();

  const [isLoading, setLoading] = useState(false);

  const [reportMessage, setReportMessage] = useState({
    title: null,
    description: null,
  });
  const [showReportMessageDialog, setShowReportMessageDialog] = useState(false);

  const lockReportForOneDay = () => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    dispatch(setReportDate(now));
  };

  const store = useStore();
  const state = store.getState();
  // @ts-ignore
  const isAvailableToReport = state.settings.reportDate ? new Date() >= new Date(state.settings.reportDate) : true;

  const logoAnimRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      logoAnimRef.current?.play();
    }, 200);
  }, []);

  /**
   * Device Info
   */

  const [sendDeviceInfo, setSendDeviceInfo] = useState(false);
  const toggleSendDeviceInfo = () => setSendDeviceInfo((prev) => !prev);

  /**
   * Description
   */

  const [problemDescription, setProblemDescription] = useState("");

  /**
   * Topics
   */

  const [topicsSelected, setTopics] = useState([]);
  const toggleTopic = (topicName) => {
    setTopics((prev) => (prev.includes(topicName) ? prev.filter((t) => t != topicName) : [...prev, topicName]));
  };

  /**
   * Attachments
   */

  const [attachments, setAttachments] = useState([]);

  const pickImageOrVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      setReportMessage({
        title: null,
        description: t("report.messages.permissionDenied"),
      });
      setShowReportMessageDialog(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      base64: true,
      allowsEditing: false,
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const fileInfo = await FileSystem.getInfoAsync(asset.uri);

    if (!fileInfo.exists) {
      setReportMessage({
        title: null,
        description: t("report.messages.fileNotFound"),
      });
      setShowReportMessageDialog(true);
      return;
    }

    if (!isLessThan(fileInfo.size ?? 0, 5)) {
      setReportMessage({
        title: t("report.messages.size.title"),
        description: t("report.messages.size.text"),
      });
      setShowReportMessageDialog(true);
      return;
    }

    const mimeType = asset.type ?? "unknown";

    if (mimeType !== "image") {
      setReportMessage({
        title: null,
        description: t("report.messages.invalidType"),
      });
      setShowReportMessageDialog(true);
      return;
    }

    const fileName = asset.fileName ?? asset.uri.split("/").pop() ?? `file.${mimeType}`;

    setAttachments((prev) => [
      ...prev,
      {
        filename: fileName,
        content: asset.base64,
        encoding: "base64",
      },
    ]);
  };

  const removeAttachment = (fileName) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.filename != fileName));
  };

  /**
   * Send Report
   */

  const sendReport = async () => {
    const data = {};

    if (!topicsSelected.length || !problemDescription) {
      setReportMessage({
        title: t("report.messages.missing.title"),
        description: t("report.messages.missing.text"),
      });
      setShowReportMessageDialog(true);
      return;
    }

    setLoading(true);

    data.topics = [...topicsSelected];
    data.description = problemDescription;

    const currentAppVersion = Platform.OS === "web" ? configs.app.version.web : configs.app.version.mobile;

    if (sendDeviceInfo) {
      data.deviceInfo = {
        brand: Device.brand,
        deviceName: Device.deviceName,
        deviceType: Device.DeviceType[Device.deviceType],
        modelName: Device.modelName,
        osVersion: Device.osVersion,
        appVersion: currentAppVersion,
      };
    } else {
      data.deviceInfo = {
        appVersion: currentAppVersion,
      };
    }

    if (attachments.length) {
      data.attachments = [...attachments];
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${configs.apiUrl}/report`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(data),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      clearTimeout(id);

      const json = await response.json();

      if (json.success) {
        setReportMessage({
          title: t("report.messages.success.title"),
          description: t("report.messages.success.text"),
        });
        setShowReportMessageDialog(true);
        lockReportForOneDay();
      } else {
        setReportMessage({
          title: t("report.messages.error.title"),
          description: t("report.messages.error.text"),
        });
        setShowReportMessageDialog(true);
      }
    } catch (error) {
      Sentry.captureException(error);
      setReportMessage({
        title: t("report.messages.error.title"),
        description: t("report.messages.error.text"),
      });
      setShowReportMessageDialog(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ConfirmOrCancelDialog
        open={showReportMessageDialog}
        title={reportMessage.title}
        description={reportMessage.description}
        onConfirm={() => setShowReportMessageDialog(false)}
      />

      <LoadingSpinner visible={isLoading} text={t("report.loading")} />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />

          <Text style={styles.headerTitle}>{t("report.title")}</Text>

          <View style={{ padding: PADDING_MARGIN.md }} />
        </View>

        <ScrollView>
          <View style={styles.appWrapper}>
            <LottieView ref={logoAnimRef} style={styles.logoStyle} source={lottieJson} loop={false} />
            <Text style={styles.text}>Fast Memo - Notes in one click</Text>
          </View>

          {isAvailableToReport && (
            <View style={styles.sectionWrapper}>
              <Text style={styles.text}>{t("report.question")}</Text>

              {/* topics */}
              <View style={styles.topicWrapper}>
                {topicList.map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    activeOpacity={0.7}
                    onPress={() => toggleTopic(topic)}
                    style={[styles.topicButton, topicsSelected.includes(topic) && styles.topicButtonSelected]}
                  >
                    <Text style={{ color: COLOR.black }}>{t("report.topic." + topic)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* description */}
              <View style={styles.problemDescriptionWrapper}>
                <TextInput
                  placeholderTextColor={COLOR.blue}
                  onChangeText={(text) => setProblemDescription(text)}
                  value={problemDescription}
                  textAlignVertical="top"
                  multiline
                  numberOfLines={6}
                  placeholder={t("report.descriptionPlaceholder")}
                  maxLength={500}
                />
                <Text
                  style={{
                    textAlign: "right",
                    color: COLOR.blue,
                    marginTop: PADDING_MARGIN.sm,
                  }}
                >
                  {problemDescription.length} / 500
                </Text>
              </View>

              {/* device info */}
              <TouchableOpacity activeOpacity={0.7} onPress={toggleSendDeviceInfo}>
                <View style={[styles.sendDeviceInfoCheckbox, sendDeviceInfo && { backgroundColor: COLOR.gray }]}>
                  <CheckIcon size={20} color={COLOR.darkBlue} style={{ opacity: sendDeviceInfo ? 1 : 0 }} />
                </View>
                <Text style={styles.sendDeviceInfoText}>{t("report.deviceInfoCheckbox")}</Text>
              </TouchableOpacity>

              {/* attachments */}
              <ScrollView horizontal>
                {attachments.map((attachment, i) => (
                  <View key={i} style={[styles.addImageOrVideo, styles.imageOrVideoWrapper]}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => removeAttachment(attachment.filename)}
                      style={styles.removeImageOrVideo}
                    >
                      <XMarkIcon size={14} color={COLOR.softWhite} />
                    </TouchableOpacity>
                    <Image
                      style={styles.imageOrVideo}
                      source={{
                        uri: `data:image/png;${attachment.encoding},${attachment.content}`,
                      }}
                    />
                  </View>
                ))}

                {attachments.length < 3 && (
                  <TouchableOpacity activeOpacity={0.7} onPress={pickImageOrVideo} style={styles.addImageOrVideo}>
                    <PlusIcon size={24} color={COLOR.softWhite} />

                    <Text style={[styles.text, { textAlign: "center" }]}>{t("report.attachments")}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <View>
                <Text style={[styles.text, { fontSize: 12 }]}>
                  {t("report.attachments_limit")} {attachments.length} / 3
                </Text>
                <Text style={[styles.text, { fontSize: 12 }]}>{t("report.size_limit")} 5 MB</Text>
              </View>
            </View>
          )}

          {!isAvailableToReport && (
            <View style={styles.sectionWrapper}>
              <Text style={[styles.text, { textAlign: "center", marginVertical: PADDING_MARGIN.xl }]}>
                {t("report.sent_message_1")}
                {"\n"}
                {t("report.sent_message_2")}
                {"\n"}
                {"\n"}
                <Text
                  style={{
                    fontSize: FONTSIZE.subtitle,
                    color: COLOR.lightBlue,
                  }}
                >
                  {/* @ts-ignore */}
                  {formatDateTime(state.settings.reportDate)}
                </Text>
              </Text>
            </View>
          )}

          {/* send report */}
          {isAvailableToReport && (
            <TouchableOpacity activeOpacity={0.7} onPress={sendReport} style={styles.sendReportButton}>
              <Text style={styles.text}>{t("report.sendReport")}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

export const isLessThan = (fileSize, megabyte) => {
  return fileSize / 1024 / 1024 < megabyte;
};

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
  appWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.lg,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
  },
  logoStyle: {
    width: 50,
    height: 50,
  },
  sectionWrapper: {
    gap: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
  },
  text: {
    color: COLOR.softWhite,
  },
  topicWrapper: {
    rowGap: PADDING_MARGIN.sm,
    columnGap: PADDING_MARGIN.md,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  topicButton: {
    backgroundColor: COLOR.softenGray,
    paddingVertical: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    borderRadius: BORDER.small,
  },
  topicButtonSelected: {
    backgroundColor: COLOR.gray,
  },
  problemDescriptionWrapper: {
    marginTop: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.softenGray,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  sendDeviceInfoText: {
    color: COLOR.softWhite,
    paddingLeft: PADDING_MARGIN.xl,
  },
  sendDeviceInfoCheckbox: {
    position: "absolute",
    backgroundColor: COLOR.softenGray,
    borderRadius: BORDER.small,
    padding: PADDING_MARGIN.xs,
    alignSelf: "flex-start",
  },
  addImageOrVideo: {
    position: "relative",
    height: 100,
    width: 100,
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    alignSelf: "flex-start",
    padding: PADDING_MARGIN.md,
    borderColor: COLOR.softWhite,
    borderWidth: 1,
    borderRadius: BORDER.normal,
    borderStyle: "dashed",
    marginTop: PADDING_MARGIN.sm,
    marginRight: PADDING_MARGIN.md,
  },
  imageOrVideoWrapper: {
    borderWidth: 0,
    backgroundColor: COLOR.softenGray,
  },
  imageOrVideo: {
    position: "absolute",
    zIndex: -1,
    height: 100,
    width: 100,
    borderRadius: BORDER.normal,
    top: 0,
    left: 0,
  },
  removeImageOrVideo: {
    top: -5,
    right: -5,
    position: "absolute",
    backgroundColor: COLOR.important,
    borderRadius: BORDER.rounded,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  sendReportButton: {
    width: SIZE.full,
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    alignSelf: "flex-start",
    paddingVertical: PADDING_MARGIN.lg,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
    color: COLOR.darkBlue,
    backgroundColor: COLOR.importantIcon,
    marginVertical: PADDING_MARGIN.xl,
  },
  loadingSpinner: {
    position: "absolute",
    zIndex: 2,
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
