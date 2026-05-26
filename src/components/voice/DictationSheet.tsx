import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MicrophoneIcon, SparklesIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

interface Props {
  visible: boolean;
  /** Whether the engine is actively listening (drives the pulse + status). */
  listening: boolean;
  /** Formatted live transcript to preview. */
  transcript: string;
  /** Human-readable active language (e.g. "Italiano"). */
  languageLabel: string;
  /** Whether AI cleanup is offered (model enabled + downloaded). */
  aiAvailable?: boolean;
  /** AI cleanup is running. */
  processing?: boolean;
  onToggleListening: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Confirm, but run the transcript through AI cleanup before inserting. */
  onConfirmWithAI?: () => void;
}

export default function DictationSheet({
  visible,
  listening,
  transcript,
  languageLabel,
  aiAvailable = false,
  processing = false,
  onToggleListening,
  onCancel,
  onConfirm,
  onConfirmWithAI,
}: Props) {
  const { t } = useTranslation();

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (listening) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [listening, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));

  const hasText = transcript.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.micWrap}>
            <Animated.View style={[styles.micPulse, pulseStyle]} />
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.micButton, listening && styles.micButtonActive]}
              onPress={onToggleListening}
            >
              {listening ? <View style={styles.stopIcon} /> : <MicrophoneIcon size={22} color={COLOR.softWhite} />}
            </TouchableOpacity>
          </View>

          <View style={styles.headerTexts}>
            <Text style={styles.status}>
              {processing
                ? t("voicerecognition.dictation.processing")
                : listening
                  ? t("voicerecognition.dictation.listening")
                  : t("voicerecognition.dictation.paused")}
            </Text>
            <View style={styles.langChip}>
              <Text style={styles.langChipText}>{languageLabel}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent}>
          <Text style={[styles.transcript, !hasText && styles.transcriptHint]}>
            {hasText ? transcript : t("voicerecognition.dictation.hint")}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          {aiAvailable && onConfirmWithAI && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.aiAction, (!hasText || processing) && styles.actionDisabled]}
              onPress={onConfirmWithAI}
              disabled={!hasText || processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={COLOR.softWhite} />
              ) : (
                <SparklesIcon size={18} color={COLOR.softWhite} />
              )}
              <Text style={styles.confirmLabel}>{t("voicerecognition.dictation.ai_cleanup")}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footerRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.action, styles.cancelAction, processing && styles.actionDisabled]}
              onPress={onCancel}
              disabled={processing}
            >
              <Text style={styles.cancelLabel}>{t("voicerecognition.dictation.cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.action, styles.confirmAction, (!hasText || processing) && styles.actionDisabled]}
              onPress={onConfirm}
              disabled={!hasText || processing}
            >
              <Text style={styles.confirmLabel}>{t("voicerecognition.dictation.insert")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingTop: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.xl,
    backgroundColor: COLOR.surface,
    borderTopLeftRadius: BORDER.big,
    borderTopRightRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fillStrong,
    marginBottom: PADDING_MARGIN.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.md,
  },
  micWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  micPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.important,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.fab,
  },
  micButtonActive: {
    backgroundColor: COLOR.important,
  },
  stopIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: COLOR.softWhite,
  },
  headerTexts: {
    flex: 1,
    gap: PADDING_MARGIN.xs,
  },
  status: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  langChip: {
    alignSelf: "flex-start",
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 2,
    borderRadius: BORDER.rounded,
    backgroundColor: GLASS.fill,
  },
  langChipText: {
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
  transcriptScroll: {
    maxHeight: 180,
    borderRadius: BORDER.normal,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  transcriptContent: {
    padding: PADDING_MARGIN.md,
  },
  transcript: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    lineHeight: 24,
  },
  transcriptHint: {
    color: COLOR.textSecondary,
    fontStyle: "italic",
  },
  footer: {
    marginTop: PADDING_MARGIN.lg,
    gap: PADDING_MARGIN.md,
  },
  footerRow: {
    flexDirection: "row",
    gap: PADDING_MARGIN.md,
  },
  aiAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: "#6C63FF",
  },
  action: {
    flex: 1,
    paddingVertical: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAction: {
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  confirmAction: {
    backgroundColor: COLOR.accentMuted,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  cancelLabel: {
    color: COLOR.textSecondary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  confirmLabel: {
    color: COLOR.softWhite,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
});
