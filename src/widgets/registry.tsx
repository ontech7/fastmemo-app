import type { WidgetState } from "@/libs/widget/snapshot";

/**
 * The app's widgets, by the name `app.config.ts` gives each (spec D.6): what each draws from the state. The handler draws
 * the one the launcher asks for, `startWidget` redraws them all when the state changes. The widgets come in Task 42.
 */
export const WIDGETS: Record<string, (state: WidgetState) => React.JSX.Element> = {};
