import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import UsersIcon from "react-native-heroicons/outline/UsersIcon";

import { useNoteOpenElsewhere } from "@/libs/cloud/presence";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  noteId: string;
}

/** "Open on <device>": another synced device has this note open (its changes show up here as they're saved). */
export default function NotePresenceBanner({ noteId }: Props) {
  const { t } = useTranslation();
  const devices = useNoteOpenElsewhere(noteId);

  if (!devices) return null;

  return (
    <View style={styles.banner} accessibilityRole="text">
      <UsersIcon size={14} color={COLOR.accentSoft} />
      <Text style={styles.text} numberOfLines={1}>
        {t("cloudsync.open_on", { devices })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    maxWidth: "90%",
    marginTop: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.xs + 1,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.rounded,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.fill,
  },
  text: {
    flexShrink: 1,
    color: COLOR.textSecondary,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
  },
});
