import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputKeyPressEvent } from "react-native";
import KeyIcon from "react-native-heroicons/outline/KeyIcon";

import MarkedText from "@/components/ui/MarkedText";
import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, CARD_TYPE_COLOR, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import type { PickerKey } from "@/libs/richTextEditor";
import { fold } from "@/libs/search/fold";
import type { Range } from "@/libs/search/search";
import type { Note } from "@/types";
import { isStringEmpty } from "@/utils/string";

interface Props {
  notes: Note[];
  query: string;
  selected: number;
  onPick: (note: Note) => void;
  /** Opened from the bar's menu: nothing typed in the note is the query, a field at the top is. */
  search?: { value: string; onChange: (text: string) => void; onKey: (key: PickerKey) => void };
}

const KEYS: Record<string, PickerKey> = { ArrowUp: "up", ArrowDown: "down", Enter: "enter", Escape: "escape" };

/** Where the typed part is in a title: the same places in the folded and the shown text (`fold` keeps the length). */
function marked(title: string, query: string): Range[] {
  const wanted = fold(query.normalize("NFC").trim());
  if (!wanted) return [];
  const start = fold(title).indexOf(wanted);
  return start < 0 ? [] : [{ start, end: start + wanted.length }];
}

/**
 * The notes a link can go to (spec B.4), above the text bar: in each row the type's icon (a key for a protected note)
 * and the title, which takes the room, and at the far right the category; the typed part of the title is marked. With no
 * notes it shows nothing, unless it has its own field (from the bar's menu).
 */
export default function NoteLinkPicker({ notes, query, selected, onPick, search }: Props) {
  const { t } = useTranslation();

  if (!notes.length && !search) return null;

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    const key = KEYS[e.nativeEvent.key];
    if (!key || !search) return;
    // The web's field: the arrows would move its caret, Enter would submit nothing.
    (e as unknown as { preventDefault?: () => void }).preventDefault?.();
    search.onKey(key);
  };

  return (
    <View style={styles.picker} accessibilityRole="menu" accessibilityLabel={t("note.format.note_link")}>
      <Text style={styles.heading}>{t("note.format.note_link")}</Text>
      {search && (
        <TextInput
          value={search.value}
          onChangeText={search.onChange}
          onKeyPress={Platform.OS === "web" ? onKeyPress : undefined}
          onSubmitEditing={() => search.onKey("enter")}
          placeholder={t("note.link.search_notes")}
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.textPrimary}
          autoFocus
          autoCorrect={false}
          submitBehavior="submit"
          style={styles.field}
          accessibilityLabel={t("note.link.search_notes")}
        />
      )}
      {notes.map((note, index) => {
        const title = isStringEmpty(note.title) ? t("empty_title") : note.title.normalize("NFC");
        const Icon = NOTE_TYPES.find((type) => type.key === note.type)?.icon;
        const color = CARD_TYPE_COLOR[note.type as keyof typeof CARD_TYPE_COLOR] ?? COLOR.textSecondary;
        const on = index === selected;
        return (
          <Pressable
            key={note.id}
            onPress={() => onPick(note)}
            accessibilityRole="menuitem"
            accessibilityLabel={title}
            style={({ pressed }) => [styles.row, (on || pressed) && styles.rowOn]}
          >
            <View style={styles.left}>
              <View style={styles.chip}>
                {note.locked ? <KeyIcon size={14} color={color} /> : Icon ? <Icon size={14} color={color} /> : null}
              </View>
              <MarkedText
                text={title}
                ranges={isStringEmpty(note.title) ? [] : marked(title, query)}
                style={styles.title}
                numberOfLines={1}
              />
            </View>
            <Text style={styles.category} numberOfLines={1} ellipsizeMode="tail">
              {t(note.category.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  picker: {
    marginHorizontal: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.xs + 3,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: GLASS.border,
    ...SHADOW.card,
  },
  heading: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.xs,
    paddingBottom: PADDING_MARGIN.xs + 2,
    color: COLOR.textMuted,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.small,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  field: {
    marginBottom: PADDING_MARGIN.xs,
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: COLOR.bg,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  rowOn: {
    backgroundColor: GLASS.fill,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
  },
  chip: {
    width: 26,
    height: 26,
    borderRadius: BORDER.small,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fillStrong,
  },
  title: {
    flexShrink: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.medium,
  },
  category: {
    flexShrink: 0,
    maxWidth: "40%",
    color: COLOR.textMuted,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.small,
  },
});
