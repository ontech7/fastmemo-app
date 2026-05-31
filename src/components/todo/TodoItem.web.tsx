import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, TrashIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";

import DragIcon from "@/components/icons/DragIcon";

interface TodoItemData {
  id: string;
  text: string;
  checked: boolean;
}

type StepStatus = "done" | "ongoing" | "future";

interface Props {
  item: TodoItemData;
  setText: (id: string, text: string) => void;
  checkItem: (id: string) => void;
  deleteItem: (id: string) => void;
  disabled: boolean;
  hidden?: boolean;
  autoFocus: boolean;
  stepMode?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isFirst?: boolean;
  isLast?: boolean;
  // Accepted for API parity with the native variant (no-op on web).
  animationsReady?: boolean;
}

const STEP_COLUMN_WIDTH = 50;
const STEP_CIRCLE_SIZE = 34;

export default function TodoItem({
  item,
  setText,
  checkItem,
  deleteItem,
  disabled,
  hidden = false,
  autoFocus,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isLast = false,
}: Props) {
  const { t } = useTranslation();
  const [height, setHeight] = useState(40);
  const [pressing, setPressing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: stepMode,
  });

  const isOngoing = stepMode && stepStatus === "ongoing";
  const isFuture = stepMode && stepStatus === "future";
  const isStepDone = stepMode && stepStatus === "done";

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease",
    opacity: isDragging ? 0.5 : 1,
  };

  if (hidden && item.checked) {
    return null;
  }

  /* FREE MODE -- drag + checkbox + text */

  if (!stepMode) {
    return (
      <div ref={setNodeRef} style={style}>
        <View style={[styles.todoItemContainer, { opacity: item.checked ? 0.55 : 1 }]}>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: disabled ? "default" : "grab",
              padding: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />
          </div>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => checkItem(item.id)}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            disabled={disabled}
            style={[
              styles.checkboxFree,
              item.checked && styles.checkboxFreeChecked,
              pressing && { transform: [{ scale: 0.9 }] as any },
            ]}
          >
            {item.checked && <CheckIcon size={24} color={COLOR.softWhite} />}
          </TouchableOpacity>

          <TextInput
            style={[styles.listItemInputFree, { height }, item.checked && { textDecorationLine: "line-through", opacity: 0.5 }]}
            textAlignVertical="top"
            multiline
            scrollEnabled={false}
            value={item.text}
            onChangeText={(text) => setText(item.id, text)}
            editable={!disabled}
            placeholderTextColor={COLOR.textMuted}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus && !item.text}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => deleteItem(item.id)}
            disabled={disabled}
            style={styles.deleteButton}
          >
            <View style={styles.deleteChip}>
              <TrashIcon size={16} color={COLOR.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </div>
    );
  }

  /* STEP MODE */

  const numberColor = isOngoing ? COLOR.softWhite : COLOR.textSecondary;
  const circleBorderColor = isOngoing ? COLOR.accentSoft : isStepDone ? COLOR.accentMutedBorder : GLASS.border;
  const circleFillBg = isOngoing ? COLOR.accent : isStepDone ? COLOR.accentMuted : COLOR.surface;

  return (
    <div ref={setNodeRef} style={style}>
      <View style={styles.stepRow}>
        <View style={[styles.stepColumn, { pointerEvents: "box-none" }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => checkItem(item.id)}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            disabled={disabled}
            style={[
              styles.stepCircle,
              { borderColor: circleBorderColor, backgroundColor: circleFillBg },
              pressing && { transform: [{ scale: 0.9 }] as any },
            ]}
          >
            {isStepDone ? (
              <CheckIcon size={18} color={COLOR.softWhite} />
            ) : (
              <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.stepLine, isLast && styles.stepLineHidden]} />

          {isOngoing && (
            <View style={[styles.stepOngoingLabelWrap, { pointerEvents: "none" }]}>
              <Text style={styles.stepOngoingLabel}>{t("note.ongoing")}</Text>
            </View>
          )}
        </View>

        <View style={styles.stepTextWrap}>
          <TextInput
            style={[
              styles.stepTextInput,
              { height: Math.max(40, height) },
              item.checked && styles.stepTextDone,
              isFuture && styles.stepTextFuture,
            ]}
            textAlignVertical="top"
            multiline
            scrollEnabled={false}
            value={item.text}
            onChangeText={(text) => setText(item.id, text)}
            editable={!disabled}
            placeholderTextColor={COLOR.textMuted}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus && isOngoing && !item.text}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => deleteItem(item.id)}
          disabled={disabled}
          style={[styles.deleteButton, styles.stepDeleteAlign]}
        >
          <View style={styles.deleteChip}>
            <TrashIcon size={16} color={COLOR.textMuted} />
          </View>
        </TouchableOpacity>
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  /* free mode */
  todoItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: PADDING_MARGIN.sm,
    gap: PADDING_MARGIN.sm,
  },
  listItemInputFree: {
    minHeight: 40,
    flex: 1,
    paddingVertical: PADDING_MARGIN.sm - 3,
    paddingHorizontal: PADDING_MARGIN.md,
    backgroundColor: COLOR.surface,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontFamily: FONT.regular,
    color: COLOR.textPrimary,
    borderRadius: BORDER.normal,
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  checkboxFree: {
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.normal,
    height: 40,
    width: 40,
    borderWidth: 1,
    borderColor: GLASS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxFreeChecked: {
    backgroundColor: COLOR.accentMuted,
    borderColor: COLOR.accentMutedBorder,
  },
  deleteButton: {
    alignSelf: "center",
    padding: PADDING_MARGIN.xs,
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

  /* step mode */
  stepRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 52,
  },
  stepColumn: {
    width: STEP_COLUMN_WIDTH,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  // Single connector below each circle; it flexes so the gap autogrows with the
  // entry height and stays continuous down to the next step's circle.
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 8,
    backgroundColor: GLASS.border,
  },
  stepLineHidden: {
    backgroundColor: "transparent",
  },
  stepCircle: {
    width: STEP_CIRCLE_SIZE,
    height: STEP_CIRCLE_SIZE,
    borderRadius: STEP_CIRCLE_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleNumber: {
    fontSize: FONTSIZE.medium,
    fontFamily: FONT.semiBold,
  },
  stepOngoingLabelWrap: {
    position: "absolute",
    top: STEP_CIRCLE_SIZE + 6 + 4,
    left: -8,
    right: -8,
    alignItems: "center",
  },
  stepOngoingLabel: {
    color: COLOR.accentSoft,
    fontSize: FONTSIZE.small,
    fontFamily: FONT.semiBold,
    backgroundColor: COLOR.bg,
    paddingHorizontal: 4,
  },
  stepTextWrap: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  stepDeleteAlign: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  stepTextInput: {
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.surface,
    borderRadius: BORDER.small,
    borderWidth: 1,
    borderColor: GLASS.border,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontFamily: FONT.semiBold,
    color: COLOR.textPrimary,
  },
  stepTextDone: {
    color: COLOR.textMuted,
    textDecorationLine: "line-through",
  },
  stepTextFuture: {
    color: COLOR.textSecondary,
    fontFamily: FONT.regular,
    opacity: 0.95,
  },
});
