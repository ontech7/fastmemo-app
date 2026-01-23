import React, { useRef } from "react";
import { useKanbanDrag } from "@/contexts/KanbanDragContext";
import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { XCircleIcon } from "react-native-heroicons/outline";
import Animated, { runOnJS, useAnimatedStyle } from "react-native-reanimated";

import DragIcon from "@/components/icons/DragIcon";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

export default function KanbanCard({ item, columnId, setText, deleteItem, disabled }) {
  const { startDrag, updateDragPosition, endDrag, isDragging, draggedItem } = useKanbanDrag();

  const cardRef = useRef(null);
  const cardPositionRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const isBeingDragged = isDragging && draggedItem?.id === item.id;

  // store card position on layout
  const handleLayout = () => {
    if (cardRef.current) {
      cardRef.current.measureInWindow((x, y, width, height) => {
        cardPositionRef.current = { x, y, width, height };
      });
    }
  };

  const handleDragStart = (absoluteX, absoluteY) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // measure live position to avoid stale values after horizontal scroll
    if (cardRef.current && cardRef.current.measureInWindow) {
      cardRef.current.measureInWindow((x, y) => {
        cardPositionRef.current = { ...cardPositionRef.current, x, y };
        startDrag(item, columnId, absoluteX, absoluteY, x, y);
      });
    } else {
      const cardX = cardPositionRef.current.x;
      const cardY = cardPositionRef.current.y;
      startDrag(item, columnId, absoluteX, absoluteY, cardX, cardY);
    }
  };

  const handleDragUpdate = (absoluteX, absoluteY) => {
    updateDragPosition(absoluteX, absoluteY);
  };

  const handleDragEnd = (absoluteX, absoluteY) => {
    endDrag(absoluteX, absoluteY);
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(200)
    .onStart((event) => {
      runOnJS(handleDragStart)(event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(handleDragUpdate)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(handleDragEnd)(event.absoluteX, event.absoluteY);
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: isBeingDragged ? 0.3 : 1,
  }));

  return (
    <View ref={cardRef} style={styles.container} onLayout={handleLayout}>
      <Animated.View style={[styles.cardWrapper, animatedCardStyle]}>
        <View style={styles.cardContent}>
          <TextInput
            style={styles.textInput}
            textAlignVertical="center"
            multiline
            onChangeText={(value) => setText(item.id, value)}
            value={item.text}
            editable={!disabled && !isBeingDragged}
            cursorColor={COLOR.softWhite}
          />

          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.dragHandle}>
              <DragIcon
                iconProps={{
                  color: COLOR.softWhite,
                  opacity: 0.75,
                }}
              />
            </Animated.View>
          </GestureDetector>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          style={styles.deleteButton}
          onPress={() => deleteItem(item.id)}
        >
          <XCircleIcon size={24} color={COLOR.softWhite} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// static card component for the floating overlay (no gestures)
export function KanbanCardStatic({ item }) {
  return (
    <View style={styles.container}>
      <View style={[styles.cardWrapper, styles.cardWrapperFloating]}>
        <View style={styles.cardContent}>
          <View style={styles.textInputStatic}>
            <Animated.Text style={styles.textStatic} numberOfLines={3}>
              {item.text || " "}
            </Animated.Text>
          </View>
          <View style={styles.dragHandle}>
            <DragIcon
              iconProps={{
                color: COLOR.softWhite,
                opacity: 0.75,
              }}
            />
          </View>
        </View>
        <View style={styles.deleteButton}>
          <XCircleIcon size={24} color={COLOR.softWhite} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginBottom: PADDING_MARGIN.sm,
  },
  cardWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardWrapperFloating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
  },
  textInput: {
    minHeight: 44,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 2,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderRightWidth: 0,
    borderColor: COLOR.boldBlue,
  },
  textInputStatic: {
    minHeight: 44,
    flex: 1,
    justifyContent: "center",
    paddingVertical: PADDING_MARGIN.sm - 2,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.blue,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 2,
    borderRightWidth: 0,
    borderColor: COLOR.boldBlue,
  },
  textStatic: {
    fontSize: FONTSIZE.medium,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 2,
    borderRightColor: COLOR.boldBlue,
    borderTopWidth: 2,
    borderTopColor: COLOR.boldBlue,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.boldBlue,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
  },
  deleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    padding: PADDING_MARGIN.xs,
  },
});
