import DragIcon from "@/components/icons/DragIcon";
import { COLOR } from "@/constants/styles";
import { useReorder, type ReorderItem } from "@/providers/ReorderProvider";
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const isWeb = Platform.OS === "web";

/** A finger lifts an item after a 200 ms press; a mouse at once, after 4 px (the web build sees every pointer as a mouse). */
const ACTIVATION = isWeb ? { minDistance: 4 } : { activateAfterLongPress: 200 };

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

/*
 * What lifts an item (ADR-037, ADR-038): its pan gesture writes the pointer on the UI thread; JS hears of the drag at lift
 * and at the end only. The item registers its own box (`registerItem`): the handle is only where the finger goes.
 */
export default function ReorderHandle<T extends ReorderItem>({ item, containerId, disabled, style, children }: Props<T>) {
  const { pointerX, pointerY, lift, release, cancel } = useReorder();

  // The item as it is now, for the lift: the gesture is built once and doesn't follow the item's text.
  const itemRef = useRef(item);
  useLayoutEffect(() => {
    itemRef.current = item;
  }, [item]);
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
        if (event.canceled) scheduleOnRN(cancel);
        else scheduleOnRN(release);
      },
    }),
    [disabled, pointerX, pointerY, onLift, release, cancel]
  );
  const panGesture = usePanGesture(panConfig);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, isWeb && styles.web]} {...(isWeb && { onMouseDown: holdMouse })}>
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
