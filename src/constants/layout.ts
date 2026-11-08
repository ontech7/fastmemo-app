import type { ViewStyle } from "react-native";

/** Only the keys a column sets: the whole `ViewStyle` carries web-only fields that `StyleSheet.create` refuses in a spread. */
type ColumnStyle = Pick<ViewStyle, "width" | "maxWidth" | "alignSelf">;

/**
 * Native: no cap on the width of a page's content or of the keypad (phones and tablets keep their layout). The desktop and web
 * values are in `layout.web.ts`.
 */
export const CONTENT_COLUMN: ColumnStyle = {};

export const KEYPAD_COLUMN: ColumnStyle = {};
