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

/** Fire and forget: a failed vibration is never an error. */
const fire = (vibrate: () => Promise<void>): void => {
  try {
    vibrate().catch(() => {});
  } catch {
    // no vibrator, or the module isn't there: nothing to tell
  }
};

/** The app's haptics by meaning: a pick, a done, a warning (a destructive confirm). */
export const haptic = {
  select: (): void => fire(() => ExpoHaptics.selectionAsync()),
  success: (): void => fire(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
  warn: (): void => fire(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
};

export default Haptics;
