import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import AppBackground from "@/components/ui/AppBackground";
import CrashIllustration from "@/components/ui/illustrations/CrashIllustration";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, MAX_WIDTH, PADDING_MARGIN } from "@/constants/styles";
import { collectAlwaysFacts } from "@/libs/diagnostics";
import { getInstallId, peekInstallId } from "@/libs/diagnostics/installId";
import { buildReportPayload, CRASH_NO_TEXT, sendReport } from "@/libs/diagnostics/report";
import i18n from "@/libs/i18n";
import { reloadApp } from "@/libs/reloadApp";

interface Props {
  /** The Sentry event of this crash, sent with a report so the two can be matched. */
  eventId?: string;
}

type SendState = "idle" | "sending" | "sent" | "failed";

const MAX_TEXT = 500;

/** The English text is the fallback: this screen may show while the translations are what broke. */
const tr = (key: string, english: string, options?: Record<string, string>) =>
  i18n.t(`crash.${key}`, { defaultValue: english, ...options });

/**
 * What a render error shows instead of a blank screen (ADR-035): the boundary's fallback, around everything. It uses no
 * store, no router, no safe-area or dialog context and no `useTranslation`: any of them may be what crashed.
 */
export default function CrashScreen({ eventId }: Props) {
  const [code, setCode] = useState(peekInstallId);
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");

  useEffect(() => {
    if (!code) getInstallId().then(setCode);
  }, [code]);

  // A crash before the app's first layout would stay behind the splash image.
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const send = useCallback(async () => {
    setSendState("sending");
    const always = await collectAlwaysFacts(i18n.language || "en");
    const payload = buildReportPayload({
      topics: ["crash"],
      description: text.trim() || CRASH_NO_TEXT,
      always,
      sentryEventId: eventId,
    });
    const { ok } = await sendReport(payload, configs.apiUrl);
    setSendState(ok ? "sent" : "failed");
  }, [text, eventId]);

  const sending = sendState === "sending";
  const sent = sendState === "sent";

  return (
    <View style={styles.container} onLayout={onLayout}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <CrashIllustration />

          <Text style={styles.title} accessibilityRole="header">
            {tr("title", "Something went wrong")}
          </Text>
          <Text style={styles.text}>
            {tr("text", "Your saved notes are still on this device. Reopen the app; if it happens again, send us a report.")}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
            onPress={reloadApp}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{tr("reopen", "Reopen Fast Memo")}</Text>
          </Pressable>

          {!formOpen ? (
            <Pressable
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
              onPress={() => setFormOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{tr("report", "Send a report")}</Text>
            </Pressable>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={tr("what", "What were you doing?")}
                placeholderTextColor={COLOR.textMuted}
                accessibilityLabel={tr("what", "What were you doing?")}
                multiline
                maxLength={MAX_TEXT}
                editable={!sent && !sending}
                textAlignVertical="top"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  (sending || sent) && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={send}
                disabled={sending || sent}
                accessibilityRole="button"
                aria-disabled={sending || sent}
              >
                <Text style={styles.buttonText}>
                  {sent ? tr("sent", "Report sent") : sending ? tr("sending", "Sending…") : tr("send", "Send")}
                </Text>
              </Pressable>
              {sendState === "failed" && (
                <Text style={styles.failed} accessibilityLiveRegion="polite">
                  {tr("failed", "It couldn't be sent. Check the connection and try again.")}
                </Text>
              )}
            </View>
          )}

          {code ? (
            <Text style={styles.code} selectable>
              {tr("code", "Code: {{code}}", { code })}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.xxl,
  },
  column: {
    width: "100%",
    maxWidth: MAX_WIDTH.dialog,
    alignItems: "center",
    gap: PADDING_MARGIN.md,
  },
  title: {
    marginTop: PADDING_MARGIN.sm,
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.subtitle,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    lineHeight: 24,
    textAlign: "center",
  },
  button: {
    width: "100%",
    minHeight: 52,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  primary: {
    marginTop: PADDING_MARGIN.md,
    backgroundColor: COLOR.accent,
    boxShadow: `0px 0px 18px ${COLOR.accent}73`,
  },
  secondary: {
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.medium,
  },
  form: {
    width: "100%",
    gap: PADDING_MARGIN.md,
  },
  input: {
    width: "100%",
    minHeight: 110,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.fill,
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.md,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  failed: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    textAlign: "center",
  },
  code: {
    marginTop: PADDING_MARGIN.sm,
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
});
