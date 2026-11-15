import type { WidgetState } from "@/libs/widget/snapshot";
import type { RootState } from "@/types";
import type { Store } from "@reduxjs/toolkit";

/* The web app and the desktop have no widgets. */

export async function readWidgetState(): Promise<WidgetState | null> {
  return null;
}

export function startWidget(_store: Store<RootState>): () => void {
  return () => {};
}
