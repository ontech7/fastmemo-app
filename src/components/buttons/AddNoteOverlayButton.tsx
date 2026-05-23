import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { ChevronUpIcon, PlusIcon } from "react-native-heroicons/outline";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useDispatch, useSelector } from "react-redux";

import { useRouter } from "@/hooks/useRouter";
import { selectorNoteCreation, setNoteCreation } from "@/slicers/settingsSlice";
import type { Href } from "expo-router";

import { NOTE_TYPES } from "@/constants/note-types";
import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";
import type { NoteCreationType } from "@/types";

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
  const dispatch = useDispatch();
  const noteCreation = useSelector(selectorNoteCreation);

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const chevronRotation = useSharedValue(0);
  const closeRotation = useSharedValue(0);
  const menuProgress = useSharedValue(0);
  const secondaryVisible = useSharedValue(1);

  const directNoteType = useMemo<(typeof NOTE_TYPES)[number]>(() => {
    const targetKey: NoteCreationType =
      noteCreation.mode === "simple"
        ? "text"
        : noteCreation.mode === "smart"
          ? noteCreation.smartType
          : noteCreation.lastUsedType;
    return NOTE_TYPES.find((nt) => nt.key === targetKey) ?? NOTE_TYPES[NOTE_TYPES.length - 1];
  }, [noteCreation]);

  const trackLastUsed = (key: string) => {
    if (key === "text" || key === "todo" || key === "code" || key === "kanban") {
      if (noteCreation.lastUsedType !== key) {
        dispatch(setNoteCreation({ ...noteCreation, lastUsedType: key }));
      }
    }
  };

  const createDirect = () => {
    if (isDeleteMode) {
      toggleDeleteMode();
      return;
    }
    if (isOverlayOpen) setIsOverlayOpen(false);
    trackLastUsed(directNoteType.key);
    router.push(directNoteType.route as Href);
  };

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

  const handleNoteTypePress = (noteType: (typeof NOTE_TYPES)[number]) => {
    closeOverlay();
    trackLastUsed(noteType.key);
    router.push(noteType.route as Href);
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

  const showCloseIcon = isDeleteMode;

  useEffect(() => {
    closeRotation.value = withTiming(showCloseIcon ? 1 : 0, {
      duration: showCloseIcon ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: Easing.out(Easing.cubic),
    });
    secondaryVisible.value = withTiming(isDeleteMode ? 0 : 1, {
      duration: isDeleteMode ? ANIMATION_DURATION_CLOSE : ANIMATION_DURATION_OPEN,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCloseIcon, isDeleteMode]);

  useEffect(() => {
    chevronRotation.value = withTiming(isOverlayOpen ? 1 : 0, {
      duration: isOverlayOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: Easing.out(Easing.cubic),
    });
    menuProgress.value = withTiming(isOverlayOpen ? 1 : 0, {
      duration: isOverlayOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: isOverlayOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayOpen]);

  const closeIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${closeRotation.value * 45}deg` }],
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  const secondaryFabAnimatedStyle = useAnimatedStyle(() => ({
    opacity: secondaryVisible.value,
    transform: [{ scale: interpolate(secondaryVisible.value, [0, 1], [0.6, 1]) }],
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
              onPress={() => handleNoteTypePress(noteType)}
              label={t(noteType.labelKey)}
            />
          ))}
        </View>
      </AnimatedPressable>

      <View style={styles.fabGroup} pointerEvents="box-none">
        <Animated.View style={secondaryFabAnimatedStyle} pointerEvents={isDeleteMode ? "none" : "auto"}>
          <TouchableOpacity style={styles.fabSecondary} activeOpacity={0.7} onPress={toggleOverlay}>
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronUpIcon size={20} color={COLOR.darkBlue} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.fab} activeOpacity={0.7} onPress={createDirect}>
          <Animated.View style={closeIconAnimatedStyle}>
            <PlusIcon size={28} color={COLOR.darkBlue} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fabGroup: {
    zIndex: 10,
    position: "absolute",
    bottom: 60,
    right: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.lg,
  },
  fab: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.normal,
    backgroundColor: COLOR.lightBlue,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 7,
  },
  fabSecondary: {
    padding: PADDING_MARGIN.sm,
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
