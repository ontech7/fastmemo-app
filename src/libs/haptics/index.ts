import * as ExpoHaptics from "expo-haptics";

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

const Haptics = {
  selectionAsync: (): Promise<void> => ExpoHaptics.selectionAsync(),
  impactAsync: (style: ExpoHaptics.ImpactFeedbackStyle): Promise<void> => ExpoHaptics.impactAsync(style),
  notificationAsync: (type: ExpoHaptics.NotificationFeedbackType): Promise<void> => ExpoHaptics.notificationAsync(type),
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default Haptics;
