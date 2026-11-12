export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Soft: "soft",
  Rigid: "rigid",
} as const;

export const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;

const Haptics = {
  selectionAsync: (): Promise<void> => Promise.resolve(),
  impactAsync: (): Promise<void> => Promise.resolve(),
  notificationAsync: (): Promise<void> => Promise.resolve(),
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

/** The app's haptics by meaning; the web has no vibration, so nothing happens. */
export const haptic = {
  select: (): void => {},
  success: (): void => {},
  warn: (): void => {},
};

export default Haptics;
