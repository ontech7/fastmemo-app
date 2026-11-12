import { FlatList, ScrollView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

/*
 * A reorder container's scroll view (ADR-038): Gesture Handler's own, animated. React Native's plain scroll views take
 * a touch past their slop without asking the gesture handlers, so a handle's drag inside a list that can scroll was cut
 * off (it never started, or ended as cancelled when the edge scroll moved the list). Gesture Handler's take part in the
 * same arbitration: the handle's drag, once started, keeps the touch.
 */
export const ReorderScrollView = Animated.createAnimatedComponent(ScrollView);
export const ReorderFlatList = Animated.createAnimatedComponent(FlatList);
