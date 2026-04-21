import { BORDER, COLOR, FONTSIZE, MONOSPACE_FONT, PADDING_MARGIN } from "@/constants/styles";
import type { CodeTab } from "@/types";
import { isStringEmpty } from "@/utils/string";
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

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.tab as object, isActive && styles.tabActive, animatedStyle]}>
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
              placeholderTextColor={COLOR.placeholder}
              cursorColor={COLOR.softWhite}
            />
          ) : (
            <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]} numberOfLines={1} ellipsizeMode="tail">
              {isStringEmpty(tab.title) ? `Tab ${index + 1}` : tab.title}
            </Text>
          )}
        </Animated.View>
      </GestureDetector>

      {isActive && tabCount > 1 && !readOnly && !isEditing && (
        <TouchableOpacity style={styles.tabDeleteButton} onPress={onDelete} activeOpacity={0.7}>
          <XMarkIcon size={12} color={COLOR.lightBlue} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.small,
    borderTopRightRadius: BORDER.small,
    maxWidth: 160,
    shadowColor: COLOR.black,
    shadowOffset: { width: 0, height: 2 },
  },
  tabActive: {
    backgroundColor: "#1e1e1e",
  },
  tabTitle: {
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    color: COLOR.lightBlue,
    maxWidth: 100,
  },
  tabTitleActive: {
    color: COLOR.softWhite,
  },
  tabTitleInput: {
    color: COLOR.softWhite,
    fontSize: FONTSIZE.small,
    fontFamily: MONOSPACE_FONT,
    padding: 0,
    minWidth: 60,
  },
  tabDeleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    padding: 2,
  },
});
