import { useFonts } from "expo-font";

// The web has no fonts built in: load the Geist weights (the apps have them from app.config.ts, see the native sibling).
export function useAppFonts(): [loaded: boolean, error: Error | null] {
  return useFonts({
    "Geist-Regular": require("~/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("~/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("~/assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("~/assets/fonts/Geist-Bold.ttf"),
  });
}
