import React, { useEffect, useMemo, useRef } from "react";
import LottieView from "lottie-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CloseButton from "@/components/buttons/CloseButton";
import ChangelogItem from "@/components/changelog/ChangelogItem";

import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import lottieJson from "../assets/lottie/Logo.json";

function getVersionChangelogs(t) {
  return [
    { version: "v2.4.0", text: t("changelog.description_2_4_0") },
    { version: "v2.3.0", text: t("changelog.description_2_3_0") },
    { version: "v2.2.1", text: t("changelog.description_2_2_0") },
    { version: "v2.1.0", text: t("changelog.description_2_1_0") },
    { version: "v2.0.0", text: t("changelog.description_2_0_0") },
    { version: "v1.4.0", text: t("changelog.description_1_4_0") },
    { version: "v1.3.0", text: t("changelog.description_1_3_0") },
    { version: "v1.2.1", text: t("changelog.description_1_2_1") },
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
