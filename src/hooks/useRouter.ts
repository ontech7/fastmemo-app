import { useEffect, useRef, useState } from "react";
import { useRouter as useExpoRouter } from "expo-router";

import type { Href } from "expo-router";
import type { NavigationOptions } from "expo-router/build/global-state/routing";

const NAVIGATION_GUARD_MS = 1000;

export function useRouter() {
  const router = useExpoRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const push = (href: Href, options?: NavigationOptions) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(href, options);

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsNavigating(false);
    }, NAVIGATION_GUARD_MS);
  };

  return {
    ...router,
    push,
    isNavigating,
  };
}
