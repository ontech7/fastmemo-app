import type { WidgetTaskHandlerProps } from "react-native-android-widget";

/**
 * What the launcher asks a widget for (added, redrawn, resized, removed): Android only, registered by the app's entry
 * (`index.ts` → `@/libs/widget/register`) so that it runs with the app closed. The widgets themselves come in Task 42.
 */
export async function widgetTaskHandler(_props: WidgetTaskHandlerProps): Promise<void> {}
