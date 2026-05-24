import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckIcon, XCircleIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTSIZE, FONTWEIGHT, PADDING_MARGIN } from "@/constants/styles";

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
  hidden: boolean;
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
  hidden,
  autoFocus,
  stepMode = false,
  stepStatus = "future",
  stepNumber,
  isFirst = false,
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

  /* FREE MODE -- unchanged */

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
            <DragIcon iconProps={{ color: COLOR.softWhite, opacity: 0.75 }} />
          </div>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => checkItem(item.id)}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            disabled={disabled}
            style={[styles.checkboxFree, pressing && { transform: [{ scale: 0.9 }] as any }]}
          >
            {item.checked && <CheckIcon size={28} color={COLOR.softWhite} style={{ margin: 5 }} />}
          </TouchableOpacity>

          <TextInput
            style={[styles.listItemInputFree, { height }, item.checked && { textDecorationLine: "line-through", opacity: 0.5 }]}
            textAlignVertical="top"
            multiline
            scrollEnabled={false}
            value={item.text}
            onChangeText={(text) => setText(item.id, text)}
            editable={!disabled}
            placeholderTextColor={COLOR.placeholder}
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
            <XCircleIcon size={24} color={COLOR.softWhite} />
          </TouchableOpacity>
        </View>
      </div>
    );
  }

  /* STEP MODE */

  const numberColor = isOngoing ? COLOR.darkBlue : isStepDone ? COLOR.lightBlue : COLOR.softWhite;
  const circleBorderColor = isOngoing ? COLOR.oceanBreeze : isStepDone ? COLOR.lightBlue : COLOR.softWhite;
  const circleFillBg = isOngoing ? COLOR.oceanBreeze : "transparent";

  return (
    <div ref={setNodeRef} style={style}>
      <View style={styles.stepRow}>
        <View style={styles.stepColumn} pointerEvents="box-none">
          <View style={[styles.stepLine, isFirst && styles.stepLineHidden]} />

          <View style={[styles.stepCircle, { borderColor: circleBorderColor, backgroundColor: circleFillBg }]}>
            <Text style={[styles.stepCircleNumber, { color: numberColor }]}>{stepNumber}</Text>
          </View>

          <View style={[styles.stepLine, isLast && styles.stepLineHidden]} />

          {isOngoing && (
            <View style={styles.stepOngoingLabelWrap} pointerEvents="none">
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
            placeholderTextColor={COLOR.placeholder}
            cursorColor={COLOR.softWhite}
            autoFocus={autoFocus && isOngoing && !item.text}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => checkItem(item.id)}
          onPressIn={() => setPressing(true)}
          onPressOut={() => setPressing(false)}
          disabled={disabled || isFuture}
          style={[
            styles.stepStatusBox,
            isOngoing && styles.stepStatusBoxOngoing,
            item.checked && styles.stepStatusBoxDone,
            pressing && !isFuture && { transform: [{ scale: 0.88 }] as any },
          ]}
        >
          {item.checked && <CheckIcon size={20} color={COLOR.softWhite} />}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => deleteItem(item.id)}
          disabled={disabled}
          style={styles.deleteButton}
        >
          <XCircleIcon size={22} color={COLOR.softWhite} />
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
    paddingHorizontal: PADDING_MARGIN.lg - 4,
    backgroundColor: COLOR.blue,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontWeight: FONTWEIGHT.regular,
    color: COLOR.softWhite,
    borderRadius: BORDER.normal,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
  },
  checkboxFree: {
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.normal,
    height: 40,
    width: 40,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    padding: PADDING_MARGIN.sm,
  },

  /* step mode */
  stepRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 80,
  },
  stepColumn: {
    width: STEP_COLUMN_WIDTH,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 6,
    backgroundColor: COLOR.boldBlue,
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
    fontWeight: FONTWEIGHT.semiBold,
  },
  stepOngoingLabelWrap: {
    position: "absolute",
    top: STEP_CIRCLE_SIZE + 6 + 4,
    left: -8,
    right: -8,
    alignItems: "center",
  },
  stepOngoingLabel: {
    color: COLOR.oceanBreeze,
    fontSize: FONTSIZE.small,
    fontWeight: FONTWEIGHT.semiBold,
    backgroundColor: COLOR.darkBlue,
    paddingHorizontal: 4,
  },
  stepTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: PADDING_MARGIN.sm,
  },
  stepTextInput: {
    minHeight: 38,
    paddingVertical: 6,
    paddingHorizontal: PADDING_MARGIN.sm,
    backgroundColor: COLOR.blue,
    borderRadius: BORDER.small,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    fontSize: FONTSIZE.inputTitle,
    lineHeight: FONTSIZE.inputTitle * 1.35,
    fontWeight: FONTWEIGHT.semiBold,
    color: COLOR.softWhite,
  },
  stepTextDone: {
    color: COLOR.lightBlue,
    textDecorationLine: "line-through",
  },
  stepTextFuture: {
    color: COLOR.softWhite,
    fontWeight: FONTWEIGHT.regular,
    opacity: 0.95,
  },
  stepStatusBox: {
    width: 38,
    height: 38,
    borderRadius: BORDER.small,
    borderWidth: 2,
    borderColor: COLOR.boldBlue,
    backgroundColor: COLOR.blue,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  stepStatusBoxOngoing: {
    borderColor: COLOR.oceanBreeze,
  },
  stepStatusBoxDone: {
    borderColor: COLOR.oceanBreeze,
    backgroundColor: COLOR.darkOceanBreeze,
  },
});
