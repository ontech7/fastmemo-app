import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, MONOSPACE_FONT, PADDING_MARGIN } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import { connectionSnippets } from "@/libs/mcp/snippets";
import type { McpConnectionInfo, McpSettings } from "@/libs/mcp/settingsApi";
import { getMcpConnectionInfo, getMcpSettings, MCP_TOOLS, setMcpSettings } from "@/libs/mcp/settingsApi";
import { isTauri } from "@/utils/platform";

/** How long a copy button says "Copied". */
const COPIED_MS = 1500;

/** The tool whose line is the session rule, not a description. */
const EDIT_TOOL = "fastmemo_edit_note";

/** Windows and Linux: where closing the window can leave the app running in the tray. */
const BACKGROUND_PLATFORMS = ["windows", "linux"];

/** A rejected command carries Rust's message as a string. */
function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : String(error);
}

interface SwitchRowProps {
  label: string;
  line: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isLast?: boolean;
}

function SwitchRow({ label, line, value, onChange, isLast = false }: SwitchRowProps) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowLine}>{line}</Text>
      </View>

      <Switch
        trackColor={{ false: COLOR.surfaceMuted, true: COLOR.accentMuted }}
        thumbColor={COLOR.softWhite}
        onValueChange={onChange}
        value={value}
        accessibilityLabel={label}
        style={styles.switch}
      />
    </View>
  );
}

interface CopyBlockProps {
  client: string;
  text: string;
  note?: string;
}

/** What to paste into one client, selectable, with a button that copies it. */
function CopyBlock({ client, text, note }: CopyBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    let done = false;
    try {
      await navigator.clipboard.writeText(text);
      done = true;
    } catch {
      done = false;
    }
    setCopied(done);
    setFailed(!done);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setCopied(false);
    }, COPIED_MS);
  };

  return (
    <View style={styles.copyBlock}>
      <View style={styles.copyHeader}>
        <Text style={styles.copyTitle}>{client}</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.copyButton}
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel={t("mcp.copy_label", { client })}
        >
          <Text style={styles.copyButtonText}>{copied ? t("mcp.copied") : t("mcp.copy")}</Text>
        </TouchableOpacity>
      </View>

      {note ? <Text style={styles.copyNote}>{note}</Text> : null}

      <View style={styles.codeBox}>
        <Text selectable style={styles.code}>
          {text}
        </Text>
      </View>

      {failed ? <Text style={styles.errorText}>{t("mcp.copy_failed")}</Text> : null}
    </View>
  );
}

