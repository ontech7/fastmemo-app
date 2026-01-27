import CloseButton from "@/components/buttons/CloseButton";
import ChangelogItem from "@/components/changelog/ChangelogItem";
import LottieView from "@/components/lottie/LottieAnimation";
import SafeAreaView from "@/components/SafeAreaView";
import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import lottieJson from "../assets/lottie/Logo.json";

function getVersionChangelogs(t) {
  return Platform.OS === "web"
    ? [{ version: "v0.1.0-beta", text: t("changelog.web.description_0_1_0") }]
    : [
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

  const logoAnimRef = useRef(null);

  useEffect(() => {
    logoAnimRef.current?.play();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ padding: PADDING_MARGIN.md }} />
        <Text style={styles.headerTitle}>{t("changelog.title")}</Text>
        <CloseButton style={{ marginRight: PADDING_MARGIN.sm }} />
      </View>

      <ScrollView>
        <View style={styles.iconWrapper}>
          <LottieView ref={logoAnimRef} style={styles.icon} source={lottieJson} loop={false} />
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
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  iconWrapper: {
    alignItems: "center",
    marginBottom: PADDING_MARGIN.xl,
  },
  icon: {
    height: 75,
    width: 75,
  },
});
