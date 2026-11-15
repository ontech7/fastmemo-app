import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { readWidgetState } from "@/libs/widget";
import { WIDGETS } from "@/widgets/registry";

/**
 * What the launcher asks a widget for (added, redrawn, resized, removed): Android only, registered by the app's entry
 * (`index.ts` → `@/libs/widget/register`) so that it runs with the app closed. A widget draws the last state the app
 * wrote (`readWidgetState`).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const draw = WIDGETS[props.widgetInfo.widgetName];
  if (!draw) return;
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(draw(await readWidgetState()));
      break;
    default:
      break;
  }
}
