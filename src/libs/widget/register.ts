import { AppRegistry } from "react-native";

import type { WidgetTaskData } from "@/widgets/taskHandler";

/** The background task react-native-android-widget 0.26 starts for a widget's event (its `registerWidgetTaskHandler`). */
const WIDGET_TASK = "RNWidgetBackgroundTask";

/*
 * The widgets' background task, registered by the app's entry (`index.ts`) so that a widget draws with the app closed
 * (spec D.6, ADR-045). Only the registration happens at start: the library, the widgets and their handler are loaded when
 * a widget asks, since loading them at start cost every cold start (measured on the Pixel at Stop D).
 */
AppRegistry.registerHeadlessTask(WIDGET_TASK, () => async (data) => {
  const { widgetTask } = await import("@/widgets/taskHandler");
  await widgetTask(data as WidgetTaskData);
});
