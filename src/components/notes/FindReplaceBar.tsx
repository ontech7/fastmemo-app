import { SHORTCUT_TARGET } from "@/constants/shortcuts";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { DURATION } from "@/constants/motion";
import type { FindCount, FindTarget } from "@/libs/findTarget";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, type TextInputInstance, TouchableOpacity, View, ViewStyle } from "react-native";
import ChevronDownIcon from "react-native-heroicons/outline/ChevronDownIcon";
import ChevronUpIcon from "react-native-heroicons/outline/ChevronUpIcon";
import XMarkIcon from "react-native-heroicons/outline/XMarkIcon";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

const BAR_ENTERING = FadeInDown.duration(DURATION.base);
const BAR_EXITING = FadeOutUp.duration(DURATION.fast);

interface Props {
  visible: boolean;
  onClose: () => void;
  /** What is searched: the note's page, through its editor (`libs/findTarget`). */
  target: FindTarget;
  /** A read-only note: find only. Its text can't change, so replace would only make the count go down. */
  readOnly?: boolean;
  /** Opened by a search result: the field starts with this text, the search runs, the field doesn't take the focus. */
  initialQuery?: string;
  /** When this changes while the bar is open, the search runs again (a code note's open tab). */
  scope?: string;
  /** Called just before a replace all is sent. */
  onBeforeReplaceAll?: () => void;
  style?: ViewStyle;
}

export default function FindReplaceBar({
  visible,
  onClose,
  target,
  readOnly,
  initialQuery,
  scope,
  onBeforeReplaceAll,
  style,
}: Props) {
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [count, setCount] = useState<FindCount>({ total: 0, current: 0 });
  const [showReplace, setShowReplace] = useState(false);
  const matchCount = count.total;
  const currentMatch = count.current;

  const searchInputRef = useRef<TextInputInstance>(null);

  useEffect(() => target.subscribe(setCount), [target]);

  // Opened by a search result: its word goes in the field once (searched by the effect below), and again only after the
  // parent has cleared it.
  const [appliedQuery, setAppliedQuery] = useState<string | undefined>(undefined);
  if (visible && initialQuery && initialQuery !== appliedQuery) {
    setAppliedQuery(initialQuery);
    setSearchText(initialQuery);
  } else if (!initialQuery && appliedQuery !== undefined) {
    setAppliedQuery(undefined);
  }

  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      // From a search result the keyboard stays down: the person came to read the match.
      if (!initialQuery) setTimeout(() => searchInputRef.current?.focus(), 200);
    } else if (wasVisibleRef.current) {
      wasVisibleRef.current = false;
      setSearchText("");
      setReplaceText("");
      target.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const navigateMatch = useCallback(
    (direction: "next" | "prev") => {
      if (matchCount === 0) return;
      target.step(direction);
    },
    [matchCount, target]
  );

  const replaceCurrentMatch = useCallback(() => {
    if (matchCount === 0 || !searchText) return;
    target.replace(searchText, replaceText);
  }, [matchCount, searchText, replaceText, target]);

  const replaceAll = useCallback(() => {
    if (matchCount === 0 || !searchText) return;
    onBeforeReplaceAll?.();
    target.replaceAll(searchText, replaceText);
  }, [matchCount, searchText, replaceText, target, onBeforeReplaceAll]);

  // The search runs as the field changes (after a pause), and again when the scope (a code note's tab) changes.
  useEffect(() => {
    if (!visible) return;
    // The word a search result opened the note on: shown, with the keyboard down (the person came to read it).
    const keepKeyboardDown = !!initialQuery && searchText === initialQuery;
    const timer = setTimeout(() => target.search(searchText, { keepKeyboardDown }), 300);
    return () => clearTimeout(timer);
  }, [visible, searchText, initialQuery, target, scope]);

  if (!visible) return null;

  return (
    <Animated.View entering={BAR_ENTERING} exiting={BAR_EXITING} style={[styles.container, style]}>
      <View style={styles.row}>
        <TextInput
          ref={searchInputRef}
          style={styles.input}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t("note.find_replace.search_placeholder")}
          placeholderTextColor={COLOR.textSecondary}
          cursorColor={COLOR.softWhite}
          returnKeyType="search"
          testID={SHORTCUT_TARGET.find}
          onSubmitEditing={() => navigateMatch("next")}
        />
        <Text style={styles.matchCount}>{matchCount > 0 ? `${currentMatch}/${matchCount}` : "0/0"}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.iconButton}
          onPress={() => navigateMatch("prev")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.previous_match")}
          disabled={matchCount === 0}
        >
          <ChevronUpIcon size={18} color={matchCount > 0 ? COLOR.softWhite : COLOR.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.iconButton}
          onPress={() => navigateMatch("next")}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.next_match")}
          disabled={matchCount === 0}
        >
          <ChevronDownIcon size={18} color={matchCount > 0 ? COLOR.softWhite : COLOR.textMuted} />
        </TouchableOpacity>
        {!readOnly && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconButton}
            onPress={() => setShowReplace(!showReplace)}
            accessibilityRole="button"
            aria-expanded={showReplace}
          >
            <Text style={[styles.toggleText, showReplace && { color: COLOR.accentSoft }]}>
              {t("note.find_replace.replace_short")}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.iconButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.close")}
        >
          <XMarkIcon size={18} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>
      {showReplace && !readOnly && (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={replaceText}
            onChangeText={setReplaceText}
            placeholder={t("note.find_replace.replace_placeholder")}
            placeholderTextColor={COLOR.textSecondary}
            cursorColor={COLOR.softWhite}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.actionButton}
            onPress={replaceCurrentMatch}
            disabled={matchCount === 0}
          >
            <Text style={[styles.actionButtonText, matchCount === 0 && { color: COLOR.textMuted }]}>
              {t("note.find_replace.replace_one")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.actionButton} onPress={replaceAll} disabled={matchCount === 0}>
            <Text style={[styles.actionButtonText, matchCount === 0 && { color: COLOR.textMuted }]}>
              {t("note.find_replace.replace_all")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    marginHorizontal: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 2 },
  input: {
    flex: 1,
    // a web field keeps the width of its 20 characters otherwise, and pushed the close button off a phone's screen
    minWidth: 0,
    backgroundColor: COLOR.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.rounded,
    paddingHorizontal: PADDING_MARGIN.lg,
    paddingVertical: PADDING_MARGIN.sm,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  matchCount: { color: COLOR.textMuted, fontFamily: FONT.medium, fontSize: FONTSIZE.small, minWidth: 36, textAlign: "center" },
  iconButton: { padding: 6 },
  toggleText: { color: COLOR.textSecondary, fontSize: FONTSIZE.small, fontFamily: FONT.semiBold },
  actionButton: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingVertical: 6,
    backgroundColor: GLASS.fillStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.rounded,
  },
  actionButtonText: { color: COLOR.textPrimary, fontFamily: FONT.medium, fontSize: FONTSIZE.small },
});
