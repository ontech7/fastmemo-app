import { useState } from "react";
import { useRouter as useExpoRouter } from "expo-router";

import type { Href } from "expo-router";
import type { NavigationOptions } from "expo-router/build/global-state/routing";

export function useRouter() {
  const router = useExpoRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const push = (href: Href, options?: NavigationOptions) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(href, options);
    setTimeout(() => {
      setIsNavigating(false);
    }, 1000);
  };

  return {
    ...router,
    push,
    isNavigating,
  };
}
