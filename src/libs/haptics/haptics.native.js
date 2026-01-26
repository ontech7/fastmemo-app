import * as ExpoHaptics from "expo-haptics";

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

const Haptics = {
  selectionAsync: () => ExpoHaptics.selectionAsync(),
  impactAsync: (style) => ExpoHaptics.impactAsync(style),
  notificationAsync: (type) => ExpoHaptics.notificationAsync(type),
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default Haptics;
