import { configs } from "@/configs";
import * as Sentry from "@sentry/react-native";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import InformationCircleIcon from "react-native-heroicons/outline/InformationCircleIcon";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import XMarkIcon from "react-native-heroicons/outline/XMarkIcon";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import ComplexDialog from "@/components/dialogs/ComplexDialog";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { CONTENT_COLUMN } from "@/constants/layout";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { getAppIcon } from "@/libs/appIcon";
import { providerOf } from "@/libs/cloud/scope";
import { collectAlwaysFacts } from "@/libs/diagnostics";
import { getDeviceBasics } from "@/libs/diagnostics/facts";
import {
  attachmentsFit,
  buildReportPayload,
  canSendReport,
  type AlwaysFacts,
  type CloudKind,
  type DeviceFacts,
  isEmailValid,
  nextReportAt,
  payloadRows,
  pruneReportLog,
  type ReportAttachment,
  sendReport,
  SHORT_DESCRIPTION,
} from "@/libs/diagnostics/report";
import { isTransientNetworkError } from "@/libs/diagnostics/scrub";
import { supportedLanguages } from "@/libs/i18n";
import { reducePhoto } from "@/libs/reducePhoto";
import {
  getCloudConnected,
  getCloudSettings,
  reportSent,
  selectorReportDate,
  selectorReportLog,
} from "@/slicers/settingsSlice";
import { formatDateTime } from "@/utils/date";
import { getDisplayAppVersion } from "@/utils/version";

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

const MAX_DESCRIPTION = 500;
const MAX_ATTACHMENTS = 3;

interface Message {
  title: string | null;
  description: string | null;
  /** The report went out: the dialog shows a check, not a warning sign. */
  success?: boolean;
}

