import DragIcon from "@/components/icons/DragIcon";
import { COLOR } from "@/constants/styles";
import { useReorder, type ReorderItem } from "@/providers/ReorderProvider";
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const isWeb = Platform.OS === "web";

/**
 * A finger lifts the item as it touches the handle (as 4.0.0's list did); a mouse after 4 px (the web build sees every
 * pointer as a mouse). On Android a pan that waits for a press fails as soon as the finger moves past the touch slop
 * (8 dp) before the wait is over, and a finger that touches and drags at once always does: with 200 ms, and even with
 * 60 ms, the drag didn't start in a list. The wait is one millisecond: the drag starts before the first move arrives.
 */
const ACTIVATION = isWeb ? { minDistance: 4 } : { activateAfterLongPress: 1 };

/**
 * A finger on the handle is the handle's for React Native's touch system too (Android, iOS). Otherwise a touchable around
 * the list (the editor's tap-to-close-the-keyboard) took the touch a moment after the drag had started, and Android took
 * that as a native view grabbing the touch: it cancelled the drag (the lifted row glowed and dropped back).
 */
const claimTouch = () => true;

/** A handle's mouse press neither starts a board's mouse drag-to-scroll nor selects the page's text (web). */
const holdMouse = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
  event.preventDefault();
  event.stopPropagation();
};

interface Props<T extends ReorderItem> {
  item: T;
  containerId: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** What the handle shows; the drag icon by default. */
  children?: ReactNode;
}

/** What a screen reader offers on a handle besides dragging. */
const ACTIONS = ["moveUp", "moveDown"] as const;

/*
 * What lifts an item (ADR-037, ADR-038): its pan gesture writes the pointer on the UI thread; JS hears of the drag at lift
 * and at the end only. The item registers its own box (`registerItem`): the handle is only where the finger goes.
 * Without dragging, a screen reader's "move up"/"move down" and, on web and desktop, the arrow keys on the focused handle
 * move the item one place (`move`).
 */
export default function ReorderHandle<T extends ReorderItem>({ item, containerId, disabled, style, children }: Props<T>) {
  const { t } = useTranslation();
  const { pointerX, pointerY, lift, release, cancel, move } = useReorder();

  // The item as it is now, for the lift: the gesture is built once and doesn't follow the item's text.
  const itemRef = useRef(item);
  useLayoutEffect(() => {
    itemRef.current = item;
  }, [item]);
  const itemId = item.id;
  const onLift = useCallback((x: number, y: number) => lift(itemRef.current, containerId, x, y), [lift, containerId]);

  const panConfig = useMemo(
    () => ({
      enabled: !disabled,
      ...ACTIVATION,
      onActivate: (event: { absoluteX: number; absoluteY: number }) => {
        "worklet";
        pointerX.set(event.absoluteX);
        pointerY.set(event.absoluteY);
        scheduleOnRN(onLift, event.absoluteX, event.absoluteY);
      },
      onUpdate: (event: { absoluteX: number; absoluteY: number }) => {
        "worklet";
        pointerX.set(event.absoluteX);
        pointerY.set(event.absoluteY);
      },
      onDeactivate: (event: { canceled: boolean }) => {
        "worklet";
        if (event.canceled) scheduleOnRN(cancel, itemId);
        else scheduleOnRN(release, itemId);
      },
    }),
    [disabled, pointerX, pointerY, onLift, release, cancel, itemId]
  );
  const panGesture = usePanGesture(panConfig);
  const accessibilityActions = useMemo(
    () => [
      { name: ACTIONS[0], label: t("a11y.move_up") },
      { name: ACTIONS[1], label: t("a11y.move_down") },
    ],
    [t]
  );
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (disabled) return;
      if (event.nativeEvent.actionName === ACTIONS[0]) move(itemId, containerId, -1);
      else if (event.nativeEvent.actionName === ACTIONS[1]) move(itemId, containerId, 1);
    },
    [disabled, move, itemId, containerId]
  );
  // Web and desktop: the handle takes the keyboard's focus, and the arrows move the item.
  const keyProps = useMemo(
    () =>
      isWeb && !disabled
        ? {
            tabIndex: 0,
            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              move(itemId, containerId, event.key === "ArrowUp" ? -1 : 1);
            },
          }
        : {},
    [disabled, move, itemId, containerId]
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[style, isWeb && styles.web]}
        accessible={!disabled}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.reorder")}
        accessibilityActions={disabled ? undefined : accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        {...(isWeb && { onMouseDown: holdMouse })}
        {...(!isWeb && !disabled && { onStartShouldSetResponder: claimTouch })}
        {...(keyProps as object)}
      >
        {children ?? <DragIcon iconProps={{ color: COLOR.textSecondary, opacity: 0.9 }} />}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // The web build sees every pointer as a mouse: without this a touch on the handle scrolls the page instead of lifting.
  web: {
    touchAction: "none",
    cursor: "grab",
  } as object,
});
