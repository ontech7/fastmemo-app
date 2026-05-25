import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { selectorDeveloperMode, setDeveloperMode } from "@/slicers/settingsSlice";
import type { DeveloperModeSettings } from "@/types";

export default function DeveloperOptionsScreen() {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const developerMode = useSelector(selectorDeveloperMode);

  const updateSetting = useCallback(
    <K extends keyof DeveloperModeSettings>(key: K, value: DeveloperModeSettings[K]) => {
      dispatch(setDeveloperMode({ ...developerMode, [key]: value }));
    },
    [developerMode, dispatch]
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />

        <Text style={styles.headerTitle}>{t("developeroptions.title")}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <ExclamationTriangleIcon size={20} color={COLOR.yellow} />
          <Text style={styles.warningText}>{t("developeroptions.warning")}</Text>
        </View>

        {/* Toggles */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionList}>
            <View style={styles.sectionItemList}>
              <View style={styles.sectionItemContent}>
                <Text style={styles.sectionItemList_title}>{t("developeroptions.unlimited_text_space")}</Text>
                <Text style={styles.sectionItemList_desc}>{t("developeroptions.unlimited_text_space_desc")}</Text>
              </View>

              <Switch
                trackColor={{ false: COLOR.surfaceMuted, true: COLOR.accentMuted }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => updateSetting("unlimitedTextSpace", value)}
                value={developerMode.unlimitedTextSpace}
                style={{ height: 25 }}
              />
            </View>

            <View style={styles.sectionItemList}>
              <View style={styles.sectionItemContent}>
                <Text style={styles.sectionItemList_title}>{t("developeroptions.unlimited_kanban_columns")}</Text>
                <Text style={styles.sectionItemList_desc}>{t("developeroptions.unlimited_kanban_columns_desc")}</Text>
              </View>

              <Switch
                trackColor={{ false: COLOR.surfaceMuted, true: COLOR.accentMuted }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => updateSetting("unlimitedKanbanColumns", value)}
                value={developerMode.unlimitedKanbanColumns}
                style={{ height: 25 }}
              />
            </View>

            <View style={styles.sectionItemList}>
              <View style={styles.sectionItemContent}>
                <Text style={styles.sectionItemList_title}>{t("developeroptions.unlimited_trash_time")}</Text>
                <Text style={styles.sectionItemList_desc}>{t("developeroptions.unlimited_trash_time_desc")}</Text>
              </View>

              <Switch
                trackColor={{ false: COLOR.surfaceMuted, true: COLOR.accentMuted }}
                thumbColor={COLOR.softWhite}
                onValueChange={(value: boolean) => updateSetting("unlimitedTrashTime", value)}
                value={developerMode.unlimitedTrashTime}
                style={{ height: 25 }}
              />
            </View>

            {/* Change App Icon */}
            <View style={[styles.sectionItemList, styles.sectionItemList_last, { opacity: 0.5 }]}>
              <View style={styles.sectionItemContent}>
                <Text style={styles.sectionItemList_title}>{t("developeroptions.change_app_icon")}</Text>
                <Text style={styles.sectionItemList_desc}>{t("developeroptions.change_app_icon_desc")}</Text>
              </View>
            </View>
          </View>
        </View>
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
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.darkYellow + "20",
    borderWidth: 1,
    borderColor: COLOR.darkYellow + "50",
    borderRadius: BORDER.normal,
    padding: PADDING_MARGIN.lg,
    gap: PADDING_MARGIN.md,
  },
  warningText: {
    flex: 1,
    color: COLOR.yellow,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.xl,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1,
    borderColor: GLASS.border,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemContent: {
    flex: 1,
    marginRight: PADDING_MARGIN.md,
  },
  sectionItemList_title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_desc: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.xs,
  },
});
