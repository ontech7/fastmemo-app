import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import type { AIModelId, EditorAction, LongNoteAction, LongNoteProgress } from "@/libs/ai";
import {
  cancelCommand,
  clearLongNoteCache,
  createTextStream,
  createThrottle,
  findCategoryByName,
  generateEditorContent,
  hasSummary,
  isModelSufficient,
  LONG_NOTE_ACTIONS,
  MODEL_SHORT_LABEL,
  prewarmContext,
  resolveLanguage,
  rewriteNote,
  summarizeNote,
  tooLongForAI,
  TRANSLATE_LANGUAGES,
  withSummary,
} from "@/libs/ai";
import { selectorAIAssistant } from "@/slicers/settingsSlice";
import type { NoteType } from "@/types/note";
import { toast } from "@/utils/toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance, ViewStyle } from "react-native";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import CheckBadgeIcon from "react-native-heroicons/outline/CheckBadgeIcon";
import CheckIcon from "react-native-heroicons/outline/CheckIcon";
import DocumentTextIcon from "react-native-heroicons/outline/DocumentTextIcon";
import FolderIcon from "react-native-heroicons/outline/FolderIcon";
import LanguageIcon from "react-native-heroicons/outline/LanguageIcon";
import ListBulletIcon from "react-native-heroicons/outline/ListBulletIcon";
import ScissorsIcon from "react-native-heroicons/outline/ScissorsIcon";
import SparklesIcon from "react-native-heroicons/outline/SparklesIcon";
import TagIcon from "react-native-heroicons/outline/TagIcon";
import CheckCircleIcon from "react-native-heroicons/solid/CheckCircleIcon";
import ExclamationCircleIcon from "react-native-heroicons/solid/ExclamationCircleIcon";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSelector } from "react-redux";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ANIM_OPEN = 250;
const ANIM_CLOSE = 150;
const FEEDBACK_DURATION = 1500;

const AI_COLOR = "#6C63FF";

/** The share of the window a preview box takes before it scrolls: the result, what the user reads, gets more. */
const BEFORE_MAX_HEIGHT = 0.2;
const AFTER_MAX_HEIGHT = 0.3;
/** How near its end the result box still counts as at the end, where it follows what the model writes. */
const AT_END_SLACK = 24;

const isAtEnd = ({ contentOffset, contentSize, layoutMeasurement }: NativeScrollEvent) =>
  contentOffset.y + layoutMeasurement.height >= contentSize.height - AT_END_SLACK;

type FeedbackState = "idle" | "processing" | "success" | "error";

/** Actions whose answer replaces something the user wrote: it streams into a before/after preview and waits for Apply. */
const PREVIEW_ACTIONS = new Set<EditorAction>([
  "generate_title",
  "suggest_category",
  "summarize",
  "fix_grammar",
  "shorten",
  "translate",
]);

const NO_ACTIONS: ReadonlySet<EditorAction> = new Set();

interface ActionDef {
  id: EditorAction;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  /** Minimum model required. If undefined, works with any model. */
  minModelId?: AIModelId;
}

const TEXT_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "summarize", labelKey: "ai.editor.summarize", icon: DocumentTextIcon, minModelId: "qwen3.5-2b" },
  { id: "fix_grammar", labelKey: "ai.editor.fix_grammar", icon: CheckBadgeIcon, minModelId: "qwen3.5-2b" },
  { id: "shorten", labelKey: "ai.editor.shorten", icon: ScissorsIcon, minModelId: "qwen3.5-2b" },
  { id: "translate", labelKey: "ai.editor.translate", icon: LanguageIcon, minModelId: "qwen3.5-2b" },
];

// The 0.8B only repeated the list back (AI evaluation, 2026-10): suggestions start at the 2B.
const TODO_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "suggest_items", labelKey: "ai.editor.suggest_items", icon: ListBulletIcon, minModelId: "qwen3.5-2b" },
];

const KANBAN_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
];

// Code notes store snippets: a title and a category, nothing that rewrites the code.
const CODE_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
];

