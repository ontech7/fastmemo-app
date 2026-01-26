import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  FolderPlusIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusIcon,
  RectangleGroupIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={{ padding: PADDING_MARGIN.md }}></View>
      </View>

      <ScrollView style={{ paddingHorizontal: PADDING_MARGIN.lg }}>
        <Accordion title={t("help.how_to_create_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_create_note.text_1_0")} <PlusIcon color={COLOR.softWhite} /> {t("help.how_to_create_note.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_note.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_note.text_3_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_create_todo_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_create_todo_note.text_1_0")} <ListBulletIcon color={COLOR.softWhite} />{" "}
            {t("help.how_to_create_note.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_4_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_5_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_6_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_7_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_8_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_todo_note.text_9_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_edit_note.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_to_edit_note.text_1_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_delete_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_delete_note.text_1_0")} <EllipsisVerticalIcon color={COLOR.softWhite} />{" "}
            {t("help.how_to_delete_note.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_delete_note.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_select_notes.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_to_select_notes.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_select_notes.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_toolbar_below.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_1_0")}</Text>

          <Text></Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_4_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_5_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_6_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_7_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_8_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_9_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_toolbar_below.text_10_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_are_settings_note.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_1_0")}</Text>

          <Text></Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_4_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_5_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_6_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_settings_note.text_7_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_create_category.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_1_0")} <RectangleGroupIcon color={COLOR.softWhite} />{" "}
            {t("help.how_create_category.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_2_0")} <FolderPlusIcon color={COLOR.softWhite} />{" "}
            {t("help.how_create_category.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_create_category.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_4_0")} <CheckIcon color={COLOR.softWhite} />{" "}
            {t("help.how_create_category.text_4_1")}
          </Text>
        </Accordion>

        <Accordion title={t("help.how_edit_category.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_1_0")} <RectangleGroupIcon color={COLOR.softWhite} />{" "}
            {t("help.how_create_category.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_create_category.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_organize_categories.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_1_0")} <RectangleGroupIcon color={COLOR.softWhite} />{" "}
            {t("help.how_organize_categories.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_2_0")} <PencilSquareIcon color={COLOR.softWhite} />{" "}
            {t("help.how_organize_categories.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_organize_categories.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_4_0")} <CheckIcon color={COLOR.softWhite} />{" "}
            {t("help.how_organize_categories.text_4_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_5_0")} <XMarkIcon color={COLOR.softWhite} />{" "}
            {t("help.how_organize_categories.text_5_1")}
          </Text>
        </Accordion>

        <Accordion title={t("help.how_delete_category.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_organize_categories.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_2_0")} <XMarkIcon color={COLOR.softWhite} />{" "}
            {t("help.how_organize_categories.text_2_1")}
          </Text>
        </Accordion>

        <Accordion title={t("help.what_are_trashed_notes.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_are_trashed_notes.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_are_trashed_notes.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_restore_trashed_notes.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_restore_trashed_notes.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_trashed_notes.text_2_0")} <EllipsisVerticalIcon color={COLOR.softWhite} />{" "}
            {t("help.how_restore_trashed_notes.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_trashed_notes.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_trashed_notes.text_4_0")} <EllipsisVerticalIcon color={COLOR.softWhite} />{" "}
            {t("help.how_restore_trashed_notes.text_4_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_trashed_notes.text_5_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_restore_delete_notes.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_restore_delete_notes.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_delete_notes.text_2_0")} <EllipsisVerticalIcon color={COLOR.softWhite} />{" "}
            {t("help.how_restore_delete_notes.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_delete_notes.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_delete_notes.text_4_0")} <EllipsisVerticalIcon color={COLOR.softWhite} />{" "}
            {t("help.how_restore_delete_notes.text_4_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_delete_notes.text_5_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_cloud_sync.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_cloud_sync.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_cloud_sync.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_secret_code.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_secret_code.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_secret_code.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_import_export.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_import_export.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_import_export.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_import_export.text_3_0")}</Text>
        </Accordion>

        <Accordion title={t("help.what_wipe_data.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.what_wipe_data.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_wipe_data.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.what_wipe_data.text_3_0")}</Text>
        </Accordion>
      </ScrollView>
    </SafeAreaView>
  );
}

const Accordion = ({ title, children }) => {
  const [isOpenAccordion, setIsOpenAccordion] = useState(false);

  const toggleAccordion = () => setIsOpenAccordion((prev) => !prev);

  return (
    <View style={styles.sectionWrapper}>
      <TouchableOpacity activeOpacity={0.7} style={styles.sectionHeader} onPress={toggleAccordion}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>

        <ChevronDownIcon
          style={{
            transform: [
              {
                rotate: isOpenAccordion ? "180deg" : "0deg",
              },
            ],
          }}
          color={COLOR.lightBlue}
        />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sectionList,
          {
            height: isOpenAccordion ? "auto" : 0,
            paddingVertical: isOpenAccordion ? PADDING_MARGIN.md : 0,
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

/* STYLES */

const styles = StyleSheet.create({
  container: {
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
    marginBottom: PADDING_MARGIN.lg,
    backgroundColor: COLOR.boldBlue,
    borderRadius: BORDER.normal,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
    borderBottomWidth: 1,
    borderColor: COLOR.darkBlue,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  sectionList: {
    height: 0,
    borderRadius: BORDER.normal,
    overflow: "hidden",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: 0,
  },
  accordionWrapper: {
    height: SIZE.full,
  },
  sectionItemList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    marginBottom: PADDING_MARGIN.sm,
  },
});
