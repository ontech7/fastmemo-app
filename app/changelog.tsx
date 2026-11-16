import lottieJson from "~/assets/lottie/Logo.json";
import CloseButton from "@/components/buttons/CloseButton";
import ChangelogItem from "@/components/changelog/ChangelogItem";
import LottieView from "@/components/lottie/LottieAnimation";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { seenWhatsNew } from "@/libs/whatsNew";
import { CONTENT_COLUMN } from "@/constants/layout";
import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

function getVersionChangelogs(t: (key: string) => string) {
  return Platform.OS === "web"
    ? [
        { version: "v2.2.0", text: t("changelog.web.description_2_2_0") },
        { version: "v2.1.0", text: t("changelog.web.description_2_1_0") },
        { version: "v2.0.0", text: t("changelog.web.description_2_0_0") },
        { version: "v1.2.0", text: t("changelog.web.description_1_2_0") },
        { version: "v1.1.1", text: t("changelog.web.description_1_1_1") },
        { version: "v1.0.0", text: t("changelog.web.description_1_0_0") },
        { version: "v0.3.1", text: t("changelog.web.description_0_3_0") },
        { version: "v0.2.1", text: t("changelog.web.description_0_2_0") },
        { version: "v0.1.1", text: t("changelog.web.description_0_1_1") },
        { version: "v0.1.0", text: t("changelog.web.description_0_1_0") },
      ]
    : [
        { version: "v4.1.0", text: t("changelog.mobile.description_4_1_0") },
        { version: "v4.0.0", text: t("changelog.mobile.description_4_0_0") },
        { version: "v3.2.0", text: t("changelog.mobile.description_3_2_0") },
        { version: "v3.1.1", text: t("changelog.mobile.description_3_1_1") },
        { version: "v3.0.0", text: t("changelog.mobile.description_3_0_0") },
        { version: "v2.9.1", text: t("changelog.mobile.description_2_9_1") },
        { version: "v2.8.0", text: t("changelog.mobile.description_2_8_0") },
        { version: "v2.7.1", text: t("changelog.mobile.description_2_7_1") },
        { version: "v2.7.0", text: t("changelog.mobile.description_2_7_0") },
        { version: "v2.6.2", text: t("changelog.mobile.description_2_6_2") },
        { version: "v2.5.3", text: t("changelog.mobile.description_2_5_3") },
        { version: "v2.5.2", text: t("changelog.mobile.description_2_5_2") },
        { version: "v2.4.2", text: t("changelog.mobile.description_2_4_2") },
        { version: "v2.3.0", text: t("changelog.mobile.description_2_3_0") },
        { version: "v2.2.1", text: t("changelog.mobile.description_2_2_1") },
        { version: "v2.1.0", text: t("changelog.mobile.description_2_1_0") },
        { version: "v2.0.0", text: t("changelog.mobile.description_2_0_0") },
      ];
}

export default function ChangelogScreen() {
  const { t } = useTranslation();

  const [current, ...previous] = useMemo(() => getVersionChangelogs(t), [t]);

  const logoAnimRef = useRef<any>(null);

  // Opened (from the sidebar's icon, the home's message or the settings): the news of this version has been seen.
  useEffect(() => {
    seenWhatsNew();
    logoAnimRef.current?.play();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>{t("generalsettings.changelog")}</Text>
        <CloseButton chip />
      </View>

      <ScrollView contentContainerStyle={[CONTENT_COLUMN, styles.content]}>
        <View style={styles.hero}>
          <LottieView ref={logoAnimRef} style={styles.logo} source={lottieJson} loop={false} />
          <Text style={styles.heroTitle} accessibilityRole="header">
            {t("changelog.new_in", { version: current.version.replace(/^v/, "") })}
          </Text>
          <Text style={styles.heroHint}>{t("changelog.new_in_hint")}</Text>
        </View>

        <ChangelogItem current version={current.version} text={current.text} />

        <Text style={styles.section} accessibilityRole="header">
          {t("changelog.previous")}
        </Text>

        {previous.map((changelog, index) => (
          <ChangelogItem
            key={`changelog-${changelog.version}`}
            version={changelog.version}
            text={changelog.text}
            isLast={index === previous.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FONTSIZE.inputTitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textSecondary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    paddingHorizontal: PADDING_MARGIN.md,
    paddingBottom: PADDING_MARGIN.xxl,
  },
  hero: {
    alignItems: "center",
    marginBottom: PADDING_MARGIN.lg,
  },
  logo: {
    width: 96,
    height: 96,
  },
  heroTitle: {
    marginTop: PADDING_MARGIN.sm,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.bold,
    color: COLOR.textPrimary,
    letterSpacing: -0.4,
  },
  heroHint: {
    marginTop: PADDING_MARGIN.xs,
    textAlign: "center",
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.regular,
    color: COLOR.textMuted,
  },
  section: {
    marginTop: PADDING_MARGIN.xl,
    marginBottom: PADDING_MARGIN.md,
    marginLeft: PADDING_MARGIN.xs,
    fontSize: FONTSIZE.small,
    fontFamily: FONT.semiBold,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: COLOR.textMuted,
  },
});
