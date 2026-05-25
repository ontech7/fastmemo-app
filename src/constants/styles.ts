import { Platform } from "react-native";

export const MONOSPACE_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const COLOR = {
  black: "#000",
  softWhite: "#f4f6fa",
  darkBlue: "#020e35",
  blue: "#232e51",
  boldBlue: "#24325A",
  lightBlue: "#A7ABB9",
  lightGray: "#B9B5A7",
  gray: "#DAD9DE",
  softenGray: "#DAD9DE70",
  placeholder: "#DAD9DE90",
  important: "#A43D3F",
  darkImportant: "#732B2C",
  importantIcon: "#B66465",
  yellow: "#EEE78E",
  darkYellow: "#D8D28B",
  oceanBreeze: "#A7C7F4",
  darkOceanBreeze: "#799EDC",
  codeMint: "#A3D9C8",
  darkCodeMint: "#7FBFAC",

  // --- 2026 redesign: additive tokens (existing keys above are kept for backward compat) ---
  // Backgrounds / surfaces (deep night blue identity)
  bg: "#05091A",
  bgElevated: "#0D1432",
  surface: "#131A3C",
  surfaceMuted: "#1A2248",
  // Text hierarchy
  textPrimary: "#F4F6FA",
  textSecondary: "#AEB6D6",
  textMuted: "#717BA6",
  // Accent (single brand color — used solid with a soft glow)
  accent: "#4F6BFF",
  accentSoft: "#6B86FF",
  accentDeep: "#3A52E0",
  // Muted/desaturated indigo for calmer selected surfaces (e.g. category cards)
  // where the full accent reads too loud against the dark surface.
  accentMuted: "#475AA6",
  accentMutedBorder: "#5E72C4",
} as const;

export const KANBAN_COLUMN_COLORS = ["#A7ABB9", "#799EDC", "#00c951", "#EEE78E", "#ff6900", "#A43D3F", "#DAD9DE"] as const;

/**
 * Per-type accent for the NoteCard left border. Saturated enough to read as a
 * thin edge on the light (softWhite) card. `important` notes are handled apart
 * (solid red card), so they're not listed here.
 */
export const CARD_TYPE_COLOR = {
  text: "#9AA1B4",
  todo: "#C7A12B",
  kanban: "#5B82CB",
  code: "#3FA98B",
} as const;

/** Translucent fills + borders for glass surfaces (BlurView overlay / web backdrop-filter). */
export const GLASS = {
  fill: "rgba(255, 255, 255, 0.06)",
  fillStrong: "rgba(255, 255, 255, 0.10)",
  navyFill: "rgba(18, 26, 64, 0.55)",
  border: "rgba(255, 255, 255, 0.12)",
  hairline: "rgba(255, 255, 255, 0.06)",
} as const;

/** BlurView intensities (native) / px radius mapping (web backdrop-filter). */
export const BLUR = {
  subtle: 24,
  regular: 45,
  strong: 75,
  tint: "dark" as const,
};

export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  fab: {
    shadowColor: COLOR.accentMuted,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  glow: {
    shadowColor: COLOR.accentMuted,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const FONTSIZE = {
  title: 32,
  intro: 28,
  subtitle: 22,
  paragraph: 16,
  medium: 14,
  small: 12,
  inputTitle: 18,
  cardTitle: 18,
} as const;

export const FONTWEIGHT = {
  semiBold: Platform.OS === "ios" ? "600" : "700",
  regular: "400",
  light: "300",
} as const;

/**
 * Geist font families. Weights are separate font files (loaded in _layout via useFonts),
 * so apply weight through `fontFamily` instead of `fontWeight` when using Geist.
 */
export const FONT = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semiBold: "Geist-SemiBold",
  bold: "Geist-Bold",
} as const;

export const PADDING_MARGIN = {
  xs: 3,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 35,
  xxl: 50,
} as const;

export const SIZE = {
  full: "100%",
  half: "50%",
  third: "33.33%",
  quarter: "25%",
} as const;

export const BORDER = {
  small: 7,
  normal: 12,
  big: 20,
  rounded: 999,
} as const;
