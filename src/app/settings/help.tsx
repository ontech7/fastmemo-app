import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
import AppBackground from "@/components/ui/AppBackground";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SIZE } from "@/constants/styles";

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <BackButton chip />
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={{ paddingHorizontal: PADDING_MARGIN.lg }}>
        <Accordion title={t("help.how_to_create_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_create_note.text_1_0")} <PlusIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_to_create_note.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_note.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_note.text_3_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_create_todo_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_create_todo_note.text_1_0")} <ListBulletIcon color={COLOR.textSecondary} />{" "}
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

        <Accordion title={t("help.how_to_create_kanban_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_create_kanban_note.text_1_0")} <PlusIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_to_create_kanban_note.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_2_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_4_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_5_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_6_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_7_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_8_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_9_0")}</Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_to_create_kanban_note.text_10_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_edit_note.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_to_edit_note.text_1_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_to_delete_note.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_to_delete_note.text_1_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} />{" "}
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
            {t("help.how_create_category.text_1_0")} <RectangleGroupIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_create_category.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_2_0")} <FolderPlusIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_create_category.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_create_category.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_4_0")} <CheckIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_create_category.text_4_1")}
          </Text>
        </Accordion>

        <Accordion title={t("help.how_edit_category.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_create_category.text_1_0")} <RectangleGroupIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_create_category.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_create_category.text_2_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_organize_categories.title")}>
          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_1_0")} <RectangleGroupIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_organize_categories.text_1_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_2_0")} <PencilSquareIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_organize_categories.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_organize_categories.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_4_0")} <CheckIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_organize_categories.text_4_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_5_0")} <XMarkIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_organize_categories.text_5_1")}
          </Text>
        </Accordion>

        <Accordion title={t("help.how_delete_category.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_organize_categories.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_organize_categories.text_2_0")} <XMarkIcon color={COLOR.textSecondary} />{" "}
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
            {t("help.how_restore_trashed_notes.text_2_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_restore_trashed_notes.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_trashed_notes.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_trashed_notes.text_4_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_restore_trashed_notes.text_4_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_trashed_notes.text_5_0")}</Text>
        </Accordion>

        <Accordion title={t("help.how_restore_delete_notes.title")}>
          <Text style={styles.sectionItemList_text}>{t("help.how_restore_delete_notes.text_1_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_delete_notes.text_2_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} />{" "}
            {t("help.how_restore_delete_notes.text_2_1")}
          </Text>

          <Text style={styles.sectionItemList_text}>{t("help.how_restore_delete_notes.text_3_0")}</Text>

          <Text style={styles.sectionItemList_text}>
            {t("help.how_restore_delete_notes.text_4_0")} <EllipsisVerticalIcon color={COLOR.textSecondary} />{" "}
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

        {Platform.OS !== "web" && (
          <Accordion title={t("help.what_ai_assistant.title")}>
            <Text style={styles.sectionItemList_text}>{t("help.what_ai_assistant.text_1_0")}</Text>

            <Text style={styles.sectionItemList_text}>{t("help.what_ai_assistant.text_2_0")}</Text>

            <Text style={styles.sectionItemList_text}>{t("help.what_ai_assistant.text_3_0")}</Text>

            <Text style={styles.sectionItemList_text}>{t("help.what_ai_assistant.text_4_0")}</Text>
          </Accordion>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

const Accordion = ({ title, children }: AccordionProps) => {
  const [isOpenAccordion, setIsOpenAccordion] = useState(false);

  const toggleAccordion = () => setIsOpenAccordion((prev: boolean) => !prev);

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
          color={COLOR.textSecondary}
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
    fontSize: FONTSIZE.intro,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  sectionWrapper: {
    marginBottom: PADDING_MARGIN.lg,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.md,
  },
  sectionHeaderTitle: {
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
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
    borderColor: GLASS.border,
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
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
  },
  sectionItemList_text: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    marginBottom: PADDING_MARGIN.sm,
  },
});
