import { Platform } from "react-native";

export type ColorType = keyof typeof COLOR;
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
};

export type FontSizeType = keyof typeof FONTSIZE;
export const FONTSIZE = {
  title: 32,
  intro: 28,
  subtitle: 22,
  paragraph: 16,
  medium: 14,
  small: 12,
  inputTitle: 18,
  cardTitle: 18,
};

export type FontWeightType = keyof typeof FONTWEIGHT;
export const FONTWEIGHT = {
  semiBold: Platform.OS === "ios" ? "600" : "700",
  regular: "400",
  light: "300",
};

export type PaddingMarginType = keyof typeof PADDING_MARGIN;
export const PADDING_MARGIN = {
  xs: 3,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 35,
  xxl: 50,
};

export type SizeType = keyof typeof SIZE;
export const SIZE = {
  full: "100%",
  half: "50%",
  third: "33.33%",
  quarter: "25%",
};

export type BorderType = keyof typeof BORDER;
export const BORDER = {
  small: 7,
  normal: 12,
  big: 20,
  rounded: 999,
};
