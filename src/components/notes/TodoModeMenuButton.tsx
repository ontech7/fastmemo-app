import { useEffect, useRef, useState, type ElementRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { ArrowsRightLeftIcon, ArrowsUpDownIcon, ListBulletIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BORDER, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import type { TodoNote } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ANIMATION_DURATION_OPEN = 300;
const ANIMATION_DURATION_CLOSE = 180;

const TODO_MODES = [
  { mode: "free", labelKey: "note.mode_free", icon: ArrowsUpDownIcon },
  { mode: "steps", labelKey: "note.mode_steps", icon: ListBulletIcon },
] as const;

type TodoMode = (typeof TODO_MODES)[number];

interface Props {
  currentMode: "free" | "steps";
  onSelectMode: (mode: TodoNote["mode"]) => void;
  disabled?: boolean;
  /** Override the trigger position. Defaults to a bottom-left floating FAB. */
  style?: ViewStyle;
  /** Bottom padding for the overlay menu so the options clear the trigger. */
  menuBottomOffset?: number;
}

interface MenuItemProps {
  option: TodoMode;
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  label: string;
  onPress: () => void;
}

function AnimatedMenuItem({ option, index, totalItems, menuProgress, label, onPress }: MenuItemProps) {
  const reverseIndex = totalItems - 1 - index;
  const Icon = option.icon;

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
        { translateY: interpolate(itemProgress, [0, 1], [20, 0]) },
        { scale: interpolate(itemProgress, [0, 1], [0.8, 1]) },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity style={styles.optionButton} activeOpacity={0.7} onPress={onPress}>
        <View style={styles.optionIconContainer}>
          <Icon size={24} color={COLOR.softWhite} />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Bottom-left FAB that opens a dimmed overlay with the todo modes you can switch
 * to (the current one is filtered out) — same interaction as AddNoteOverlayButton.
 */
export default function TodoModeMenuButton({ currentMode, onSelectMode, disabled = false, style, menuBottomOffset }: Props) {
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();

  const [isOpen, setIsOpen] = useState(false);
  // Left edge (window coords) of the trigger, so the menu opens exactly from the button.
  const [menuLeft, setMenuLeft] = useState(40);
  const menuProgress = useSharedValue(0);
  const triggerRef = useRef<ElementRef<typeof TouchableOpacity>>(null);

  const options = TODO_MODES.filter((m) => m.mode !== currentMode);

  useEffect(() => {
    menuProgress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [isOpen, menuProgress]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: menuProgress.value }));

  const toggleOverlay = () => {
    if (disabled) return;
    if (!isOpen) {
      triggerRef.current?.measureInWindow((x) => setMenuLeft(x));
    }
    setIsOpen((p) => !p);
  };

  const selectMode = (mode: TodoNote["mode"]) => {
    setIsOpen(false);
    onSelectMode(mode);
  };

  return (
    <>
      <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={() => setIsOpen(false)}>
        <AnimatedPressable
          style={[
            styles.fullscreenOverlay,
            { paddingBottom: menuBottomOffset ?? insets.bottom + 88, paddingLeft: menuLeft },
            backdropAnimatedStyle,
          ]}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.overlayContainer}>
            {options.map((option, index) => (
              <AnimatedMenuItem
                key={option.mode}
                option={option}
                index={index}
                totalItems={options.length}
                menuProgress={menuProgress}
                label={t(option.labelKey)}
                onPress={() => selectMode(option.mode)}
              />
            ))}
          </View>
        </AnimatedPressable>
      </Modal>

      <View style={[styles.fabGroup, !style && { bottom: insets.bottom + 38 }, style, { pointerEvents: "box-none" }]}>
        <TouchableOpacity ref={triggerRef} style={styles.fab} activeOpacity={0.7} onPress={toggleOverlay}>
          <ArrowsRightLeftIcon size={24} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
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
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  optionLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontFamily: FONT.semiBold,
  },
});
