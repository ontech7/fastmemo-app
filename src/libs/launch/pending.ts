import type { LaunchAction } from "@/libs/launch/parse";

/*
 * The one launch action waiting for the home (in memory): a link, a shortcut, a widget, a notification's tap. A newer one
 * replaces one not yet taken; the home takes it once.
 */

let pending: LaunchAction | null = null;
const listeners = new Set<() => void>();

export function setPendingLaunch(action: LaunchAction): void {
  pending = action;
  listeners.forEach((listener) => listener());
}

export function takePendingLaunch(): LaunchAction | null {
  const action = pending;
  pending = null;
  return action;
}

export function onPendingLaunch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
