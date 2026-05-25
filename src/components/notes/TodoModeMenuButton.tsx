import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
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
export default function TodoModeMenuButton({ currentMode, onSelectMode, disabled = false }: Props) {
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();

  const [isOpen, setIsOpen] = useState(false);
  const menuProgress = useSharedValue(0);

  const options = TODO_MODES.filter((m) => m.mode !== currentMode);

  useEffect(() => {
    menuProgress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [isOpen, menuProgress]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isOpen) {
        setIsOpen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isOpen]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: menuProgress.value }));

  const toggleOverlay = () => {
    if (disabled) return;
    setIsOpen((p) => !p);
  };

  const selectMode = (mode: TodoNote["mode"]) => {
    setIsOpen(false);
    onSelectMode(mode);
  };

  return (
    <>
      <AnimatedPressable
        style={[styles.fullscreenOverlay, { paddingBottom: insets.bottom + 88 }, backdropAnimatedStyle]}
        pointerEvents={isOpen ? "auto" : "none"}
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

      <View style={[styles.fabGroup, { bottom: insets.bottom + 38 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.fab} activeOpacity={0.7} onPress={toggleOverlay}>
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
    paddingLeft: 40,
    zIndex: 5,
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
