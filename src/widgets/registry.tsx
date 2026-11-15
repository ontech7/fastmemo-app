import FeaturedNoteWidget from "@/widgets/FeaturedNoteWidget";
import NewNoteWidget from "@/widgets/NewNoteWidget";

import type { WidgetState } from "@/libs/widget/snapshot";

/** What the launcher says of a widget it draws: its size, dp. */
export interface WidgetSize {
  width: number;
  height: number;
}

/**
 * The app's widgets, by the name `app.config.ts` gives each (spec D.6): what each draws from the state. The handler draws
 * the one the launcher asks for, `startWidget` redraws them all when the state changes. Besides the state, a widget
 * gets only its size on the launcher.
 */
export const WIDGETS: Record<string, (state: WidgetState, size?: WidgetSize) => React.JSX.Element> = {
  NewNote: (state) => <NewNoteWidget state={state} />,
  FeaturedNote: (state, size) => <FeaturedNoteWidget state={state} width={size?.width} height={size?.height} />,
};
