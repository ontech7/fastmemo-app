import ConfirmOrCancelDialog from "@/components/dialogs/ConfirmOrCancelDialog";
import { BORDER, COLOR, FONTSIZE, GLASS, MONOSPACE_FONT, PADDING_MARGIN } from "@/constants/styles";
import type { CodeTab } from "@/types";
import { isStringEmpty } from "@/utils/string";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { XMarkIcon } from "react-native-heroicons/outline";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

interface Props {
  tab: CodeTab;
  index: number;
  isActive: boolean;
  isEditing: boolean;
  readOnly: boolean;
  tabCount: number;
  onSelect: () => void;
  onEditTitle: () => void;
  onStopEditTitle: () => void;
  onTitleChange: (text: string) => void;
  onDelete: () => void;
  onReorder: (fromIndex: number, translationX: number) => void;
  t: (key: string) => string;
}

export default function CodeDraggableTab({
  tab,
  index,
  isActive,
  isEditing,
  readOnly,
  tabCount,
  onSelect,
  onEditTitle,
  onStopEditTitle,
  onTitleChange,
  onDelete,
  onReorder,
  t,
}: Props) {
  const translateX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const panGesture = Gesture.Pan()
    .enabled(!readOnly && tabCount > 1)
    .activateAfterLongPress(300)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      isDragging.value = false;
      runOnJS(onReorder)(index, e.translationX);
      translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isActive && !readOnly) {
      runOnJS(onEditTitle)();
    } else {
      runOnJS(onSelect)();
    }
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: isDragging.value ? 1.08 : 1 }] as const,
    zIndex: isDragging.value ? 100 : 0,
    opacity: isDragging.value ? 0.8 : 1,
  }));

  const showDeleteButton = isActive && tabCount > 1 && !readOnly && !isEditing;

  return (
    <>
      <ConfirmOrCancelDialog
        open={showDeleteConfirm}
        description={t("code.delete_tab_confirm")}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete();
        }}
      />

      <Animated.View style={[styles.tab as object, isActive && styles.tabActive, animatedStyle]}>
        {/* Only the title area drives tap (select/rename) + long-press drag, so the
            close button below is independently tappable. */}
        <GestureDetector gesture={composed}>
          <View style={styles.titleWrap}>
            {isEditing ? (
              <TextInput
                style={[styles.tabTitle, styles.tabTitleInput]}
                value={tab.title}
                onChangeText={onTitleChange}
                onBlur={onStopEditTitle}
                onSubmitEditing={onStopEditTitle}
                autoFocus
                maxLength={30}
                placeholder={t("code.tab_title_placeholder")}
                placeholderTextColor={COLOR.textMuted}
                cursorColor={COLOR.textPrimary}
              />
            ) : (
              <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]} numberOfLines={1} ellipsizeMode="tail">
                {isStringEmpty(tab.title) ? `Tab ${index + 1}` : tab.title}
              </Text>
            )}
          </View>
        </GestureDetector>

        {showDeleteButton && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.tabDeleteButton}
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, right: 6, left: 4 }}
            >
              <XMarkIcon size={14} color={COLOR.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  tab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    // A 2px top edge (transparent when inactive) marks the active tab with an
    // accent stripe without shifting layout between states.
    borderTopWidth: 2,
    borderTopColor: "transparent",
    maxWidth: 160,
    overflow: "hidden",
  },
  tabActive: {
    backgroundColor: COLOR.surfaceMuted,
    borderTopColor: COLOR.accentMuted,
  },
  titleWrap: {
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: GLASS.border,
  },
  tabDeleteButton: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  tabTitle: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.textSecondary,
    maxWidth: 100,
  },
  tabTitleActive: {
    color: COLOR.textPrimary,
  },
  tabTitleInput: {
    color: COLOR.textPrimary,
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    padding: 0,
    minWidth: 60,
  },
});
