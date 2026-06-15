import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Resolves to `true` once the screen's enter transition has finished.
 *
 * Autofocusing an input — especially one living inside a WebView (rich text /
 * code editor) — while the native-stack push animation is still running is
 * unreliable: the keyboard request is frequently dropped and the content
 * visibly "jumps". Gating autofocus on this flag focuses only after the screen
 * has settled.
 *
 * On web there is no native-stack transition, so it returns `true` immediately.
 */
export function useScreenTransitionEnd(): boolean {
  const navigation = useNavigation();
  const [done, setDone] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web") return;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setDone(true);
    };

    // Native-stack emits `transitionEnd` when the push animation completes. It's
    // not part of the base navigation event map's types, so narrow `addListener`
    // to the native-stack signature here.
    const addListener = navigation.addListener as unknown as (event: "transitionEnd", callback: () => void) => () => void;
    const unsubscribe = addListener("transitionEnd", finish);
    // Fallback in case the event never fires (already settled / not a stack):
    // 450ms comfortably clears the default fade_from_bottom animation.
    const timer = setTimeout(finish, 450);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [navigation]);

  return done;
}
