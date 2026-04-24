const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Soft: "soft",
  Rigid: "rigid",
} as const;

const NotificationFeedbackType = {
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

export default Haptics;
