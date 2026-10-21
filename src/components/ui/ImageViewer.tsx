import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import XMarkIcon from "react-native-heroicons/outline/XMarkIcon";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import IconChip from "@/components/ui/IconChip";
import { COLOR, PADDING_MARGIN } from "@/constants/styles";

interface Props {
  /** The image (a data: URL or a URL). The viewer is shown while it is mounted. */
  src: string;
  /** Its own size, in pixels. */
  width: number;
  height: number;
  onClose: () => void;
  /** A button next to the close one (share, save). */
  action?: { icon: ReactNode; label: string; onPress: () => void };
}

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/** How far the image can move each way: only as far as it is bigger than the screen. */
const clamp = (value: number, limit: number) => {
  "worklet";
  return Math.min(Math.max(value, -limit), limit);
};

/**
 * An image on the whole screen: pinch to zoom (around the fingers), drag when zoomed in, double tap to zoom in or back out.
 * Back (Android) or the close button leave it.
 */
export default function ImageViewer({ src, width, height, onClose, action }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState({ width: 0, height: 0 });

  // The image fitted in the screen, then scaled and moved from the screen's center.
  const fit = width && height && stage.width ? Math.min(stage.width / width, stage.height / height) : 0;
  const fitted = { width: width * fit, height: height * fit };

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const box = useSharedValue({ width: 0, height: 0, stageWidth: 0, stageHeight: 0 });

  // Zoom by `factor` keeping the point (fx, fy) of the screen where it is.
  const zoom = (factor: number, fx: number, fy: number, animate: boolean) => {
    "worklet";
    const b = box.value;
    const next = Math.min(Math.max(scale.value * factor, 1), MAX_SCALE);
    const px = fx - b.stageWidth / 2;
    const py = fy - b.stageHeight / 2;
    const ratio = next / scale.value;
    const nx = clamp(px - (px - x.value) * ratio, Math.max(0, (b.width * next - b.stageWidth) / 2));
    const ny = clamp(py - (py - y.value) * ratio, Math.max(0, (b.height * next - b.stageHeight) / 2));
    scale.value = animate ? withTiming(next) : next;
    x.value = animate ? withTiming(nx) : nx;
    y.value = animate ? withTiming(ny) : ny;
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      "worklet";
      zoom(e.scaleChange, e.focalX, e.focalY, false);
    },
  });

  const pan = usePanGesture({
    averageTouches: true,
    onUpdate: (e) => {
      "worklet";
      const b = box.value;
      x.value = clamp(x.value + e.changeX, Math.max(0, (b.width * scale.value - b.stageWidth) / 2));
      y.value = clamp(y.value + e.changeY, Math.max(0, (b.height * scale.value - b.stageHeight) / 2));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      "worklet";
      if (scale.value > 1.01) zoom(1 / scale.value, box.value.stageWidth / 2, box.value.stageHeight / 2, true);
      else zoom(DOUBLE_TAP_SCALE, e.x, e.y, true);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  // A new image starts as it fits.
  useEffect(() => {
    scale.value = 1;
    x.value = 0;
    y.value = 0;
  }, [src, scale, x, y]);

  useEffect(() => {
    box.value = { width: fitted.width, height: fitted.height, stageWidth: stage.width, stageHeight: stage.height };
  }, [box, fitted.width, fitted.height, stage.width, stage.height]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] as const,
  }));

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setStage({ width: w, height: h });
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View style={styles.stage} onLayout={onStageLayout}>
            {!!fit && (
              <Animated.Image
                source={{ uri: src }}
                style={[fitted, imageStyle]}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel={t("a11y.image.picture")}
              />
            )}
          </View>
        </GestureDetector>

        <View style={[styles.actions, { top: insets.top + PADDING_MARGIN.md, right: insets.right + PADDING_MARGIN.lg }]}>
          {action && (
            <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8}>
              <IconChip>{action.icon}</IconChip>
            </Pressable>
          )}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("a11y.close")} hitSlop={8}>
            <IconChip>
              <XMarkIcon size={20} color={COLOR.softWhite} />
            </IconChip>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  actions: {
    position: "absolute",
    flexDirection: "row",
    gap: PADDING_MARGIN.sm,
  },
});
