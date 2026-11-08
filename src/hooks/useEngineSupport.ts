import { useEffect, useState } from "react";

import type { EngineSupport } from "@/libs/ai";
import { isTauri } from "@/utils/platform";

/**
 * What the desktop's AI engine answers (whether its library loads here, the computer's memory), once per mount: null
 * until it answers, and always null outside the desktop shell (the phone asks `isNativeModuleAvailable`, a browser has
 * no AI). The answer is cached by the engine module, so asking again is free. The AI stack is imported when asked, so a
 * screen that only offers the AI doesn't evaluate it first.
 */
export default function useEngineSupport(): EngineSupport | null {
  const [support, setSupport] = useState<EngineSupport | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let live = true;
    import("@/libs/ai")
      .then(({ getEngineSupport }) => getEngineSupport())
      .then((answer) => live && setSupport(answer))
      .catch(() => live && setSupport({ available: false, totalMemory: null, reason: "error" }));
    return () => {
      live = false;
    };
  }, []);

  return support;
}
