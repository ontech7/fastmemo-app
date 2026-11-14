import { useEffect, useRef, useState, type ElementRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import ArrowsRightLeftIcon from "react-native-heroicons/outline/ArrowsRightLeftIcon";
import ArrowsUpDownIcon from "react-native-heroicons/outline/ArrowsUpDownIcon";
import EyeIcon from "react-native-heroicons/outline/EyeIcon";
import EyeSlashIcon from "react-native-heroicons/outline/EyeSlashIcon";
import ListBulletIcon from "react-native-heroicons/outline/ListBulletIcon";
import TrashIcon from "react-native-heroicons/outline/TrashIcon";
import Animated, { runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import MenuItemPop from "@/components/ui/MenuItemPop";
import { DURATION, EASING } from "@/constants/motion";
import type { TodoNote } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ANIMATION_DURATION_OPEN = DURATION.slow;
const ANIMATION_DURATION_CLOSE = DURATION.fast;

const TODO_MODES = [
  { mode: "free", labelKey: "note.mode_free", icon: ArrowsUpDownIcon },
  { mode: "steps", labelKey: "note.mode_steps", icon: ListBulletIcon },
] as const;

interface Props {
  currentMode: "free" | "steps";
  onSelectMode: (mode: TodoNote["mode"]) => void;
  /** The completed items are hidden: the entry reads "Show completed". */
  hideDone: boolean;
  onToggleHideDone: () => void;
  /** How many items are done: "Delete completed" is disabled with none. */
  doneCount: number;
  /** After the confirmation. */
  onDeleteDone: () => void;
  disabled?: boolean;
  /** Override the trigger position. Defaults to a bottom-left floating FAB. */
  style?: ViewStyle;
  /** Bottom padding for the overlay menu so the options clear the trigger. */
  menuBottomOffset?: number;
}

interface MenuItemProps {
  icon: typeof ArrowsUpDownIcon;
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  label: string;
  onPress: () => void;
  /** A mode: the current one has a ring. */
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

function AnimatedMenuItem({
  icon: Icon,
  index,
  totalItems,
  menuProgress,
  label,
  onPress,
  checked,
  destructive,
  disabled,
}: MenuItemProps) {
  return (
    <MenuItemPop index={index} total={totalItems} progress={menuProgress}>
      <TouchableOpacity
        style={[styles.optionButton, disabled && styles.optionDisabled]}
        activeOpacity={0.7}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={checked === undefined ? "button" : "radio"}
        aria-checked={checked}
      >
        <View style={[styles.optionIconContainer, checked && styles.optionIconChecked, destructive && styles.optionIconDanger]}>
          <Icon size={24} color={COLOR.softWhite} />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </TouchableOpacity>
    </MenuItemPop>
  );
}

/**
 * Bottom-left FAB that opens the list's menu in a dimmed overlay (same interaction as AddNoteOverlayButton): the two
 * modes, the current one ringed, then hide or show the completed items, and delete them (asked first).
 */
export default function TodoModeMenuButton({
  currentMode,
  onSelectMode,
  hideDone,
  onToggleHideDone,
  doneCount,
  onDeleteDone,
  disabled = false,
  style,
  menuBottomOffset,
}: Props) {
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();

  const [isOpen, setIsOpen] = useState(false);
  // The menu's Modal stays up until its closing animation has ended (the items go out instead of being cut).
  const [mounted, setMounted] = useState(false);
  // Left edge (window coords) of the trigger, so the menu opens exactly from the button.
  const [menuLeft, setMenuLeft] = useState(40);
  const menuProgress = useSharedValue(0);
  const triggerRef = useRef<ElementRef<typeof TouchableOpacity>>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    menuProgress.value = withTiming(
      isOpen ? 1 : 0,
      {
        duration: isOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
        easing: isOpen ? EASING.enter : EASING.exit,
      },
      (finished) => {
        if (finished && !isOpen) runOnJS(setMounted)(false);
      }
    );
  }, [isOpen, menuProgress]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: menuProgress.value }));

  const toggleOverlay = () => {
    if (disabled) return;
    if (!isOpen) {
      triggerRef.current?.measureInWindow((x) => setMenuLeft(x));
      setMounted(true);
    }
    setIsOpen((p) => !p);
  };

  const selectMode = (mode: TodoNote["mode"]) => {
    setIsOpen(false);
    if (mode !== currentMode) onSelectMode(mode);
  };
  const toggleHideDone = () => {
    setIsOpen(false);
    onToggleHideDone();
  };
  const askDelete = () => {
    setIsOpen(false);
    setConfirmDelete(true);
  };
  // The modes, the divider, the two entries for the completed items: staggered in this order.
  const TOTAL = TODO_MODES.length + 3;

  return (
    <>
      <Modal
        visible={isOpen || mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <AnimatedPressable
          style={[
            styles.fullscreenOverlay,
            { paddingBottom: menuBottomOffset ?? insets.bottom + 88, paddingLeft: menuLeft },
            backdropAnimatedStyle,
          ]}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.overlayContainer}>
            {TODO_MODES.map((option, index) => (
              <AnimatedMenuItem
                key={option.mode}
                icon={option.icon}
                index={index}
                totalItems={TOTAL}
                menuProgress={menuProgress}
                label={t(option.labelKey)}
                checked={option.mode === currentMode}
                onPress={() => selectMode(option.mode)}
              />
            ))}
            <MenuItemPop index={TODO_MODES.length} total={TOTAL} progress={menuProgress}>
              <View style={styles.divider} />
            </MenuItemPop>
            <AnimatedMenuItem
              icon={hideDone ? EyeIcon : EyeSlashIcon}
              index={TODO_MODES.length + 1}
              totalItems={TOTAL}
              menuProgress={menuProgress}
              label={t(hideDone ? "note.show_done" : "note.hide_done")}
              onPress={toggleHideDone}
            />
            <AnimatedMenuItem
              icon={TrashIcon}
              index={TODO_MODES.length + 2}
              totalItems={TOTAL}
              menuProgress={menuProgress}
              label={t("note.delete_done")}
              destructive
              disabled={doneCount === 0}
              onPress={askDelete}
            />
          </View>
        </AnimatedPressable>
      </Modal>

      <View style={[styles.fabGroup, !style && { bottom: insets.bottom + 38 }, style, { pointerEvents: "box-none" }]}>
        <TouchableOpacity
          ref={triggerRef}
          style={styles.fab}
          activeOpacity={0.7}
          onPress={toggleOverlay}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.list_menu")}
          aria-expanded={isOpen}
        >
          <ArrowsRightLeftIcon size={24} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>

      <ConfirmOrCancelDialog
        open={confirmDelete}
        title={t("note.delete_done_title")}
        description={t("note.delete_done_text")}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteDone();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabGroup: {
    zIndex: 10,
    position: "absolute",
    left: 40,
  },
  fab: {
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  fullscreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.scrim,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    // Sit above the floating AI action button (zIndex 6) so the mode dropdown
    // stays usable; the toggle FAB (fabGroup, zIndex 10) remains tappable above.
    zIndex: 7,
  },
  overlayContainer: {
    gap: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.lg,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.lg,
  },
  optionIconContainer: {
    padding: PADDING_MARGIN.sm - 2,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  optionIconChecked: {
    borderColor: COLOR.accentSoft,
  },
  optionIconDanger: {
    backgroundColor: COLOR.important,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  divider: {
    width: 200,
    height: 1,
    marginVertical: PADDING_MARGIN.xs,
    backgroundColor: GLASS.border,
  },
  optionLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
  },
});
