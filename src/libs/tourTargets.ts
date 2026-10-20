import type { ViewInstance } from "react-native";

/*
 * What the first-note tour can point at: views register under a name (useTourTarget), and the tour's spotlight measures
 * them where they are on screen when it shows a step.
 */

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const targets = new Map<string, ViewInstance>();
const listeners = new Set<() => void>();

export const registerTourTarget = (name: string, view: ViewInstance | null, previous: ViewInstance | null) => {
  if (view) targets.set(name, view);
  else if (targets.get(name) === previous) targets.delete(name);
  listeners.forEach((listener) => listener());
};

/** Where a view is on screen (window coordinates), or `null` when it isn't there. */
export const measureInWindow = (view: ViewInstance | null | undefined) =>
  new Promise<TourRect | null>((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve(width || height ? { x, y, width, height } : null));
  });

export const measureTourTarget = (name: string) => measureInWindow(targets.get(name));

/** Calls `listener` whenever a target comes or goes. */
export const subscribeTourTargets = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