export default function McpScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [settings, setSettings] = useState<McpSettings | null>(null);
  const [info, setInfo] = useState<McpConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const desktop = isTauri();

  useEffect(() => {
    // A browser reaching this URL directly: there is no server to set up.
    if (!desktop) {
      if (router.canGoBack()) router.back();
      else router.replace("/home");
      return;
    }
    Promise.all([getMcpSettings(), getMcpConnectionInfo()])
      .then(([loadedSettings, loadedInfo]) => {
        setSettings(loadedSettings);
        setInfo(loadedInfo);
      })
      .catch((err) => setError(t("mcp.load_failed", { error: errorText(err) })));
    // Once, on opening the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Shows the change at once and saves it. On a failure the page reads back what is in force, and says why. */
  const apply = useCallback(
    async (next: McpSettings) => {
      setSettings(next);
      setError(null);
      setSaving(true);
      try {
        await setMcpSettings(next);
      } catch (err) {
        setError(t("mcp.save_failed", { error: errorText(err) }));
        // A server that didn't start leaves the switch saved on; a file that didn't write leaves the old value.
        getMcpSettings()
          .then(setSettings)
          .catch(() => {});
      } finally {
        setSaving(false);
      }
    },
    [t]
  );

  if (!desktop) return null;

  const snippets = info ? connectionSnippets(info.path) : null;
  const showBackground = info !== null && BACKGROUND_PLATFORMS.includes(info.platform);

  const toggleTool = (name: string, defaultOn: boolean) => (value: boolean) => {
    if (!settings) return;
    // Only what differs from its default is kept, so a default changed in a later version still applies.
    const tools = { ...settings.tools };
    if (value === defaultOn) delete tools[name];
    else tools[name] = value;
    apply({ ...settings, tools });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("mcp.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {settings === null || snippets === null ? (
          error ? null : (
            <ActivityIndicator size="large" color={COLOR.accentSoft} />
          )
        ) : (
          <>
            <View style={styles.sectionWrapper}>
              <View style={[styles.sectionList, saving && styles.saving]}>
                <SwitchRow
                  label={t("mcp.enable_label")}
                  line={t("mcp.enable_line")}
                  value={settings.enabled}
                  onChange={(enabled) => apply({ ...settings, enabled })}
                />
                <View style={[styles.row, styles.rowLast]}>
                  <Text style={styles.rowLine}>{t("mcp.provider_warning")}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionWrapper}>
              <Text style={styles.sectionHeaderTitle}>{t("mcp.tools_section")}</Text>
              <View style={[styles.sectionList, saving && styles.saving]}>
                {MCP_TOOLS.map((tool, index) => (
                  <SwitchRow
                    key={tool.name}
                    label={t(`mcp.tools.${tool.name}`)}
                    line={tool.name === EDIT_TOOL ? t("mcp.edit_note_line") : t(`mcp.tool_lines.${tool.name}`)}
                    value={settings.tools[tool.name] ?? tool.defaultOn}
                    onChange={toggleTool(tool.name, tool.defaultOn)}
                    isLast={index === MCP_TOOLS.length - 1}
                  />
                ))}
              </View>
            </View>

            {showBackground ? (
              <View style={styles.sectionWrapper}>
                <View style={[styles.sectionList, saving && styles.saving]}>
                  <SwitchRow
                    label={t("mcp.background_label")}
                    line={t("mcp.background_line")}
                    value={settings.keepRunning}
                    onChange={(keepRunning) => apply({ ...settings, keepRunning })}
                    isLast
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.sectionWrapper}>
              <Text style={styles.sectionHeaderTitle}>{t("mcp.connect_section")}</Text>
              <Text style={styles.intro}>{t("mcp.connect_intro")}</Text>
              {info?.moved ? <Text style={styles.warningText}>{t("mcp.moved_warning")}</Text> : null}

              <CopyBlock client={t("mcp.client_claude_code")} text={snippets.claudeCode} />
              <CopyBlock client={t("mcp.client_codex")} text={snippets.codex} />
              <CopyBlock client={t("mcp.client_json")} text={snippets.json} note={t("mcp.json_files")} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* STYLES */

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
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingBottom: PADDING_MARGIN.xl,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.lg,
  },
  sectionHeaderTitle: {
    color: COLOR.textSecondary,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontFamily: FONT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  saving: {
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowContent: {
    flex: 1,
    marginRight: PADDING_MARGIN.md,
  },
  rowTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  rowLine: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.xs,
  },
  switch: {
    height: 25,
  },
  intro: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    marginBottom: PADDING_MARGIN.sm,
  },
  warningText: {
    color: COLOR.darkYellow,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    marginBottom: PADDING_MARGIN.sm,
  },
  errorText: {
    color: COLOR.importantIcon,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    marginTop: PADDING_MARGIN.sm,
  },
  copyBlock: {
    marginTop: PADDING_MARGIN.md,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: COLOR.surface,
  },
  copyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copyTitle: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
  },
  copyButton: {
    paddingVertical: PADDING_MARGIN.xs + 2,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.small,
    borderWidth: 1,
    borderColor: COLOR.accentMutedBorder,
    backgroundColor: COLOR.accentMuted,
  },
  copyButtonText: {
    color: COLOR.softWhite,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  copyNote: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.sm,
  },
  codeBox: {
    marginTop: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.small,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: COLOR.bg,
  },
  code: {
    color: COLOR.textPrimary,
    fontFamily: MONOSPACE_FONT,
    fontSize: FONTSIZE.small,
  },
});
