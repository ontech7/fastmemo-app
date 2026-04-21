import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
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
      <View style={styles.header}>
        <BackButton />

        <Text style={styles.headerTitle}>{t("developeroptions.title")}</Text>

        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <ScrollView>
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
                trackColor={{ false: COLOR.lightGray, true: COLOR.darkYellow + "60" }}
                thumbColor={developerMode.unlimitedTextSpace ? COLOR.yellow : COLOR.softWhite}
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
                trackColor={{ false: COLOR.lightGray, true: COLOR.darkYellow + "60" }}
                thumbColor={developerMode.unlimitedKanbanColumns ? COLOR.yellow : COLOR.softWhite}
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
                trackColor={{ false: COLOR.lightGray, true: COLOR.darkYellow + "60" }}
                thumbColor={developerMode.unlimitedTrashTime ? COLOR.yellow : COLOR.softWhite}
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
    flex: 1,
    paddingTop: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.lg,
    backgroundColor: COLOR.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.xl,
  },
  headerTitle: {
    flexGrow: 1,
    textAlign: "center",
    fontSize: FONTSIZE.intro,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
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
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
  },
  sectionWrapper: {
    marginTop: PADDING_MARGIN.xl,
  },
  sectionList: {
    borderRadius: BORDER.normal,
    overflow: "hidden",
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLOR.boldBlue,
    padding: PADDING_MARGIN.lg,
    borderBottomWidth: 1.5,
    borderColor: COLOR.darkBlue,
  },
  sectionItemList_last: {
    borderBottomWidth: 0,
  },
  sectionItemContent: {
    flex: 1,
    marginRight: PADDING_MARGIN.md,
  },
  sectionItemList_title: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_desc: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.xs,
  },
});
