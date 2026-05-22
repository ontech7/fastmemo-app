import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { PlusIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useRouter } from "@/hooks/useRouter";
import type { Href } from "expo-router";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ANIMATION_DURATION_OPEN = 300;
const ANIMATION_DURATION_CLOSE = 180;

interface Props {
  isDeleteMode: boolean;
  toggleDeleteMode: () => void;
}

interface MenuItemProps {
  noteType: (typeof NOTE_TYPES)[number];
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  onPress: () => void;
  label: string;
}

function AnimatedMenuItem({ noteType, index, totalItems, menuProgress, onPress, label }: MenuItemProps) {
  const reverseIndex = totalItems - 1 - index;
  const Icon = noteType.icon;

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
      <TouchableOpacity style={styles.noteTypeButton} activeOpacity={0.7} onPress={onPress}>
        <Text style={styles.noteTypeLabel}>{label}</Text>
        <View style={styles.noteTypeIconContainer}>
          <Icon size={28} color={COLOR.darkBlue} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AddNoteOverlayButton({ isDeleteMode, toggleDeleteMode }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const iconRotation = useSharedValue(0);
  const menuProgress = useSharedValue(0);

  const toggleOverlay = () => {
    if (isDeleteMode) {
      toggleDeleteMode();
      return;
    }

    setIsOverlayOpen((p) => !p);
  };

  const closeOverlay = () => {
    setIsOverlayOpen(false);
  };

  const handleNoteTypePress = (route: Href) => {
    closeOverlay();
    router.push(route);
  };

  useEffect(() => {
    const backAction = () => {
      if (isOverlayOpen) {
        setIsOverlayOpen(false);
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [isOverlayOpen]);

  const showCloseIcon = isOverlayOpen || isDeleteMode;

  useEffect(() => {
    iconRotation.value = withTiming(showCloseIcon ? 1 : 0, {
      duration: showCloseIcon ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCloseIcon]);

  useEffect(() => {
    menuProgress.value = withTiming(isOverlayOpen ? 1 : 0, {
      duration: isOverlayOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: isOverlayOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayOpen]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value * 45}deg` }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
  }));

  return (
    <>
      <AnimatedPressable
        style={[styles.fullscreenOverlay, backdropAnimatedStyle]}
        pointerEvents={isOverlayOpen ? "auto" : "none"}
        onPress={closeOverlay}
      >
        <View style={styles.overlayContainer}>
          {NOTE_TYPES.map((noteType, index) => (
            <AnimatedMenuItem
              key={noteType.key}
              noteType={noteType}
              index={index}
              totalItems={NOTE_TYPES.length}
              menuProgress={menuProgress}
              onPress={() => handleNoteTypePress(noteType.route as Href)}
              label={t(noteType.labelKey)}
            />
          ))}
        </View>
      </AnimatedPressable>

      <TouchableOpacity style={styles.fab} activeOpacity={0.7} onPress={toggleOverlay}>
        <Animated.View style={iconAnimatedStyle}>
          <PlusIcon size={28} color={COLOR.darkBlue} />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    zIndex: 10,
    position: "absolute",
    bottom: 60,
    right: 40,
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  fullscreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingBottom: 130,
    paddingRight: 40,
    zIndex: 5,
  },
  overlayContainer: {
    gap: PADDING_MARGIN.md,
    marginBottom: PADDING_MARGIN.lg,
  },
  noteTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: PADDING_MARGIN.lg,
  },
  noteTypeLabel: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.paragraph,
    fontWeight: FONTWEIGHT.semiBold,
  },
  noteTypeIconContainer: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
});
