import TourTip from "@/components/ui/TourTip";
import { BORDER, COLOR, PADDING_MARGIN, SHADOW } from "@/constants/styles";
import type { TourRect } from "@/libs/tourTargets";
import { measureInWindow, measureTourTarget, subscribeTourTargets } from "@/libs/tourTargets";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewInstance, ViewStyle } from "react-native";
import { Animated, Dimensions, Easing, Platform, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface Props {
  /** The tour targets left visible (useTourTarget names); the rest of the screen is dimmed. */
  targets: string[];
  /** What the card points at; the first target found otherwise. */
  pointAt?: string;
  /** Touches go through to what's in the (single) hole: the step asks to tap it. Otherwise the layer takes them all. */
  passThrough?: boolean;
  step: number;
  total: number;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onSkip?: () => void;
}

/** Room around a target inside its hole, and the hole's corners. */
const HOLE_PAD = 6;
const HOLE_RADIUS = BORDER.big;
/** Between a hole and the card (the arrow sits in it). */
const GAP = 16;
const CARD_MAX_WIDTH = 340;
/** Narrower than this, the card rather goes over another lit target than beside it. */
const CARD_MIN_WIDTH = 200;
const MARGIN = PADDING_MARGIN.lg;
/** Keeps the arrow off the card's rounded corners. */
const ARROW_INSET = 28;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const roundedRect = ({ x, y, width: w, height: h }: TourRect, r: number) =>
  `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}` +
  `H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;

/**
 * A step of the first-note tour: the screen dimmed except for the targets (holes with a ring), and the step's card next
 * to the one it points at, with an arrow. It goes over the whole screen it's rendered in (absolute, last child).
 */
export default function TourSpotlight({ targets, pointAt, passThrough = false, ...card }: Props) {
  const layerRef = useRef<ViewInstance>(null);
  const [layout, setLayout] = useState<{ size: TourRect; holes: TourRect[]; point: TourRect | null } | null>(null);

  const targetsKey = targets.join("|");
  const measure = useCallback(async () => {
    const origin = await measureInWindow(layerRef.current);
    if (!origin) return;
    const names = targetsKey.split("|");
    const found = await Promise.all(names.map(measureTourTarget));
    const local = (rect: TourRect | null) =>
      rect && {
        x: rect.x - origin.x - HOLE_PAD,
        y: rect.y - origin.y - HOLE_PAD,
        width: rect.width + 2 * HOLE_PAD,
        height: rect.height + 2 * HOLE_PAD,
      };
    const holes = found.map(local).filter((rect): rect is TourRect => !!rect);
    const point = local(pointAt ? await measureTourTarget(pointAt) : null) ?? holes[0] ?? null;
    setLayout({ size: { ...origin, x: 0, y: 0 }, holes, point });
  }, [targetsKey, pointAt]);

  // Measured when shown, again once what it points at has settled (entering animations, a list's first layout), and
  // whenever a target comes or goes or the window changes size (then again once the new layout has settled: a list's
  // cells resize after the event).
  useEffect(() => {
    measure();
    const later = setTimeout(measure, 400);
    let settled: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeTourTargets(measure);
    const dimensions = Dimensions.addEventListener("change", () => {
      measure();
      clearTimeout(settled);
      settled = setTimeout(measure, 300);
    });
    return () => {
      clearTimeout(later);
      clearTimeout(settled);
      unsubscribe();
      dimensions.remove();
    };
  }, [measure]);

  // React Native's Animated, not Reanimated: Reanimated's web View drops the layer's pointerEvents, and the layer would
  // then take the taps meant for the hole.
  const [opacity] = useState(() => new Animated.Value(0));
  const measured = !!layout;
  useEffect(() => {
    if (!measured) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [measured, opacity]);

  const { size, holes, point } = layout ?? { size: null, holes: [], point: null };
  let cardWidth = size ? Math.min(CARD_MAX_WIDTH, size.width - 2 * MARGIN) : CARD_MAX_WIDTH;

  // The card goes on the side of the target with more room, centered on it as far as the screen allows, and right of
  // another lit target on its left there (the sidebar beside the first note). A target taller than half the screen (the
  // sidebar) gets the card beside it, in the room left of the screen, without an arrow.
  let cardStyle: ViewStyle = {};
  let arrow: { side: "top" | "bottom"; left: number } | undefined;
  if (size && point && point.height < size.height / 2) {
    const center = point.x + point.width / 2;
    const below = size.height - (point.y + point.height) >= point.y;
    let minLeft = holes.reduce(
      (min, rect) =>
        rect.x + rect.width <= center && (below ? rect.y + rect.height > point.y + point.height : rect.y < point.y)
          ? Math.max(min, rect.x + rect.width + GAP)
          : min,
      MARGIN
    );
    if (size.width - minLeft - MARGIN < CARD_MIN_WIDTH) minLeft = MARGIN;
    cardWidth = Math.min(cardWidth, size.width - minLeft - MARGIN);
    const left = clamp(center - cardWidth / 2, minLeft, size.width - cardWidth - MARGIN);
    cardStyle = below ? { left, top: point.y + point.height + GAP } : { left, bottom: size.height - point.y + GAP };
    arrow = { side: below ? "top" : "bottom", left: clamp(center - left, ARROW_INSET, cardWidth - ARROW_INSET) };
  } else if (size && point) {
    const left = point.x + point.width + GAP;
    cardWidth = Math.min(CARD_MAX_WIDTH, size.width - left - MARGIN);
    cardStyle = { left, top: size.height / 3 };
  } else if (size) {
    cardStyle = { left: (size.width - cardWidth) / 2, top: size.height / 3 };
  }

  // Touches outside the hole stop on these four bands around it; inside it they reach what's underneath. The bands are
  // real native views (not flattened away): Android's native inputs take a touch no native view above them takes.
  const hole = passThrough && holes.length === 1 ? holes[0] : null;

  return (
    <View ref={layerRef} style={[StyleSheet.absoluteFill, styles.layer]} onLayout={() => measure()}>
      {size && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.passThrough, { opacity }]}>
          <View style={[StyleSheet.absoluteFill, styles.untouchable]}>
            <Svg width={size.width} height={size.height}>
              <Path
                d={`M0,0H${size.width}V${size.height}H0Z${holes.map((rect) => roundedRect(rect, HOLE_RADIUS)).join("")}`}
                fill={COLOR.scrim}
                fillRule="evenodd"
              />
            </Svg>
          </View>

          {hole ? (
            <>
              <View style={[styles.block, { left: 0, right: 0, top: 0, height: Math.max(0, hole.y) }]} collapsable={false} />
              <View style={[styles.block, { left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }]} collapsable={false} />
              <View
                style={[styles.block, { left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.height }]}
                collapsable={false}
              />
              <View
                style={[styles.block, { left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }]}
                collapsable={false}
              />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.block]} collapsable={false} />
          )}

          {holes.map((rect, index) => (
            <View key={index} style={[styles.ring, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]} />
          ))}

          <TourTip {...card} arrow={arrow} style={[styles.card, { width: cardWidth }, cardStyle]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the screen's own floating parts (the add button's group is at 10).
  layer: {
    zIndex: 20,
    pointerEvents: "box-none",
  },
  passThrough: {
    pointerEvents: "box-none",
  },
  untouchable: {
    pointerEvents: "none",
  },
  block: {
    position: "absolute",
  },
  ring: {
    position: "absolute",
    pointerEvents: "none",
    borderRadius: HOLE_RADIUS,
    borderWidth: 2,
    borderColor: COLOR.accentMutedBorder,
    ...SHADOW.glow,
  },
  card: {
    position: "absolute",
    maxWidth: undefined,
  },
});
