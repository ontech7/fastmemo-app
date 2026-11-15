import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmptyCategoriesIllustration from "@/components/ui/illustrations/EmptyCategoriesIllustration";
import EmptyCategoryIllustration from "@/components/ui/illustrations/EmptyCategoryIllustration";
import EmptyListIllustration from "@/components/ui/illustrations/EmptyListIllustration";
import EmptyNotesIllustration from "@/components/ui/illustrations/EmptyNotesIllustration";
import EmptySearchIllustration from "@/components/ui/illustrations/EmptySearchIllustration";
import EmptyTrashIllustration from "@/components/ui/illustrations/EmptyTrashIllustration";
import { COLOR, FONT, FONTSIZE, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  variant: "notes" | "category" | "categories" | "search" | "trash" | "history" | "list";
  /** `category`: the icon of the category being shown. */
  categoryIcon?: string;
  /** `notes`: whether the quick note bar is on (the text mentions it only then). */
  quickNote?: boolean;
  /** `trash`: the days notes stay there; undefined when they stay until removed (the developer option). */
  days?: number;
  /** `list`: the list can't be changed (no + to point at). */
  readOnly?: boolean;
  /** Room kept free at the bottom (the add button, the tour's tip); 0 centres the block in its area. */
  bottomRoom?: number;
}

/*
 * What an empty list says (spec 5.3): a drawing in the "ghost cards" style, a title and one sentence, centred in the
 * list's area. Passed as a list's `ListEmptyComponent`, whose content container grows to the list's height. With the
 * keyboard up (a search typed) the list keeps its height under the keyboard, and the add button rides above the keyboard:
 * the block rises by half the part the keyboard covers, centred in what is still visible, clear of the button.
 */
export default function EmptyState({
  variant,
  categoryIcon,
  quickNote = true,
  days,
  readOnly = false,
  bottomRoom = BOTTOM_ROOM,
}: Props) {
  const { t } = useTranslation();

  // `height` is the keyboard's, negative while it is up; the bottom inset is already below the list.
  const { height } = useReanimatedKeyboardAnimation();
  const { bottom } = useSafeAreaInsets();
  const keyboardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(0, (height.value + bottom) / 2) }],
  }));

  let drawing;
  let title: string;
  let text: string;
  switch (variant) {
    case "notes":
      drawing = <EmptyNotesIllustration />;
      title = t("empty.notes_title");
      text = quickNote ? t("empty.notes_text") : t("empty.notes_text_no_quick");
      break;
    case "category":
      drawing = categoryIcon ? <EmptyCategoryIllustration categoryIcon={categoryIcon} /> : <EmptyNotesIllustration />;
      title = t("empty.category_title");
      text = t("empty.category_text");
      break;
    case "categories":
      drawing = <EmptyCategoriesIllustration />;
      title = t("empty.categories_title");
      text = t("empty.categories_text");
      break;
    case "search":
      drawing = <EmptySearchIllustration />;
      title = t("empty.search_title");
      text = t("empty.search_text");
      break;
    case "trash":
      drawing = <EmptyTrashIllustration />;
      title = t("empty.trash_title");
      text = days === undefined ? t("empty.trash_text_unlimited") : t("empty.trash_text", { days });
      break;
    case "history":
      // plan 1's drawing of an empty list: no drawing of its own (spec B.9)
      drawing = <EmptyNotesIllustration />;
      title = t("history.empty_title");
      text = t("history.empty_text");
      break;
    case "list":
      drawing = <EmptyListIllustration />;
      title = t("empty.list_title");
      text = readOnly ? t("empty.list_text_read_only") : t("empty.list_text");
      break;
  }

  return (
    <Animated.View style={[styles.container, { paddingBottom: bottomRoom }, keyboardStyle]}>
      <View style={styles.drawing}>{drawing}</View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Room kept free at the bottom of the list's area: the add button, and the first-note tour's tip above it, which must not
 * cover the text. The block is centred in what is left, a little above the middle.
 */
const BOTTOM_ROOM = 160;

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  drawing: {
    marginBottom: PADDING_MARGIN.sm,
  },
  title: {
    color: COLOR.textPrimary,
    fontFamily: FONT.semiBold,
    fontSize: FONTSIZE.paragraph,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  text: {
    maxWidth: 260,
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
    lineHeight: 20,
    textAlign: "center",
  },
});