function getActionsForType(noteType: NoteType): ActionDef[] {
  switch (noteType) {
    case "text":
      return TEXT_ACTIONS;
    case "todo":
      return TODO_ACTIONS;
    case "kanban":
      return KANBAN_ACTIONS;
    case "code":
      return CODE_ACTIONS;
  }
}

interface Props {
  noteType: NoteType;
  /** Returns the plain-text content of the note (HTML already stripped for text notes). */
  getContent: () => string;
  /**
   * A text note's HTML: a summary or a rewrite (grammar, shortening, translation) works on it one paragraph at a time and
   * keeps its structure. Those actions show only when it's given, with `onHtmlChanged`.
   */
  getHtml?: () => string;
  noteTitle: string;
  /** The note's category (its name): a category suggestion shows it as the "before". */
  categoryName?: string;
  onTitleGenerated: (title: string) => void;
  onItemsSuggested?: (items: string[]) => void;
  /** Called with the category name the user applies from a suggestion. */
  onCategorySuggested?: (categoryName: string) => void;
  /** Called with the note's new HTML when a summary (on top of the note) or a rewrite is applied. */
  onHtmlChanged?: (html: string) => void;
  disabled?: boolean;
  /** Override the floating button position. Default: { bottom: 165, right: 42 } */
  style?: ViewStyle;
  /** Bottom padding for the overlay menu. Default: 230 */
  menuBottomOffset?: number;
}

