import aiLottieJson from "~/assets/lottie/AI_Loader.json";
import lottieJson from "~/assets/lottie/Logo.json";
import CloseButton from "@/components/buttons/CloseButton";
import ChangelogItem from "@/components/changelog/ChangelogItem";
import LottieView from "@/components/lottie/LottieAnimation";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

function getVersionChangelogs(t: (key: string) => string) {
  return Platform.OS === "web"
    ? [
        { version: "v1.1.1", text: t("changelog.web.description_1_1_1") },
        { version: "v1.0.0", text: t("changelog.web.description_1_0_0") },
        { version: "v0.3.1", text: t("changelog.web.description_0_3_0") },
        { version: "v0.2.1", text: t("changelog.web.description_0_2_0") },
        { version: "v0.1.1", text: t("changelog.web.description_0_1_1") },
        { version: "v0.1.0", text: t("changelog.web.description_0_1_0") },
      ]
    : [
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

  const changelogs = useMemo(() => getVersionChangelogs(t), [t]);

  const logoAnimRef = useRef<any>(null);
  const aiAnimRef = useRef<any>(null);

  useEffect(() => {
    logoAnimRef.current?.play();
    aiAnimRef.current?.play();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>{t("changelog.title")}</Text>
        <CloseButton chip />
      </View>

      <ScrollView>
        <View style={styles.iconWrapper}>
          <LottieView ref={logoAnimRef} style={styles.icon} source={lottieJson} loop={false} />
          {Platform.OS !== "web" && (
            <>
              <Text style={styles.plusSign}>+</Text>
              <LottieView ref={aiAnimRef} style={styles.icon} source={aiLottieJson} loop />
            </>
          )}
        </View>

        {changelogs.map((changelog, index) => (
          <ChangelogItem
            key={`changelog-${changelog.version}`}
            version={changelog.version}
            text={changelog.text}
            isFirst={index === 0}
            isLast={index === changelogs.length - 1}
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
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FONTSIZE.subtitle,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  iconWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: PADDING_MARGIN.xl,
  },
  icon: {
    height: 75,
    width: 75,
  },
  plusSign: {
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    marginHorizontal: PADDING_MARGIN.sm,
  },
});
