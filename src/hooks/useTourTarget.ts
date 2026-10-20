import { registerTourTarget } from "@/libs/tourTargets";
import { useCallback, useRef } from "react";
import type { ViewInstance } from "react-native";

/** A ref that makes the view something the first-note tour can point at, under `name` (none without a name). */
export function useTourTarget(name?: string) {
  const current = useRef<ViewInstance | null>(null);

  return useCallback(
    (view: ViewInstance | null) => {
      if (!name) return;
      registerTourTarget(name, view, current.current);
      current.current = view;
    },
    [name]
  );
}