export default function AIEditorActions({
  noteType,
  getContent,
  getHtml,
  noteTitle,
  categoryName = "",
  onTitleGenerated,
  onItemsSuggested,
  onCategorySuggested,
  onHtmlChanged,
  disabled = false,
  style,
  menuBottomOffset = 200,
}: Props) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  const aiSettings = useSelector(selectorAIAssistant);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  // Staged result of a content-modifying action: shown as a before/after preview
  // and applied only when the user confirms (nothing is overwritten automatically).
  // It holds the result, not a callback: applying goes through the current props, so
  // it never writes back a note snapshot taken when the action started.
  // `streaming`: the model is still writing `after` (Apply waits, Cancel stops it).
  const [preview, setPreview] = useState<{
    action: EditorAction;
    title: string;
    /** What the action replaces (the title, the category, the text, or the note's HTML): applying checks it hasn't changed. */
    source: string;
    before: string;
    after: string;
    /** A category suggestion the model was torn about: the two it nearly picked, `after` the one ticked. */
    choices?: string[];
    /** A summary or a rewrite: the note's HTML it applies. */
    html?: string;
    /** The paragraph, or the part of a summary, under way. */
    progress?: LongNoteProgress;
    /** Where the result goes, when that isn't plain (a summary goes on top of the note). */
    hint?: string;
    streaming: boolean;
  } | null>(null);
  // Left edge (window coords) of the trigger, so the menu opens exactly from the button.
  const [menuLeft, setMenuLeft] = useState(40);
  // The actions that would take too long on the note as it is when the menu opens (turned off, and said so).
  const [tooLong, setTooLong] = useState<ReadonlySet<EditorAction>>(NO_ACTIONS);
  // Translating asks into which language first: the app's (the system's, by default) on top, ticked.
  const [languages, setLanguages] = useState<{ code: string; name: string }[] | null>(null);

  const menuProgress = useSharedValue(0);
  // Each action run gets a number: a cancelled one (or one the user left behind) never writes into the UI.
  const runRef = useRef(0);
  const runningRef = useRef(false);
  const triggerRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The result box keeps its end in sight while the model writes, until the user scrolls up to read; scrolled back to the
  // end, it follows again. Only a drag changes it: a scroll the box makes itself never does.
  const afterScrollRef = useRef<ScrollViewInstance>(null);
  const followAfterRef = useRef(true);

  const editsHtml = !!getHtml && !!onHtmlChanged;
  const actionItems = getActionsForType(noteType).filter((item) => editsHtml || !LONG_NOTE_ACTIONS.has(item.id));

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // The index category is "All" in the store, translated on screen.
  const categoryLabel = useCallback((name: string) => (findCategoryByName(name)?.index ? t("All") : name), [t]);

  const toggleMenu = useCallback(() => {
    if (feedback === "processing") return;
    Keyboard.dismiss();
    if (!isMenuOpen) {
      triggerRef.current?.measureInWindow((x) => setMenuLeft(x));
      // the model loads while the user picks an action
      prewarmContext(aiSettings.selectedModel);
      let tooLongNow: ReadonlySet<EditorAction> = NO_ACTIONS;
      try {
        if (getHtml) tooLongNow = new Set(tooLongForAI(getHtml(), aiSettings.selectedModel));
      } catch {
        // markup it can't read: every action stays on (the model has the last word)
      }
      setTooLong(tooLongNow);
    }
    setIsMenuOpen((prev) => !prev);
  }, [feedback, isMenuOpen, aiSettings.selectedModel, getHtml]);

  // Leaving the note mid-action stops the model, and whatever it already wrote is dropped (never applied to the note).
  useEffect(
    () => () => {
      runRef.current++;
      if (runningRef.current) cancelCommand();
    },
    []
  );

  useEffect(() => {
    menuProgress.value = withTiming(isMenuOpen ? 1 : 0, {
      duration: isMenuOpen ? ANIM_OPEN : ANIM_CLOSE,
      easing: isMenuOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  // Back button handled by Modal's onRequestClose

  useEffect(() => {
    if (feedback === "success" || feedback === "error") {
      feedbackTimer.current = setTimeout(() => setFeedback("idle"), FEEDBACK_DURATION);
      return () => {
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      };
    }
  }, [feedback]);

  const errorMessage = useCallback(
    (action: EditorAction, error?: string) =>
      action === "suggest_category" && error === "no_category_match"
        ? t("ai.editor.no_category_match")
        : error === "implausible_output"
          ? t("ai.editor.no_improvement")
          : error === "too_long"
            ? t("ai.editor.too_long")
            : error === "no_content"
              ? t("ai.editor.no_content")
              : t("ai.editor.error"),
    [t]
  );

  const handleAction = useCallback(
    /** `lang`: the language a translation goes into. */
    async (action: EditorAction, lang?: string) => {
      closeMenu();

      const rawContent = getContent();
      const hasTitle = noteTitle.trim().length > 0;

      // Category suggestion leans on the title first, so a title alone is enough
      // (e.g. "Marco's Birthday" → Birthday). Every other action needs content.
      if (!rawContent.trim() && !(action === "suggest_category" && hasTitle)) {
        toast(t("ai.editor.no_content"));
        return;
      }

      // A summary or a rewrite reads the note's HTML, one paragraph (or part) at a time.
      const html = LONG_NOTE_ACTIONS.has(action) ? getHtml?.() : undefined;

      const run = ++runRef.current;
      runningRef.current = true;
      const staged = PREVIEW_ACTIONS.has(action);
      const showText = (after: string) => {
        if (run === runRef.current) setPreview((p) => (p ? { ...p, after } : p));
      };
      if (staged) {
        followAfterRef.current = true;
        setPreview({
          action,
          title: lang
            ? `${t("ai.editor.translate_to")} ${TRANSLATE_LANGUAGES.find((l) => l.code === lang)?.name ?? lang}`
            : t(`ai.editor.${action}`),
          source: html ?? (action === "generate_title" ? noteTitle : action === "suggest_category" ? categoryName : rawContent),
          before:
            action === "generate_title" ? noteTitle : action === "suggest_category" ? categoryLabel(categoryName) : rawContent,
          after: "",
          hint:
            action === "summarize" && html !== undefined
              ? t(hasSummary(html) ? "ai.editor.summary_replaces" : "ai.editor.summary_on_top")
              : undefined,
          streaming: true,
        });
      } else {
        setFeedback("processing");
      }

      const fail = (msg: string) => {
        setPreview(null);
        setFeedback("error");
        toast(msg);
      };
      // stopped by a cancel elsewhere (the dictation's): nothing to report
      const stopped = () => {
        setPreview(null);
        setFeedback("idle");
      };

      if (html !== undefined) {
        // A rewrite opens its preview at once and fills it as the model writes, paragraph after paragraph.
        const stream = createThrottle(showText);
        const handlers = {
          onText: stream.push,
          onProgress: (progress: LongNoteProgress) => {
            if (run === runRef.current) setPreview((p) => (p ? { ...p, progress } : p));
          },
        };
        try {
          const result =
            action === "summarize"
              ? await summarizeNote(html, noteTitle, handlers)
              : await rewriteNote(action as Exclude<LongNoteAction, "summarize">, html, handlers, { lang });
          stream.stop();
          if (run !== runRef.current) return;
          runningRef.current = false;
          if (result.error === "cancelled") return stopped();
          const next =
            action === "summarize" && result.text ? withSummary(html, t("ai.editor.summary_label"), result.text) : result.html;
          if (!result.success || !result.text || !next) return fail(errorMessage(action, result.error));
          setPreview((p) => (p ? { ...p, after: result.text ?? "", html: next, streaming: false } : p));
        } catch {
          stream.stop();
          if (run !== runRef.current) return;
          runningRef.current = false;
          fail(t("ai.editor.error"));
        }
        return;
      }

      let content: string;
      if (action === "suggest_category") {
        // Pass whichever parts exist (title and/or content); a title alone is enough.
        // Title goes first so it survives input truncation.
        content = [hasTitle && `Title: ${noteTitle.trim()}`, rawContent.trim() && `Content: ${rawContent.trim()}`]
          .filter(Boolean)
          .join("\n");
      } else {
        // The title gives context to suggestions; never to a title, which would only repeat it.
        content = action === "suggest_items" && hasTitle ? `${noteTitle}\n${rawContent}` : rawContent;
      }

      // A title fills its preview as the model writes; a category waits for the whole name, the others show the spinner.
      const stream = action === "generate_title" ? createTextStream(showText) : null;

      try {
        const result = await generateEditorContent(action, content, stream?.push);
        stream?.stop();
        if (run !== runRef.current) return;
        runningRef.current = false;

        if (result.error === "cancelled") return stopped();
        if (!result.success) {
          fail(errorMessage(action, result.error));
          return;
        }

        switch (action) {
          case "suggest_items":
            setFeedback("success");
            if (result.items?.length) onItemsSuggested?.(result.items);
            break;
          case "suggest_category": {
            const picked = result.text ?? "";
            const { alternative } = result;
            // already there, and nothing else came close: nothing to apply
            if (picked === categoryName && !alternative) {
              setPreview(null);
              toast(t("ai.editor.category_unchanged", { name: categoryLabel(picked) }));
              break;
            }
            setPreview((p) =>
              p
                ? {
                    ...p,
                    after: picked,
                    choices: alternative ? [picked, alternative] : undefined,
                    hint: alternative ? t("ai.editor.category_unsure") : undefined,
                    streaming: false,
                  }
                : p
            );
            break;
          }
          default: {
            // the final answer (cleaned of prefixes and quotes) replaces what streamed in
            const after = result.text;
            if (after) setPreview((p) => (p ? { ...p, after, streaming: false } : p));
            else fail(t("ai.editor.error"));
          }
        }
      } catch {
        stream?.stop();
        if (run !== runRef.current) return;
        runningRef.current = false;
        fail(t("ai.editor.error"));
      }
    },
    [getContent, getHtml, noteTitle, categoryName, categoryLabel, onItemsSuggested, t, closeMenu, errorMessage]
  );

  const applyPreview = () => {
    if (!preview || preview.streaming) return;
    const { action, source, after, html } = preview;
    setPreview(null);

    // The model takes seconds and the note stays editable meanwhile: if what it replaces has
    // changed since (new edits, another code tab), applying would overwrite those changes.
    const current =
      html !== undefined
        ? getHtml?.()
        : action === "generate_title"
          ? noteTitle
          : action === "suggest_category"
            ? categoryName
            : getContent();
    if (current !== source) {
      toast(t("ai.editor.content_changed"));
      return;
    }

    if (html !== undefined) onHtmlChanged?.(html);
    else if (action === "generate_title") onTitleGenerated(after);
    else if (action === "suggest_category") onCategorySuggested?.(after);
  };

  const pickLanguage = useCallback(() => {
    closeMenu();
    // nothing to translate: said before asking for a language
    if (!getContent().trim()) {
      toast(t("ai.editor.no_content"));
      return;
    }
    const app = resolveLanguage();
    const first = TRANSLATE_LANGUAGES.find((l) => l.code === app) ?? TRANSLATE_LANGUAGES[0];
    setLanguages([first, ...TRANSLATE_LANGUAGES.filter((l) => l !== first)]);
  }, [closeMenu, getContent, t]);

  const translateInto = useCallback(
    (code: string) => {
      setLanguages(null);
      handleAction("translate", code);
    },
    [handleAction]
  );

  const handleCancel = useCallback(() => {
    runRef.current++;
    runningRef.current = false;
    cancelCommand();
    setFeedback("idle");
    setPreview(null);
  }, []);

  // Closing a preview the model is still writing stops the model too (the steps done are kept, a run again picks up from
  // there). Turning a finished one down forgets them: a run again asks the model again.
  const closePreview = useCallback(() => {
    if (preview?.streaming) {
      handleCancel();
      return;
    }
    if (preview?.html !== undefined) clearLongNoteCache();
    setPreview(null);
  }, [preview?.streaming, preview?.html, handleCancel]);

  const followAfter = useCallback(() => {
    if (followAfterRef.current) afterScrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const stopFollowingAfter = useCallback(() => {
    followAfterRef.current = false;
  }, []);

  const settleAfterScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    followAfterRef.current = isAtEnd(e.nativeEvent);
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
  }));

  if (!aiSettings.enabled || !aiSettings.modelDownloaded || actionItems.length === 0) return null;

  return (
    <>
      <Modal visible={isMenuOpen} transparent animationType="none" statusBarTranslucent onRequestClose={closeMenu}>
        <AnimatedPressable
          style={[styles.overlay, backdropStyle, { paddingBottom: menuBottomOffset, paddingLeft: menuLeft }]}
          onPress={closeMenu}
        >
          <View style={styles.menuContainer}>
            {actionItems.map((actionItem, index) => {
              const modelFits = !actionItem.minModelId || isModelSufficient(aiSettings.selectedModel, actionItem.minModelId);
              const minLabel = actionItem.minModelId ? MODEL_SHORT_LABEL[actionItem.minModelId] : "";
              const canRun = modelFits && !tooLong.has(actionItem.id);
              return (
                <AnimatedActionItem
                  key={actionItem.id}
                  action={actionItem}
                  index={index}
                  totalItems={actionItems.length}
                  menuProgress={menuProgress}
                  onPress={
                    !canRun ? undefined : actionItem.id === "translate" ? pickLanguage : () => handleAction(actionItem.id)
                  }
                  label={t(actionItem.labelKey)}
                  disabled={!canRun}
                  hint={
                    !modelFits ? `${t("ai.editor.min_model")} ${minLabel}` : !canRun ? t("ai.editor.note_too_long") : undefined
                  }
                />
              );
            })}
          </View>
        </AnimatedPressable>
      </Modal>

      <TouchableOpacity
        ref={triggerRef}
        style={[styles.aiButton, style]}
        activeOpacity={0.7}
        onPress={feedback === "processing" ? handleCancel : toggleMenu}
        accessibilityRole="button"
        accessibilityLabel={feedback === "processing" ? t("cancel") : t("generalsettings.ai_assistant")}
        aria-expanded={isMenuOpen}
        disabled={disabled}
      >
        {feedback === "processing" ? (
          <ActivityIndicator size="small" color={COLOR.softWhite} />
        ) : feedback === "success" ? (
          <CheckCircleIcon size={22} color="#4CAF50" />
        ) : feedback === "error" ? (
          <ExclamationCircleIcon size={22} color={COLOR.important} />
        ) : (
          <SparklesIcon size={22} color={COLOR.softWhite} />
        )}
      </TouchableOpacity>

      <Modal
        visible={languages !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLanguages(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <LanguageIcon size={18} color={AI_COLOR} />
              <Text style={styles.previewTitle}>{t("ai.editor.translate_to")}</Text>
            </View>
            <ScrollView style={styles.previewScroll}>
              {languages?.map((language, index) => (
                <TouchableOpacity
                  key={language.code}
                  activeOpacity={0.7}
                  style={[styles.optionRow, index === 0 && styles.optionRowTicked]}
                  onPress={() => translateInto(language.code)}
                  accessibilityRole="button"
                  accessibilityHint={index === 0 ? t("ai.editor.app_language") : undefined}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>{language.name}</Text>
                    {index === 0 ? <Text style={styles.optionHint}>{t("ai.editor.app_language")}</Text> : null}
                  </View>
                  {index === 0 ? <CheckIcon size={18} color={AI_COLOR} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.previewFooter}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.previewAction, styles.previewCancel]}
                onPress={() => setLanguages(null)}
              >
                <Text style={styles.previewCancelLabel}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={preview !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={closePreview}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <SparklesIcon size={18} color={AI_COLOR} />
              <Text style={styles.previewTitle}>{preview?.title}</Text>
              {/* in the header, always in sight whatever the boxes show */}
              {preview?.streaming && preview.progress && preview.progress.total > 1 ? (
                <Text style={styles.previewProgress}>
                  {t("ai.editor.progress", {
                    current: Math.min(preview.progress.done + 1, preview.progress.total),
                    total: preview.progress.total,
                  })}
                </Text>
              ) : null}
            </View>

            {/* each box scrolls on its own: a long note never pushes the result out of sight */}
            <View style={styles.previewBody}>
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>{t("ai.editor.before")}</Text>
                <ScrollView
                  style={[styles.previewBox, styles.previewBefore, { maxHeight: windowHeight * BEFORE_MAX_HEIGHT }]}
                  contentContainerStyle={styles.previewBoxContent}
                >
                  <Text style={[styles.previewText, styles.previewBeforeText]}>
                    {preview?.before?.trim() ? preview.before : "—"}
                  </Text>
                </ScrollView>
              </View>
              <View style={styles.previewSection}>
                <Text style={[styles.previewLabel, { color: AI_COLOR }]}>{t("ai.editor.after")}</Text>
                {preview?.streaming && !preview.after ? (
                  <View style={[styles.previewBox, styles.previewAfter, styles.previewBoxContent]}>
                    <ActivityIndicator size="small" color={AI_COLOR} />
                  </View>
                ) : preview?.choices ? (
                  <View style={styles.previewChoices} accessibilityRole="radiogroup">
                    {preview.choices.map((name) => (
                      <TouchableOpacity
                        key={name}
                        activeOpacity={0.7}
                        style={[styles.optionRow, styles.optionRowUnticked, name === preview.after && styles.optionRowTicked]}
                        onPress={() => setPreview((p) => (p ? { ...p, after: name } : p))}
                        accessibilityRole="radio"
                        aria-checked={name === preview.after}
                      >
                        <Text style={[styles.optionText, styles.optionName]}>{categoryLabel(name)}</Text>
                        {name === preview.after ? <CheckIcon size={18} color={AI_COLOR} /> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <ScrollView
                    ref={afterScrollRef}
                    style={[styles.previewBox, styles.previewAfter, { maxHeight: windowHeight * AFTER_MAX_HEIGHT }]}
                    contentContainerStyle={styles.previewBoxContent}
                    onContentSizeChange={followAfter}
                    onScrollBeginDrag={stopFollowingAfter}
                    onScrollEndDrag={settleAfterScroll}
                    onMomentumScrollEnd={settleAfterScroll}
                  >
                    <Text style={[styles.previewText, styles.previewAfterText]}>
                      {preview?.action === "suggest_category" ? categoryLabel(preview.after) : preview?.after}
                    </Text>
                  </ScrollView>
                )}
                {preview?.hint ? <Text style={styles.previewHint}>{preview.hint}</Text> : null}
              </View>
            </View>

            <View style={styles.previewFooter}>
              <TouchableOpacity activeOpacity={0.7} style={[styles.previewAction, styles.previewCancel]} onPress={closePreview}>
                <Text style={styles.previewCancelLabel}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.previewAction, styles.previewApply, preview?.streaming && styles.previewApplyWaiting]}
                onPress={applyPreview}
                disabled={preview?.streaming}
              >
                <Text style={styles.previewApplyLabel}>{t("ai.editor.apply")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface AnimatedItemProps {
  action: ActionDef;
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
  /** Why it's off: the model it needs, or a note too long for it. */
  hint?: string;
}

function AnimatedActionItem({ action, index, totalItems, menuProgress, onPress, label, disabled, hint }: AnimatedItemProps) {
  const reverseIndex = totalItems - 1 - index;
  const Icon = action.icon;

  const animatedStyle = useAnimatedStyle((): ViewStyle => {
    const staggerOffset = reverseIndex * 0.15;
    const itemProgress = interpolate(
      menuProgress.value,
      [staggerOffset, Math.min(staggerOffset + 0.6, 1)],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: itemProgress,
      transform: [
        { translateY: interpolate(itemProgress, [0, 1], [15, 0]) },
        { scale: interpolate(itemProgress, [0, 1], [0.85, 1]) },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.actionButton, disabled && { opacity: 0.4 }]}
        activeOpacity={disabled ? 1 : 0.7}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <View style={[styles.actionIconContainer, disabled && { backgroundColor: COLOR.lightBlue, opacity: 0.5 }]}>
          <Icon size={20} color={COLOR.darkBlue} />
        </View>
        <View>
          <Text style={styles.actionLabel}>{label}</Text>
          {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* STYLE */

const BUTTON_SIZE = 40;

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    zIndex: 5,
  },
  menuContainer: {
    gap: PADDING_MARGIN.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: PADDING_MARGIN.md,
  },
  actionLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.semiBold,
  },
  actionHint: {
    color: COLOR.placeholder,
    fontSize: FONTSIZE.small,
    marginTop: 2,
  },
  actionIconContainer: {
    padding: PADDING_MARGIN.sm + 2,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    boxShadow: "0px 3px 4px rgba(0,0,0,0.3)",
  },
  aiButton: {
    zIndex: 6,
    position: "absolute",
    bottom: 100,
    left: 40,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.lg,
  },
  previewCard: {
    maxHeight: "80%",
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.big,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.blue,
    padding: PADDING_MARGIN.lg,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    marginBottom: PADDING_MARGIN.md,
  },
  previewTitle: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  previewScroll: {
    flexGrow: 0,
  },
  previewLabel: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.semiBold,
    marginBottom: PADDING_MARGIN.xs,
    textTransform: "uppercase",
  },
  previewProgress: {
    marginLeft: "auto",
    color: COLOR.placeholder,
    fontSize: FONTSIZE.small,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    paddingVertical: PADDING_MARGIN.md,
    paddingHorizontal: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
  },
  optionRowTicked: {
    backgroundColor: "rgba(108, 99, 255, 0.12)",
  },
  // a choice not ticked, in the preview: still reads as a box to tap
  optionRowUnticked: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  previewChoices: {
    gap: PADDING_MARGIN.xs,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
  },
  optionHint: {
    color: COLOR.placeholder,
    fontSize: FONTSIZE.small,
  },
  previewHint: {
    color: COLOR.placeholder,
    fontSize: FONTSIZE.small,
    marginTop: PADDING_MARGIN.xs,
  },
  previewBody: {
    flexShrink: 1,
    gap: PADDING_MARGIN.md,
  },
  // On a short window the boxes give way first, so the header and the buttons always fit.
  previewSection: {
    flexShrink: 1,
  },
  previewBox: {
    flexGrow: 0,
    flexShrink: 1,
    borderRadius: BORDER.normal,
  },
  previewBoxContent: {
    padding: PADDING_MARGIN.md,
  },
  previewText: {
    fontSize: FONTSIZE.medium,
    lineHeight: 22,
  },
  previewBefore: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  previewBeforeText: {
    color: COLOR.lightBlue,
  },
  previewAfter: {
    backgroundColor: "rgba(108, 99, 255, 0.12)",
  },
  previewAfterText: {
    color: COLOR.softWhite,
  },
  previewFooter: {
    flexDirection: "row",
    gap: PADDING_MARGIN.md,
    marginTop: PADDING_MARGIN.lg,
  },
  previewAction: {
    flex: 1,
    paddingVertical: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCancel: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.blue,
  },
  previewApply: {
    backgroundColor: AI_COLOR,
  },
  previewApplyWaiting: {
    opacity: 0.4,
  },
  previewCancelLabel: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  previewApplyLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
});