export default function ReportScreen() {
  const { t, i18n } = useTranslation();

  const dispatch = useDispatch();

  const reportLog = useSelector(selectorReportLog);
  const reportDate = useSelector(selectorReportDate);
  const isCloudConnected = useSelector(getCloudConnected);
  const cloudSettings = useSelector(getCloudSettings);

  // The time the screen opened: a report sent from here is newer, and still counted.
  const [now] = useState(Date.now);
  const log = pruneReportLog(reportLog, reportDate, now);
  const canSend = canSendReport(log, now);
  const nextAt = canSend ? null : nextReportAt(log, now);

  const [isLoading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const showMessage = useCallback((title: string | null, description: string | null, success = false) => {
    setMessage({ title, description, success });
  }, []);
  const [showSent, setShowSent] = useState(false);

  const [topics, setTopics] = useState<string[]>([]);
  const toggleTopic = (topic: string) =>
    setTopics((prev) => (prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]));

  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [sendDeviceInfo, setSendDeviceInfo] = useState(true);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);

  /**
   * What every report carries
   */

  const language = i18n.language;
  const [always, setAlways] = useState<AlwaysFacts | null>(null);
  useEffect(() => {
    let alive = true;
    collectAlwaysFacts(language).then((facts) => alive && setAlways(facts));
    return () => {
      alive = false;
    };
  }, [language]);

  const cloud: CloudKind = isCloudConnected ? providerOf(cloudSettings) : "none";
  const deviceInfo = useMemo<DeviceFacts>(
    () => ({ ...getDeviceBasics(), cloud, appIcon: getAppIcon() ?? "default", appVersion: getDisplayAppVersion() }),
    [cloud]
  );

  const payload = useMemo(
    () =>
      always
        ? buildReportPayload({
            topics,
            description,
            email,
            attachments,
            always,
            deviceInfo: sendDeviceInfo ? deviceInfo : undefined,
          })
        : null,
    [topics, description, email, attachments, always, sendDeviceInfo, deviceInfo]
  );

  const trimmedLength = description.trim().length;
  const descriptionIsShort = trimmedLength > 0 && trimmedLength < SHORT_DESCRIPTION;

  /**
   * Attachments: reduced before they are attached (the website takes 4 MB of body, ADR-035)
   */

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (asset.type && asset.type !== "image") {
      showMessage(null, t("report.messages.invalidType"));
      return;
    }

    let content: string;
    try {
      content = await reducePhoto(asset.uri, asset.width, asset.height);
    } catch {
      content = "";
    }
    if (!content) {
      showMessage(null, t("report.messages.fileNotFound"));
      return;
    }

    const name = (asset.fileName ?? asset.uri.split("/").pop() ?? "image").replace(/\.[^.]*$/, "");
    setAttachments((prev) => [...prev, { filename: `${name || "image"}.jpg`, content, encoding: "base64" }]);
  };

  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  /**
   * Send
   */

  const send = async () => {
    if (!payload || isLoading) return;

    if (!topics.length || !trimmedLength) {
      showMessage(t("report.messages.missing.title"), t("report.messages.missing.text"));
      return;
    }
    if (payload.email && !isEmailValid(payload.email)) {
      showMessage(t("report.messages.email_invalid.title"), t("report.messages.email_invalid.text"));
      return;
    }
    if (!attachmentsFit(payload.attachments ?? [])) {
      showMessage(t("report.messages.size.title"), t("report.messages.size.text"));
      return;
    }

    setLoading(true);
    const { ok, error } = await sendReport(payload, configs.apiUrl);
    setLoading(false);

    if (ok) {
      dispatch(reportSent(new Date().toISOString()));
      showMessage(t("report.messages.success.title"), t("report.messages.success.text"), true);
    } else {
      if (error && !isTransientNetworkError(error)) Sentry.captureException(error);
      showMessage(t("report.messages.error.title"), t("report.messages.error.text"));
    }
  };

  const rows = payload ? payloadRows(payload) : null;
  const languageName = supportedLanguages[always?.appLanguage ?? ""]?.name ?? always?.appLanguage ?? "";

  return (
    <>
      <ConfirmOrCancelDialog
        open={message !== null}
        success={message?.success}
        title={message?.title}
        description={message?.description ?? ""}
        onConfirm={() => setMessage(null)}
      />

      <ComplexDialog
        open={showSent}
        title={t("report.whatIsSent")}
        confirm={{ label: t("ok"), handler: () => setShowSent(false) }}
        onDismiss={() => setShowSent(false)}
      >
        {rows && (
          <View style={styles.rows}>
            {rows.always.map((row) => (
              <SentRow key={`a-${row.key}`} label={t(`report.sent.${row.key}`)} value={row.value} />
            ))}
            {rows.device && (
              <>
                <View style={styles.rowDivider} />
                {rows.device.map((row) => (
                  <SentRow key={`d-${row.key}`} label={t(`report.sent.${row.key}`)} value={row.value} />
                ))}
              </>
            )}
            <View style={styles.rowDivider} />
            {rows.rest.map((row) => (
              <SentRow key={`r-${row.key}`} label={t(`report.sent.${row.key}`)} value={row.value} />
            ))}
          </View>
        )}
      </ComplexDialog>

      <LoadingSpinner visible={isLoading} text={t("report.loading")} />

      <SafeAreaView style={styles.container}>
        <AppBackground style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <BackButton chip shortcut={false} />

          <Text style={styles.headerTitle}>{t("report.title")}</Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Keeps the focused field above the keyboard (under KeyboardProvider the window doesn't resize for it). */}
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={CONTENT_COLUMN}
          keyboardShouldPersistTaps="handled"
          bottomOffset={PADDING_MARGIN.xl}
        >
          {canSend ? (
            <>
              <Text style={styles.label}>{t("report.question")}</Text>

              {/* topics */}
              <View style={styles.topics}>
                {topicList.map((topic) => {
                  const selected = topics.includes(topic);
                  return (
                    <TouchableOpacity
                      key={topic}
                      activeOpacity={0.7}
                      onPress={() => toggleTopic(topic)}
                      style={[styles.topic, selected && styles.topicSelected]}
                      accessibilityRole="checkbox"
                      aria-checked={selected}
                    >
                      <Text style={[styles.topicText, selected && styles.topicTextSelected]}>{t("report.topic." + topic)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* description */}
              <View style={styles.field}>
                <TextInput
                  style={styles.description}
                  placeholderTextColor={COLOR.textMuted}
                  onChangeText={setDescription}
                  value={description}
                  textAlignVertical="top"
                  multiline
                  numberOfLines={6}
                  placeholder={t("report.descriptionPlaceholder")}
                  maxLength={MAX_DESCRIPTION}
                />
                <Text style={styles.counter}>
                  {description.length} / {MAX_DESCRIPTION}
                </Text>
              </View>
              {descriptionIsShort && (
                <View style={styles.hint}>
                  <InformationCircleIcon size={16} color={COLOR.darkYellow} />
                  <Text style={styles.hintText}>{t("report.shortDescription")}</Text>
                </View>
              )}

              {/* always sent */}
              <View style={styles.box}>
                <Text style={styles.boxTitle}>{t("report.alwaysSent")}</Text>
                <View style={styles.facts}>
                  {always && (
                    <>
                      <Text style={styles.fact}>Fast Memo {always.appVersion}</Text>
                      <Text style={styles.fact}>{[always.os, always.osVersion].filter(Boolean).join(" ")}</Text>
                      <Text style={styles.fact}>{languageName}</Text>
                    </>
                  )}
                </View>
              </View>

              {/* device information */}
              <View style={styles.box}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSendDeviceInfo((prev) => !prev)}
                  style={styles.check}
                  accessibilityRole="checkbox"
                  aria-checked={sendDeviceInfo}
                >
                  <View style={[styles.checkbox, sendDeviceInfo && styles.checkboxChecked]}>
                    {sendDeviceInfo && <CheckIcon size={14} color={COLOR.softWhite} strokeWidth={2.4} />}
                  </View>
                  <View style={styles.checkTexts}>
                    <Text style={styles.checkTitle}>{t("report.deviceInfoCheckbox")}</Text>
                    <Text style={styles.checkText}>{t("report.deviceInfoText")}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSent(true)} accessibilityRole="button">
                  <Text style={styles.link}>{t("report.seeWhatIsSent")}</Text>
                </TouchableOpacity>
              </View>

              {/* attachments */}
              <ScrollView horizontal contentContainerStyle={styles.attachments}>
                {attachments.map((attachment, i) => (
                  <View key={i} style={[styles.attachment, styles.attachmentFilled]}>
                    <Image style={styles.attachmentImage} source={{ uri: `data:image/jpeg;base64,${attachment.content}` }} />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => removeAttachment(i)}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.remove_attachment")}
                      style={styles.removeAttachment}
                      hitSlop={10}
                    >
                      <XMarkIcon size={14} color={COLOR.softWhite} />
                    </TouchableOpacity>
                  </View>
                ))}

                {attachments.length < MAX_ATTACHMENTS && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={pickImage}
                    style={styles.attachment}
                    accessibilityRole="button"
                  >
                    <PlusIcon size={24} color={COLOR.softWhite} />
                    <Text style={styles.attachmentText}>{t("report.attachments")}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <Text style={styles.small}>
                {t("report.attachments_limit")} {attachments.length} / {MAX_ATTACHMENTS}
              </Text>

              {/* email */}
              <TextInput
                style={styles.email}
                placeholderTextColor={COLOR.textMuted}
                onChangeText={setEmail}
                value={email}
                placeholder={t("report.email")}
                accessibilityLabel={t("report.email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                inputMode="email"
              />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={send}
                disabled={isLoading || !payload}
                style={[styles.send, (isLoading || !payload) && styles.sendDisabled]}
                accessibilityRole="button"
                aria-disabled={isLoading || !payload}
              >
                <Text style={styles.sendText}>{t("report.sendReport")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.box}>
              <Text style={styles.sentText}>
                {t("report.sent_message_1")}
                {"\n"}
                {t("report.sent_message_2")}
              </Text>
              <Text style={styles.sentDate}>{nextAt !== null ? formatDateTime(nextAt) : ""}</Text>
            </View>
          )}

          {always && (
            <Text style={styles.code} selectable>
              {t("report.installCode", { code: always.installId })}
            </Text>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

interface SentRowProps {
  label: string;
  value: string;
}

function SentRow({ label, value }: SentRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

/* STYLES */

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
  label: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    marginBottom: PADDING_MARGIN.md,
  },
  topics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.lg,
  },
  topic: {
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
  },
  topicSelected: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  topicText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  topicTextSelected: {
    color: COLOR.softWhite,
  },
  field: {
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  description: {
    minHeight: 110,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  counter: {
    textAlign: "right",
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: PADDING_MARGIN.sm,
    marginTop: PADDING_MARGIN.sm,
  },
  hintText: {
    flex: 1,
    color: COLOR.darkYellow,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    lineHeight: 17,
  },
  box: {
    marginTop: PADDING_MARGIN.lg,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.fill,
    padding: PADDING_MARGIN.md,
  },
  boxTitle: {
    color: COLOR.textMuted,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: PADDING_MARGIN.sm,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PADDING_MARGIN.sm,
  },
  fact: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    backgroundColor: GLASS.fillStrong,
    borderRadius: BORDER.small,
    paddingVertical: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    overflow: "hidden",
  },
  check: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: PADDING_MARGIN.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: BORDER.small,
  },
  checkboxChecked: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  checkTexts: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  checkText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
  link: {
    color: COLOR.accentSoft,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
    marginTop: PADDING_MARGIN.sm,
    marginLeft: 22 + PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.xs,
  },
  attachments: {
    paddingTop: PADDING_MARGIN.lg,
  },
  attachment: {
    position: "relative",
    height: 100,
    width: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.md,
    borderColor: GLASS.border,
    borderWidth: 1,
    borderRadius: BORDER.big,
    borderStyle: "dashed",
    marginRight: PADDING_MARGIN.md,
  },
  attachmentFilled: {
    borderWidth: 0,
    padding: 0,
    backgroundColor: COLOR.surfaceMuted,
  },
  attachmentImage: {
    position: "absolute",
    height: 100,
    width: 100,
    borderRadius: BORDER.big,
    top: 0,
    left: 0,
  },
  attachmentText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
  removeAttachment: {
    top: -5,
    right: -5,
    position: "absolute",
    backgroundColor: COLOR.important,
    borderRadius: BORDER.rounded,
    padding: 3,
  },
  small: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.sm,
  },
  email: {
    marginTop: PADDING_MARGIN.lg,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.md,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  send: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: PADDING_MARGIN.lg,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    marginTop: PADDING_MARGIN.lg,
    ...SHADOW.fab,
  },
  sendDisabled: {
    opacity: 0.55,
  },
  sendText: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  sentText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    textAlign: "center",
    lineHeight: 24,
  },
  sentDate: {
    marginTop: PADDING_MARGIN.md,
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    textAlign: "center",
  },
  code: {
    marginTop: PADDING_MARGIN.lg,
    marginBottom: PADDING_MARGIN.xl,
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
  rows: {
    gap: PADDING_MARGIN.xs + 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: PADDING_MARGIN.md,
  },
  rowLabel: {
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  rowValue: {
    flexShrink: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    textAlign: "right",
  },
  rowDivider: {
    height: 1,
    backgroundColor: GLASS.border,
    marginVertical: PADDING_MARGIN.xs,
  },
});
