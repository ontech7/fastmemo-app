import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackButton from "@/components/buttons/BackButton";
import { SECTION_ADVANCED, SECTION_BASIC, SECTION_FEEDBACK, SECTION_INFO } from "@/components/settings/data";
import Section from "@/components/settings/Section";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function GeneralSettingsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("generalsettings.title")}</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
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
    backgroundColor: COLOR.darkBlue,
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
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  sectionWrapper: {
    marginBottom: PADDING_MARGIN.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.lg,
  },
  sectionHeaderIcon: {
    marginRight: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  sectionItemList: {
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemList_button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.lightBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    fontSize: FONTSIZE.medium,
  },
});
