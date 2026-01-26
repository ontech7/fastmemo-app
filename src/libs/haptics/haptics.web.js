const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Soft: "soft",
  Rigid: "rigid",
};

const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
};

const Haptics = {
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default Haptics;
