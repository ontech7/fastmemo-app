import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import BackButton from "@/components/buttons/BackButton";
import SafeAreaView from "@/components/SafeAreaView";
import SelectableCardList, { type SelectableCardItem } from "@/components/lists/SelectableCardList";
import { NOTE_TYPES } from "@/constants/note-types";
import { COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import { selectorNoteCreation, setNoteCreation } from "@/slicers/settingsSlice";
import type { NoteCreationMode, NoteCreationType } from "@/types";

export default function NoteCreationScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const noteCreation = useSelector(selectorNoteCreation);

  const modeItems = useMemo<SelectableCardItem<NoteCreationMode>[]>(
    () => [
      {
        id: "simple",
        label: t("note_creation.mode.simple"),
        description: t("note_creation.mode.simple_description"),
      },
      {
        id: "smart",
        label: t("note_creation.mode.smart"),
        description: t("note_creation.mode.smart_description"),
      },
      {
        id: "adaptive",
        label: t("note_creation.mode.adaptive"),
        description: t("note_creation.mode.adaptive_description"),
      },
    ],
    [t]
  );

  const typeItems = useMemo<SelectableCardItem<NoteCreationType>[]>(
    () =>
      NOTE_TYPES.map((noteType) => ({
        id: noteType.key as NoteCreationType,
        label: t(noteType.labelKey),
      })),
    [t]
  );

  const selectMode = useCallback(
    (mode: NoteCreationMode) => {
      dispatch(setNoteCreation({ ...noteCreation, mode }));
    },
    [dispatch, noteCreation]
  );

  const selectSmartType = useCallback(
    (smartType: NoteCreationType) => {
      dispatch(setNoteCreation({ ...noteCreation, smartType }));
    },
    [dispatch, noteCreation]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("note_creation.title")}</Text>
        <View style={{ padding: PADDING_MARGIN.md }} />
      </View>

      <ScrollView>
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>{t("note_creation.mode_section")}</Text>
          </View>
          <SelectableCardList<NoteCreationMode> items={modeItems} selectedId={noteCreation.mode} onSelect={selectMode} />
        </View>

        {noteCreation.mode === "smart" && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>{t("note_creation.default_type_section")}</Text>
            </View>
            <SelectableCardList<NoteCreationType>
              items={typeItems}
              selectedId={noteCreation.smartType}
              onSelect={selectSmartType}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  sectionWrapper: {
    marginTop: PADDING_MARGIN.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
  },
  sectionHeaderTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    paddingVertical: PADDING_MARGIN.sm,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
