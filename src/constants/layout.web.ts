import type { ViewStyle } from "react-native";

import { MAX_WIDTH } from "@/constants/styles";

/** Same shape as in `layout.ts` (only the keys a column sets). */
type ColumnStyle = Pick<ViewStyle, "width" | "maxWidth" | "alignSelf">;

/** A settings page's content: a readable column centered on a wide window (the header and the background stay full width). */
export const CONTENT_COLUMN: ColumnStyle = {
  width: "100%",
  maxWidth: MAX_WIDTH.page,
  alignSelf: "center",
};

/** The secret-code keypad: capped and centered on a wide window. */
export const KEYPAD_COLUMN: ColumnStyle = {
  width: "100%",
  maxWidth: MAX_WIDTH.keypad,
  alignSelf: "center",
};
