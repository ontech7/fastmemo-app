// Native (iOS/Android) no-op: the zoom is the desktop window's. The web build uses the `.web.ts` sibling.

/** Sets the webview's zoom. */
export async function applyZoom(_percent: number): Promise<void> {}

export async function applyStoredZoom(): Promise<void> {}

export function zoom(_direction: "in" | "out" | "reset"): void {}
