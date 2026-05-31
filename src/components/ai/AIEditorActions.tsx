import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import type { AIModelId, EditorAction } from "@/libs/ai";
import { cancelCommand, generateEditorContent, initContext, isModelSufficient, MODEL_SHORT_LABEL } from "@/libs/ai";
import { selectorAIAssistant } from "@/slicers/settingsSlice";
import type { NoteType } from "@/types/note";
import { toast } from "@/utils/toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewStyle } from "react-native";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  FolderIcon,
  LanguageIcon,
  ListBulletIcon,
  ScissorsIcon,
  SparklesIcon,
  TagIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "react-native-heroicons/solid";
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

type FeedbackState = "idle" | "processing" | "success" | "error";

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
  { id: "summarize", labelKey: "ai.editor.summarize", icon: DocumentTextIcon, minModelId: "qwen-1.5b" },
  { id: "fix_grammar", labelKey: "ai.editor.fix_grammar", icon: CheckBadgeIcon, minModelId: "qwen-1.5b" },
  { id: "shorten", labelKey: "ai.editor.shorten", icon: ScissorsIcon, minModelId: "qwen-1.5b" },
  { id: "translate", labelKey: "ai.editor.translate", icon: LanguageIcon, minModelId: "qwen-3b" },
];

const TODO_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "suggest_items", labelKey: "ai.editor.suggest_items", icon: ListBulletIcon },
];

const KANBAN_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
];

const CODE_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "explain_code", labelKey: "ai.editor.explain_code", icon: ChatBubbleLeftRightIcon, minModelId: "qwen-7b" },
  { id: "add_comments", labelKey: "ai.editor.add_comments", icon: CodeBracketIcon, minModelId: "qwen-7b" },
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
  noteTitle: string;
  onTitleGenerated: (title: string) => void;
  onSummaryGenerated?: (summary: string) => void;
  onItemsSuggested?: (items: string[]) => void;
  /** Called with the matched category name when suggest_category succeeds. */
  onCategorySuggested?: (categoryName: string) => void;
  /** Called with rewritten text for content-replacing actions (fix_grammar, shorten, translate). */
  onTextRewritten?: (text: string) => void;
  /** Called with commented code when add_comments succeeds. */
  onCodeCommented?: (commentedCode: string) => void;
  disabled?: boolean;
  /** Override the floating button position. Default: { bottom: 165, right: 42 } */
  style?: ViewStyle;
  /** Bottom padding for the overlay menu. Default: 230 */
  menuBottomOffset?: number;
}

