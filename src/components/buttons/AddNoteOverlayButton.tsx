import type { Ref } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ChevronUpIcon from "react-native-heroicons/outline/ChevronUpIcon";
import PlusIcon from "react-native-heroicons/outline/PlusIcon";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useDispatch, useSelector } from "react-redux";

import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "@/hooks/useRouter";
import { useTourTarget } from "@/hooks/useTourTarget";
import { selectorNoteCreation, setNoteCreation } from "@/slicers/settingsSlice";
import type { Href } from "expo-router";

import { NOTE_TYPES } from "@/constants/note-types";
import { noteTypeTarget, SHORTCUT_TARGET } from "@/constants/shortcuts";
import { BORDER, CARD_TYPE_COLOR, COLOR, FONT, FONTSIZE, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import MenuItemPop from "@/components/ui/MenuItemPop";
import { DURATION, EASING, SPRING } from "@/constants/motion";
import type { NoteCreationType } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FAB_RIGHT = 40;
const FAB_BOTTOM = 60;

const ANIMATION_DURATION_OPEN = DURATION.slow;
const ANIMATION_DURATION_CLOSE = DURATION.fast;

interface Props {
  isDeleteMode: boolean;
  toggleDeleteMode: () => void;
  /**
   * Lifts the FAB group so it rides just above a bottom bar (e.g. the quick-note bar). Defaults to `FAB_BOTTOM`. In select
   * mode the group slides down to `FAB_BOTTOM`, beside the toolbar, by a transform: its `bottom` never changes.
   */
  bottomOffset?: number;
  /** Told when the note-type menu opens or closes. */
  onMenuToggle?: (open: boolean) => void;
}

interface MenuItemProps {
  noteType: (typeof NOTE_TYPES)[number];
  index: number;
  totalItems: number;
  menuProgress: SharedValue<number>;
  onPress: () => void;
  label: string;
  focusable: boolean;
  testID: string;
}

function AnimatedMenuItem({ noteType, index, totalItems, menuProgress, onPress, label, focusable, testID }: MenuItemProps) {
  const Icon = noteType.icon;

  return (
    <MenuItemPop index={index} total={totalItems} progress={menuProgress}>
      <TouchableOpacity
        style={styles.noteTypeButton}
        activeOpacity={0.7}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        focusable={focusable}
      >
        <Text style={styles.noteTypeLabel}>{label}</Text>
        <View style={styles.noteTypeIconContainer}>
          <Icon size={28} color={COLOR.softWhite} />
        </View>
      </TouchableOpacity>
    </MenuItemPop>
  );
}

export default function AddNoteOverlayButton({ isDeleteMode, toggleDeleteMode, bottomOffset, onMenuToggle }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const noteCreation = useSelector(selectorNoteCreation);

  const insets = useSafeAreaInsets();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // What the first-note tour shows: the whole group, and the add button it points at.
  const groupTarget = useTourTarget("addNoteGroup");
  const addTarget = useTourTarget("addNote");

  const chevronRotation = useSharedValue(0);
  const closeRotation = useSharedValue(0);
  const menuProgress = useSharedValue(0);
  const secondaryVisible = useSharedValue(1);
  const hintPop = useSharedValue(1);
  const modeDrop = useSharedValue(0);

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

  const showTypeHint = !isDeleteMode && (noteCreation.mode === "smart" || noteCreation.mode === "adaptive");
  const HintIcon = directNoteType.icon;
  // Tint the hint badge with the resolved note type's color (same palette as the
  // NoteCard left border), with a dark glyph — so it reads as part of the system.
  const hintColor = CARD_TYPE_COLOR[directNoteType.key as keyof typeof CARD_TYPE_COLOR] ?? COLOR.accentSoft;

  // Pop the hint badge whenever the resolved note type changes. Driven by a
  // shared value (not entering/exiting layout animations) so it stays safe
  // while navigating away on press.
  useEffect(() => {
    // From 60% at once, then springs to its size.
    hintPop.value = 0.6;
    hintPop.value = withSpring(1, SPRING.snappy);
  }, [directNoteType.key, hintPop]);

  const hintAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hintPop.value }],
  }));

  useEffect(() => {
    closeRotation.value = withTiming(showCloseIcon ? 1 : 0, {
      duration: showCloseIcon ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: EASING.enter,
    });
    secondaryVisible.value = withTiming(isDeleteMode ? 0 : 1, {
      duration: isDeleteMode ? ANIMATION_DURATION_CLOSE : ANIMATION_DURATION_OPEN,
      easing: EASING.enter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCloseIcon, isDeleteMode]);

  // Select mode: down from above the bar to the toolbar's line, a transform (no relayout).
  const selectDrop = isDeleteMode && bottomOffset !== undefined ? bottomOffset - FAB_BOTTOM : 0;
  useEffect(() => {
    modeDrop.value = withTiming(selectDrop, {
      duration: isDeleteMode ? DURATION.base : DURATION.fast,
      easing: isDeleteMode ? EASING.enter : EASING.exit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectDrop]);

  useEffect(() => {
    onMenuToggle?.(isOverlayOpen);
  }, [isOverlayOpen, onMenuToggle]);

  useEffect(() => {
    chevronRotation.value = withTiming(isOverlayOpen ? 1 : 0, {
      duration: isOverlayOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: EASING.enter,
    });
    menuProgress.value = withTiming(isOverlayOpen ? 1 : 0, {
      duration: isOverlayOpen ? ANIMATION_DURATION_OPEN : ANIMATION_DURATION_CLOSE,
      easing: isOverlayOpen ? EASING.enter : EASING.exit,
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

  const modeDropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modeDrop.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
  }));

  return (
    <>
      <AnimatedPressable
        style={[
          styles.fullscreenOverlay,
          backdropAnimatedStyle,
          // Keep the type menu aligned just above the FAB even when it's lifted above the quick-note bar.
          { paddingBottom: (bottomOffset ?? FAB_BOTTOM) + 70, pointerEvents: isOverlayOpen ? "auto" : "none" },
        ]}
        onPress={closeOverlay}
        accessible={false}
        focusable={false}
        aria-hidden={!isOverlayOpen}
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
              // aria-hidden doesn't take a closed menu out of the web tab order
              focusable={isOverlayOpen}
              testID={noteTypeTarget(noteType.key)}
            />
          ))}
        </View>
      </AnimatedPressable>

      {/* Ride above the quick-note bar via `bottom` (set by the parent from the bar's height) and
          stick to the keyboard with the same offset as the bar, so the two move together 1:1. */}
      <KeyboardStickyView
        // Its ref type names the View component instead of its instance.
        ref={groupTarget as unknown as Ref<View>}
        offset={{ closed: 0, opened: insets.bottom }}
        style={[styles.fabGroup, { bottom: bottomOffset ?? FAB_BOTTOM, pointerEvents: "box-none" }]}
      >
        <Animated.View style={[styles.fabRow, modeDropStyle, { pointerEvents: "box-none" }]}>
          <Animated.View
            style={[secondaryFabAnimatedStyle, { pointerEvents: isDeleteMode ? "none" : "auto" }]}
            aria-hidden={isDeleteMode}
          >
            <TouchableOpacity
              style={styles.fabSecondary}
              activeOpacity={0.7}
              // 36 dp drawn: the touch reaches 44.
              hitSlop={4}
              onPress={toggleOverlay}
              testID={isDeleteMode ? undefined : SHORTCUT_TARGET.noteTypes}
              focusable={!isDeleteMode}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.note_types")}
              aria-expanded={isOverlayOpen}
            >
              <Animated.View style={chevronAnimatedStyle}>
                <ChevronUpIcon size={20} color={COLOR.softWhite} />
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            ref={addTarget}
            style={styles.fab}
            activeOpacity={0.7}
            onPress={createDirect}
            testID={isDeleteMode ? SHORTCUT_TARGET.back : SHORTCUT_TARGET.newNote}
            accessibilityRole="button"
            accessibilityLabel={isDeleteMode ? t("a11y.exit_selection") : t("a11y.new_note")}
          >
            <Animated.View style={closeIconAnimatedStyle}>
              <PlusIcon size={28} color={COLOR.softWhite} />
            </Animated.View>

            {showTypeHint && (
              <Animated.View
                style={[styles.fabHintBadge, { backgroundColor: hintColor }, hintAnimatedStyle, { pointerEvents: "none" }]}
              >
                <HintIcon size={13} color={COLOR.darkBlue} />
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardStickyView>
    </>
  );
}

const styles = StyleSheet.create({
  fabGroup: {
    zIndex: 10,
    position: "absolute",
    bottom: FAB_BOTTOM,
    right: FAB_RIGHT,
  },
  fabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.lg,
  },
  fab: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
  fabHintBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: BORDER.rounded,
    // A ring in the page background color "cuts out" the badge from the FAB
    // for a clean float, instead of a hard white outline.
    borderWidth: 2,
    borderColor: COLOR.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  fabSecondary: {
    padding: PADDING_MARGIN.sm,
    borderRadius: BORDER.big,
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
    fontFamily: FONT.semiBold,
  },
  noteTypeIconContainer: {
    padding: PADDING_MARGIN.md,
    borderRadius: BORDER.big,
    backgroundColor: COLOR.accentMuted,
    ...SHADOW.fab,
  },
});
