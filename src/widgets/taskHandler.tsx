import { requestWidgetUpdateById } from "react-native-android-widget";

import { readWidgetState } from "@/libs/widget";
import { WIDGETS } from "@/widgets/registry";

import type { WidgetInfo } from "react-native-android-widget";

/** A launcher's event as the library hands it to the background task: the widget, and what happened to it. */
export interface WidgetTaskData extends WidgetInfo {
  widgetAction: string;
}

/** The events a widget is drawn again for. */
const DRAWN_ON = ["WIDGET_ADDED", "WIDGET_UPDATE", "WIDGET_RESIZED"];

/**
 * What the launcher asks a widget for (added, redrawn, resized; a removal or a click draws nothing: a tap is a link, ADR-043),
 * with the app closed too. Loaded only when a widget asks (`@/libs/widget/register`), it draws the last state the app wrote
 * (`readWidgetState`) through the library's public redraw of one widget.
 */
export async function widgetTask(data: WidgetTaskData): Promise<void> {
  if (!DRAWN_ON.includes(data.widgetAction)) return;
  const draw = WIDGETS[data.widgetName];
  if (!draw) return;
  const state = await readWidgetState();
  await requestWidgetUpdateById({
    widgetName: data.widgetName,
    widgetId: data.widgetId,
    renderWidget: (info) => draw(state, info),
  });
}