export default function AIEditorActions({
  noteType,
  getContent,
  noteTitle,
  onTitleGenerated,
  onSummaryGenerated,
  onItemsSuggested,
  onCategorySuggested,
  onTextRewritten,
  onCodeCommented,
  disabled = false,
  style,
  menuBottomOffset = 200,
}: Props) {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [outputText, setOutputText] = useState<string | null>(null);
  // Staged result of a content-modifying action: shown as a before/after preview
  // and applied only when the user confirms (nothing is overwritten automatically).
  const [preview, setPreview] = useState<{ title: string; before: string; after: string; apply: () => void } | null>(null);
  // Left edge (window coords) of the trigger, so the menu opens exactly from the button.
  const [menuLeft, setMenuLeft] = useState(40);

  const menuProgress = useSharedValue(0);
  const cancelledRef = useRef(false);
  const triggerRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionItems = getActionsForType(noteType);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const toggleMenu = useCallback(() => {
    if (feedback === "processing") return;
    Keyboard.dismiss();
    if (!isMenuOpen) {
      triggerRef.current?.measureInWindow((x) => setMenuLeft(x));
    }
    setIsMenuOpen((prev) => !prev);
  }, [feedback, isMenuOpen]);

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

  const handleAction = useCallback(
    async (action: EditorAction) => {
      closeMenu();

      const rawContent = getContent();
      const hasTitle = noteTitle.trim().length > 0;

      // Category suggestion leans on the title first, so a title alone is enough
      // (e.g. "Marco's Birthday" → Birthday). Every other action needs content.
      if (!rawContent.trim() && !(action === "suggest_category" && hasTitle)) {
        toast(t("ai.editor.no_content"));
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
        // Include the note title as context for actions that benefit from it
        const needsTitle = action !== "generate_title" && action !== "add_comments" && action !== "explain_code";
        content = needsTitle && hasTitle ? `${noteTitle}\n${rawContent}` : rawContent;
      }

      setFeedback("processing");
      cancelledRef.current = false;

      initContext(aiSettings.selectedModel);

      try {
        const result = await generateEditorContent(action, content);

        if (cancelledRef.current) return;

        if (result.success) {
          // Stage a before/after preview for anything that overwrites existing
          // content; apply lightweight/additive results directly.
          const stage = (after: string, apply: () => void) => {
            setFeedback("idle");
            setPreview({ title: t(`ai.editor.${action}`), before: rawContent, after, apply });
          };

          switch (action) {
            case "suggest_items":
              setFeedback("success");
              if (result.items?.length) onItemsSuggested?.(result.items);
              break;
            case "suggest_category":
              setFeedback("success");
              if (result.text) onCategorySuggested?.(result.text);
              break;
            case "explain_code":
              setFeedback("idle");
              if (result.text) setOutputText(result.text);
              break;
            case "generate_title":
              if (result.text) {
                const after = result.text;
                setFeedback("idle");
                setPreview({
                  title: t("ai.editor.generate_title"),
                  before: noteTitle,
                  after,
                  apply: () => onTitleGenerated(after),
                });
              }
              break;
            case "summarize":
              if (result.text) stage(result.text, () => onSummaryGenerated?.(result.text!));
              break;
            case "fix_grammar":
            case "shorten":
            case "translate":
              if (result.text) stage(result.text, () => onTextRewritten?.(result.text!));
              break;
            case "add_comments":
              if (result.text) stage(result.text, () => onCodeCommented?.(result.text!));
              break;
          }
        } else {
          setFeedback("error");
          const msg =
            action === "suggest_category" && result.error === "no_category_match"
              ? t("ai.editor.no_category_match")
              : t("ai.editor.error");
          toast(msg);
        }
      } catch {
        if (cancelledRef.current) return;
        setFeedback("error");
        toast(t("ai.editor.error"));
      }
    },
    [
      getContent,
      noteTitle,
      aiSettings.selectedModel,
      onTitleGenerated,
      onSummaryGenerated,
      onItemsSuggested,
      onCategorySuggested,
      onTextRewritten,
      onCodeCommented,
      t,
      closeMenu,
    ]
  );

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    cancelCommand();
    setFeedback("idle");
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
              const canRun =
                !actionItem.minModelId || isModelSufficient(aiSettings.selectedModel as AIModelId, actionItem.minModelId);
              const minLabel = actionItem.minModelId ? MODEL_SHORT_LABEL[actionItem.minModelId] : "";
              return (
                <AnimatedActionItem
                  key={actionItem.id}
                  action={actionItem}
                  index={index}
                  totalItems={actionItems.length}
                  menuProgress={menuProgress}
                  onPress={canRun ? () => handleAction(actionItem.id) : undefined}
                  label={t(actionItem.labelKey)}
                  disabled={!canRun}
                  minModelLabel={!canRun ? `${t("ai.editor.min_model")} ${minLabel}` : undefined}
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

      {outputText && (
        <View style={[styles.outputPanel, style && { bottom: (style as { bottom?: number }).bottom }]}>
          <View style={styles.outputHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SparklesIcon size={16} color={styles.outputTitle.color} />
              <Text style={styles.outputTitle}>AI Result</Text>
            </View>
            <TouchableOpacity onPress={() => setOutputText(null)} activeOpacity={0.7}>
              <XMarkIcon size={18} color={COLOR.lightBlue} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.outputScroll} showsVerticalScrollIndicator>
            <Text style={styles.outputText} selectable>
              {outputText}
            </Text>
          </ScrollView>
        </View>
      )}

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <SparklesIcon size={18} color={AI_COLOR} />
              <Text style={styles.previewTitle}>{preview?.title}</Text>
            </View>

            <ScrollView style={styles.previewScroll} contentContainerStyle={{ gap: PADDING_MARGIN.md }}>
              <View>
                <Text style={styles.previewLabel}>{t("ai.editor.before")}</Text>
                <Text style={[styles.previewBlock, styles.previewBefore]}>
                  {preview?.before?.trim() ? preview.before : "—"}
                </Text>
              </View>
              <View>
                <Text style={[styles.previewLabel, { color: AI_COLOR }]}>{t("ai.editor.after")}</Text>
                <Text style={[styles.previewBlock, styles.previewAfter]}>{preview?.after}</Text>
              </View>
            </ScrollView>

            <View style={styles.previewFooter}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.previewAction, styles.previewCancel]}
                onPress={() => setPreview(null)}
              >
                <Text style={styles.previewCancelLabel}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.previewAction, styles.previewApply]}
                onPress={() => {
                  preview?.apply();
                  setPreview(null);
                }}
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
  minModelLabel?: string;
}

function AnimatedActionItem({
  action,
  index,
  totalItems,
  menuProgress,
  onPress,
  label,
  disabled,
  minModelLabel,
}: AnimatedItemProps) {
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
          {minModelLabel && <Text style={styles.actionMinModel}>{minModelLabel}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* STYLE */

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
  actionMinModel: {
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
    padding: PADDING_MARGIN.sm + 2,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
  },
  outputPanel: {
    position: "absolute",
    bottom: 100,
    left: 115,
    right: PADDING_MARGIN.xxl,
    maxHeight: 300,
    backgroundColor: COLOR.boldBlue,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: COLOR.blue,
    zIndex: 7,
    boxShadow: "0px 4px 6px rgba(0,0,0,0.4)",
  },
  outputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.blue,
  },
  outputTitle: {
    color: COLOR.lightBlue,
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.semiBold,
  },
  outputScroll: {
    flex: 1,
    paddingHorizontal: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.sm,
  },
  outputText: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.medium,
    lineHeight: 22,
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
  previewBlock: {
    fontSize: FONTSIZE.medium,
    lineHeight: 22,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
  },
  previewBefore: {
    color: COLOR.lightBlue,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  previewAfter: {
    color: COLOR.softWhite,
    backgroundColor: "rgba(108, 99, 255, 0.12)",
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
