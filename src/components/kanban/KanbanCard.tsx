import DragIcon from "@/components/icons/DragIcon";
import Haptics from "@/libs/haptics";
import { useKanbanDrag } from "@/providers/KanbanDragProvider";
import { useRef, useState } from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { TrashIcon } from "react-native-heroicons/outline";
import Animated, { runOnJS, useAnimatedStyle } from "react-native-reanimated";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import type { KanbanItem } from "@/types";

interface Props {
  item: KanbanItem;
  columnId: string;
  setText: (id: string, text: string) => void;
  deleteItem: (id: string) => void;
  disabled: boolean;
}

export default function KanbanCard({ item, columnId, setText, deleteItem, disabled }: Props) {
  const [height, setHeight] = useState(40);

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

  const handleDragStart = (absoluteX: number, absoluteY: number) => {
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

  const handleDragUpdate = (absoluteX: number, absoluteY: number) => {
    updateDragPosition(absoluteX, absoluteY);
  };

  const handleDragEnd = (absoluteX: number, absoluteY: number) => {
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
            style={[styles.textInput, { height }]}
            textAlignVertical="center"
            multiline
            scrollEnabled={false}
            onChangeText={(value) => setText(item.id, value)}
            value={item.text}
            editable={!disabled && !isBeingDragged}
            placeholderTextColor={COLOR.textMuted}
            cursorColor={COLOR.softWhite}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />

          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.dragHandle}>
              <DragIcon
                iconProps={{
                  color: COLOR.textSecondary,
                  opacity: 0.9,
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
          <View style={styles.deleteChip}>
            <TrashIcon size={16} color={COLOR.textMuted} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// static card component for the floating overlay (no gestures)
interface KanbanCardStaticProps {
  item: KanbanItem;
}

export function KanbanCardStatic({ item }: KanbanCardStaticProps) {
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
                color: COLOR.textSecondary,
                opacity: 0.9,
              }}
            />
          </View>
        </View>
        <View style={styles.deleteButton}>
          <View style={styles.deleteChip}>
            <TrashIcon size={16} color={COLOR.textMuted} />
          </View>
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
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: GLASS.border,
  },
  textInputStatic: {
    minHeight: 44,
    flex: 1,
    justifyContent: "center",
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    borderTopLeftRadius: BORDER.normal,
    borderBottomLeftRadius: BORDER.normal,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: GLASS.border,
  },
  textStatic: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
  },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: GLASS.border,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderTopRightRadius: BORDER.normal,
    borderBottomRightRadius: BORDER.normal,
  },
  deleteButton: {
    marginLeft: PADDING_MARGIN.sm,
    alignSelf: "center",
  },
  deleteChip: {
    width: 32,
    height: 32,
    borderRadius: BORDER.normal,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
});
