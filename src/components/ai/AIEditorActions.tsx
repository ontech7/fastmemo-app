import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  DocumentTextIcon,
  FolderIcon,
  ListBulletIcon,
  PaintBrushIcon,
  PencilSquareIcon,
  SparklesIcon,
  TagIcon,
} from "react-native-heroicons/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "react-native-heroicons/solid";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSelector } from "react-redux";

import { cancelCommand, generateEditorContent, initContext } from "@/libs/ai";
import { selectorAIAssistant } from "@/slicers/settingsSlice";
import { toast } from "@/utils/toast";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

import type { EditorAction } from "@/libs/ai";
import { Note } from "@/types";
import type { ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

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
}

const TEXT_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "summarize", labelKey: "ai.editor.summarize", icon: DocumentTextIcon },
  { id: "format_text", labelKey: "ai.editor.format_text", icon: PaintBrushIcon },
  { id: "continue_writing", labelKey: "ai.editor.continue_writing", icon: PencilSquareIcon },
];

const TODO_ACTIONS: ActionDef[] = [
  { id: "generate_title", labelKey: "ai.editor.generate_title", icon: TagIcon },
  { id: "suggest_category", labelKey: "ai.editor.suggest_category", icon: FolderIcon },
  { id: "suggest_items", labelKey: "ai.editor.suggest_items", icon: ListBulletIcon },
];

const KANBAN_ACTIONS: ActionDef[] = [];

function getActionsForType(noteType: Note["type"]): ActionDef[] {
  switch (noteType) {
    case "text":
      return TEXT_ACTIONS;
    case "todo":
      return TODO_ACTIONS;
    case "kanban":
      return KANBAN_ACTIONS;
  }
}

interface Props {
  noteType: Note["type"];
  /** Returns the plain-text content of the note (HTML already stripped for text notes). */
  getContent: () => string;
  noteTitle: string;
  onTitleGenerated: (title: string) => void;
  onSummaryGenerated?: (summary: string) => void;
  onContinueGenerated?: (continuation: string) => void;
  onItemsSuggested?: (items: string[]) => void;
  /** Called with formatted HTML when format_text succeeds. */
  onTextFormatted?: (formattedHtml: string) => void;
  /** Called with the matched category name when suggest_category succeeds. */
  onCategorySuggested?: (categoryName: string) => void;
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
  onContinueGenerated,
  onItemsSuggested,
  onTextFormatted,
  onCategorySuggested,
  disabled = false,
  style,
  menuBottomOffset = 200,
}: Props) {
  const { t } = useTranslation();

  const aiSettings = useSelector(selectorAIAssistant);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");

  const menuProgress = useSharedValue(0);
  const cancelledRef = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionItems = getActionsForType(noteType);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const toggleMenu = useCallback(() => {
    if (feedback === "processing") return;
    setIsMenuOpen((prev) => !prev);
  }, [feedback]);

  useEffect(() => {
    menuProgress.value = withTiming(isMenuOpen ? 1 : 0, {
      duration: isMenuOpen ? ANIM_OPEN : ANIM_CLOSE,
      easing: isMenuOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
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

      const content = getContent();
      if (!content.trim()) {
        toast(t("ai.editor.no_content"));
        return;
      }

      setFeedback("processing");
      cancelledRef.current = false;

      initContext(aiSettings.selectedModel);

      try {
        const result = await generateEditorContent(action, content);

        if (cancelledRef.current) return;

        if (result.success) {
          setFeedback("success");

          switch (action) {
            case "generate_title":
              if (result.text) onTitleGenerated(result.text);
              break;
            case "summarize":
              if (result.text) onSummaryGenerated?.(result.text);
              break;
            case "continue_writing":
              if (result.text) onContinueGenerated?.(result.text);
              break;
            case "suggest_items":
              if (result.items?.length) onItemsSuggested?.(result.items);
              break;
            case "format_text":
              if (result.text) onTextFormatted?.(result.text);
              break;
            case "suggest_category":
              if (result.text) onCategorySuggested?.(result.text);
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
      aiSettings.selectedModel,
      onTitleGenerated,
      onSummaryGenerated,
      onContinueGenerated,
      onItemsSuggested,
      onTextFormatted,
      onCategorySuggested,
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
        <AnimatedPressable style={[styles.overlay, backdropStyle, { paddingBottom: menuBottomOffset }]} onPress={closeMenu}>
          <View style={styles.menuContainer}>
            {actionItems.map((actionItem, index) => (
              <AnimatedActionItem
                key={actionItem.id}
                action={actionItem}
                index={index}
                totalItems={actionItems.length}
                menuProgress={menuProgress}
                onPress={() => handleAction(actionItem.id)}
                label={t(actionItem.labelKey)}
              />
            ))}
          </View>
        </AnimatedPressable>
      </Modal>

      <TouchableOpacity
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
    </>
  );
}

interface AnimatedItemProps {
  action: ActionDef;
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  onPress: () => void;
  label: string;
}

function AnimatedActionItem({ action, index, totalItems, menuProgress, onPress, label }: AnimatedItemProps) {
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
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={onPress}>
        <View style={styles.actionIconContainer}>
          <Icon size={20} color={COLOR.darkBlue} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: 40,
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
  actionIconContainer: {
    padding: PADDING_MARGIN.sm + 2,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  aiButton: {
    zIndex: 6,
    position: "absolute",
    bottom: 100,
    left: 40,
    padding: PADDING_MARGIN.sm + 2,
    borderRadius: BORDER.normal,
    backgroundColor: AI_COLOR,
    shadowColor: AI_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
});
