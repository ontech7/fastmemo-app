import type { ReactNode } from "react";
import { createContext, useContext, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Dimensions, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN, SHADOW } from "@/constants/styles";

const DEFAULT_WIDTH = 230;
const GAP = PADDING_MARGIN.sm; // space between the trigger and the menu
const SCREEN_MARGIN = PADDING_MARGIN.md; // min distance from the screen edges

// On Android, measureInWindow is relative to the app window (below the status
// bar) while the translucent Modal overlay starts at the very top of the
// screen — without this the menu lands a status-bar height too high.
const VERTICAL_OFFSET = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

interface Anchor {
  left: number;
  top: number;
}

const PopupMenuContext = createContext<{ close: () => void }>({ close: () => {} });

/** Lets a PopupMenuOption (or custom child) close the menu after acting. */
export const usePopupMenu = () => useContext(PopupMenuContext);

interface PopupMenuProps {
  /** The pressable content that opens the menu (usually an icon). */
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
}

/**
 * Custom popup/context menu matching the app's design language — replaces
 * react-native-popup-menu. Anchors right-aligned just below its trigger and
 * opens as a dropdown that expands from zero height to its content height.
 */
export default function PopupMenu({ trigger, children, width = DEFAULT_WIDTH }: PopupMenuProps) {
  const insets = useSafeAreaInsets();
  const triggerRef = useRef<View>(null);
  const lastHeight = useRef(0);
  const openedRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>({ left: 0, top: 0 });

  const progress = useSharedValue(0); // 0 = collapsed, 1 = fully expanded
  const contentHeight = useSharedValue(0);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      const screen = Dimensions.get("window");
      const ay = y + VERTICAL_OFFSET;
      const ch = lastHeight.current;

      // Horizontal: right edge of the menu aligns to the trigger's right edge.
      let left = x + w - width;
      left = Math.max(SCREEN_MARGIN, Math.min(left, screen.width - width - SCREEN_MARGIN));

      // Vertical: just below the trigger, flipping above it if it would overflow.
      let top = ay + h + GAP;
      if (ch > 0 && top + ch > screen.height - insets.bottom - SCREEN_MARGIN) {
        const above = ay - GAP - ch;
        top =
          above >= insets.top + SCREEN_MARGIN
            ? above
            : Math.max(insets.top + SCREEN_MARGIN, top - (top + ch - (screen.height - insets.bottom - SCREEN_MARGIN)));
      }

      setAnchor({ left, top });
      setVisible(true);
    });
  };

  const onContentLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    lastHeight.current = measured;
    contentHeight.value = measured;
    if (!openedRef.current) {
      openedRef.current = true;
      progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
  };

  const finishClose = () => {
    setVisible(false);
    openedRef.current = false;
  };

  const close = () => {
    progress.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const cardStyle = useAnimatedStyle(() => ({ height: progress.value * contentHeight.value }));

  return (
    <>
      <Pressable ref={triggerRef} onPress={open} hitSlop={8} style={styles.trigger}>
        {trigger}
      </Pressable>

      <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={close}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View style={[styles.cardShadow, { width, top: anchor.top, left: anchor.left }, cardStyle]}>
          <View style={styles.cardClip}>
            <View style={styles.cardInner} onLayout={onContentLayout}>
              <PopupMenuContext.Provider value={{ close }}>{children}</PopupMenuContext.Provider>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

interface PopupMenuOptionProps {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Highlights the row (accent text + semibold). */
  selected?: boolean;
  /** Rendered before the label (e.g. a check / sort arrow). */
  leading?: ReactNode;
  /** Rendered at the trailing edge (e.g. an action icon). */
  trailing?: ReactNode;
}

export function PopupMenuOption({ label, onSelect, disabled, selected, leading, trailing }: PopupMenuOptionProps) {
  const { close } = usePopupMenu();

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        onSelect?.();
        close();
      }}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed, disabled && styles.optionDisabled]}
    >
      <View style={styles.optionLabelRow}>
        {leading}
        <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {trailing}
    </Pressable>
  );
}

export function PopupMenuLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function PopupMenuDivider() {
  return <View style={styles.divider} />;
}

/* STYLES */

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  cardShadow: {
    position: "absolute",
    borderRadius: BORDER.big,
    ...SHADOW.card,
  },
  cardClip: {
    flex: 1,
    overflow: "hidden",
    borderRadius: BORDER.big,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
  },
  cardInner: {
    paddingHorizontal: PADDING_MARGIN.xs,
    paddingTop: PADDING_MARGIN.xs,
    paddingBottom: PADDING_MARGIN.sm,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: PADDING_MARGIN.md,
    paddingVertical: PADDING_MARGIN.sm,
    paddingHorizontal: PADDING_MARGIN.sm,
    borderRadius: BORDER.normal,
  },
  optionPressed: {
    backgroundColor: GLASS.fill,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PADDING_MARGIN.sm,
    flexShrink: 1,
  },
  optionText: {
    flexShrink: 1,
    color: COLOR.textPrimary,
    fontFamily: FONT.regular,
    fontSize: FONTSIZE.medium,
  },
  optionTextSelected: {
    color: COLOR.accentSoft,
    fontFamily: FONT.semiBold,
  },
  label: {
    paddingHorizontal: PADDING_MARGIN.sm,
    paddingTop: PADDING_MARGIN.sm,
    paddingBottom: PADDING_MARGIN.xs,
    color: COLOR.textMuted,
    fontFamily: FONT.medium,
    fontSize: FONTSIZE.small,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: PADDING_MARGIN.xs,
    marginHorizontal: PADDING_MARGIN.sm,
    backgroundColor: GLASS.border,
  },
});
