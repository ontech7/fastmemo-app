import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import { SECTION_ADVANCED, SECTION_BASIC, SECTION_FEEDBACK, SECTION_INFO } from "@/components/settings/data";
import Section from "@/components/settings/Section";
import AppBackground from "@/components/ui/AppBackground";

import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

export default function GeneralSettingsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("generalsettings.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={{ paddingHorizontal: PADDING_MARGIN.lg }}>
        <Section title={t("generalsettings.basic")} icon="settings" sectionItems={SECTION_BASIC} />
        <Section title={t("generalsettings.advanced")} icon="cmd" sectionItems={SECTION_ADVANCED} />
        <Section title={t("generalsettings.about")} icon="rocket" sectionItems={SECTION_INFO} />
        <Section title={t("generalsettings.feedback_and_help")} icon="email" sectionItems={SECTION_FEEDBACK} />
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
});
