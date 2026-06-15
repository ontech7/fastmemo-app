import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import { useRouter } from "@/hooks/useRouter";
import Haptics from "@/libs/haptics";
import { getCurrentCategory } from "@/slicers/categoriesSlice";
import { addNote } from "@/slicers/notesSlice";
import { selectorWebhook_addTextNote } from "@/slicers/settingsSlice";
import type { TextNote } from "@/types";
import { formatDateTime } from "@/utils/date";
import { deriveNoteTitle } from "@/utils/string";
import { voiceTextToHtml } from "@/utils/voiceTranscript";
import { webhook } from "@/utils/webhook";
import type { Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ArrowsPointingOutIcon, PaperAirplaneIcon, PencilSquareIcon } from "react-native-heroicons/outline";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useDispatch, useSelector } from "react-redux";
import uuid from "react-uuid";

const MARGIN_TOP = PADDING_MARGIN.md;
const MARGIN_BOTTOM = PADDING_MARGIN.md;
const ROW_MIN_HEIGHT = 46;
const INPUT_LINE_HEIGHT = 22;
// Cap the field at 5 lines; beyond that it scrolls internally so a note full of
// blank lines can never push the bar off-screen.
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * 5;

/**
 * Space the bar reserves above the column's bottom edge while collapsed (its row +
 * bottom margin). The home screen seeds the FAB offset with it; the live height is
 * then reported via `onHeightChange` so the FAB rides above the bar as it grows.
 */
export const QUICK_NOTE_BAR_RESERVED = ROW_MIN_HEIGHT + MARGIN_BOTTOM;

interface Props {
  /** Reports the bar's reserved height (row + bottom margin) so the home screen can keep the FAB above it. */
  onHeightChange?: (height: number) => void;
}

/**
 * "Quick note": an always-present, native plain-text capture bar that lives in the
 * normal flow at the bottom of the home list. It deliberately bypasses the full
 * editor screen — no navigation transition, no pell WebView warm-up, no
 * keyboard-readiness gate — so a note can be jotted the instant the field is tapped
 * (e.g. mid phone call).
 *
 * On send it persists a real {@link TextNote} (the plain text is converted to the
 * exact `<br>`-based HTML pell uses, via {@link voiceTextToHtml}, so the note
 * reopens unchanged in the full editor) with a content-derived title. An empty
 * field saves nothing.
 */
export default function QuickNoteBar({ onHeightChange }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();

  const currentCategory = useSelector(getCurrentCategory);
  const webhook_addText = useSelector(selectorWebhook_addTextNote);

  // The bar sticks to the keyboard by translating up over the list. Its glass row is
  // translucent, so an opaque backdrop fades in with the keyboard to hide the content
  // behind it. At rest (progress 0) the backdrop is invisible, keeping the original
  // glass-over-app-background look (no seam against the background glow).
  const { progress } = useReanimatedKeyboardAnimation();
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const inputRef = useRef<TextInput>(null);
  // Mirror of `text` read by the flush handlers, so saving never trips on a stale
  // closure: it's cleared synchronously before any follow-up press can re-enter.
  const textRef = useRef("");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const hasText = text.trim().length > 0;

  const onChangeText = useCallback((value: string) => {
    textRef.current = value;
    setText(value);
  }, []);

  // Persist whatever is pending as a real TextNote and clear the field. Returns
  // the new note id, or null if there was nothing to save. Clearing the ref first
  // makes a follow-up press/blur a no-op (no double-create).
  const flush = useCallback((): string | null => {
    const body = textRef.current.trim();
    textRef.current = "";
    setText("");
    if (!body) return null;

    const now = Date.now();
    // Stamp updatedAt 1ms after createdAt so the note never reopens as "brand-new":
    // the editors treat `createdAt === updatedAt` as a fresh note and would autofocus
    // the input (and re-fire the add webhook). A quick note is saved already filled, so
    // it should reopen like a normal existing note — read, no keyboard pop.
    const id = uuid();
    const html = voiceTextToHtml(body, { leadingSpace: false });
    const title = deriveNoteTitle(body);

    const note: TextNote = {
      id,
      type: "text",
      title,
      category: currentCategory,
      date: formatDateTime(),
      createdAt: now,
      updatedAt: now + 1,
      important: false,
      locked: false,
      readOnly: false,
      hidden: false,
      deleteDate: null,
      text: html,
    };

    dispatch(addNote(note));
    // Parity with a normally-created note: fire the user's "add text note" webhook.
    webhook(webhook_addText, {
      action: "note/addTextNote",
      id,
      type: "text",
      title,
      createdAt: now,
      updatedAt: now + 1,
      important: false,
      readOnly: false,
      hidden: false,
      locked: false,
      category: { iconId: currentCategory.icon, name: currentCategory.name },
      text: html,
    });

    return id;
  }, [currentCategory, dispatch, webhook_addText]);

  const handleSend = useCallback(() => {
    const id = flush();
    if (id) Haptics.selectionAsync();
    inputRef.current?.blur();
  }, [flush]);

  // Carry whatever's typed into the full editor: persist it, then open that note
  // (or a fresh one if nothing was typed yet) so the user can format / add media.
  const handleExpand = useCallback(() => {
    const id = flush();
    inputRef.current?.blur();
    router.push((id ? `/notes/${id}` : "/notes/new-text") as Href);
  }, [flush, router]);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />

      <Pressable
        style={[styles.bar, focused && styles.barFocused]}
        onPress={() => inputRef.current?.focus()}
        onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height + MARGIN_BOTTOM)}
      >
        <PencilSquareIcon size={20} color={focused ? COLOR.accentSoft : COLOR.textMuted} />

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("home.quickNote")}
          placeholderTextColor={COLOR.textMuted}
          cursorColor={COLOR.softWhite}
          multiline
          scrollEnabled
        />

        {/* Both actions gate on `hasText`, not `focused`: on web, tapping a button blurs the
            input, and a `focused`-gated button would unmount between mousedown and click —
            so its press never fires. `hasText` survives the blur, so the tap lands. */}
        {hasText && (
          <Pressable onPress={handleExpand} hitSlop={8} style={styles.iconButton}>
            <ArrowsPointingOutIcon size={18} color={COLOR.textSecondary} />
          </Pressable>
        )}

        {hasText && (
          <Pressable onPress={handleSend} hitSlop={8} style={styles.sendButton}>
            <PaperAirplaneIcon size={18} color={COLOR.softWhite} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: MARGIN_TOP,
    paddingBottom: MARGIN_BOTTOM,
  },
  // Opaque fill behind the translucent row; its opacity tracks the keyboard so it
  // only hides list content while the bar floats up over it.
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.bg,
  },
  bar: {
    flexDirection: "row",
    // Top-align so the pencil/actions sit with the first line as the field grows.
    alignItems: "flex-start",
    gap: PADDING_MARGIN.sm,
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.md,
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    borderRadius: BORDER.big,
  },
  barFocused: {
    borderColor: COLOR.accentMutedBorder,
  },
  input: {
    flex: 1,
    maxHeight: INPUT_MAX_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    // Android: drop the extra font padding so the first line aligns with the icon.
    includeFontPadding: false,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.paragraph,
    lineHeight: INPUT_LINE_HEIGHT,
    color: COLOR.textPrimary,
  },
  iconButton: {
    padding: PADDING_MARGIN.xs,
  },
  sendButton: {
    padding: PADDING_MARGIN.xs,
    borderRadius: BORDER.rounded,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
});
