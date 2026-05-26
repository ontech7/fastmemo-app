import "@/styles/global.css";

import WebToaster from "@/components/WebToaster";
import AppBackground from "@/components/ui/AppBackground";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { usePreventBackspaceNav } from "@/hooks/usePreventBackspaceNav";
import i18n from "@/libs/i18n";
import { closeTauriSplashscreen } from "@/libs/tauri";
import SyncOnProvider from "@/providers/SyncOnProvider";
import { persistor, store } from "@/slicers/store";
import { DialogProvider } from "@ontech7/react-native-dialog";
import { useTheme } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { RootSiblingParent } from "react-native-root-siblings";
import { enableFreeze } from "react-native-screens";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

enableFreeze(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  initialRouteName: "index",
};

ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
  Sentry.captureException(error, { data: { isFatal } });
});

Sentry.init({
  dsn: "https://1b0f816610bb05a5257bfa7ae165f49e@o4509804550750208.ingest.de.sentry.io/4509804582207568",
  environment: configs.environment,
  sendDefaultPii: false,
});

export default Sentry.wrap(function RootLayout() {
  const { colors } = useTheme();
  colors.background = "transparent";

  // Stop the WebView's Backspace-key history navigation (no-op on native).
  usePreventBackspaceNav();

  const [fontsLoaded, fontError] = useFonts({
    "Geist-Regular": require("@/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist-Bold.ttf"),
  });

  // Never get stuck on the splash if fonts fail or hang to load — e.g. on
  // Tauri/web the font asset URLs can resolve differently in the webview.
  // After a short grace period, proceed anyway (system-font fallback).
  const [fontWaitElapsed, setFontWaitElapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontWaitElapsed(true), 2500);
    return () => clearTimeout(id);
  }, []);

  // On web/Tauri the native expo splash doesn't exist and the font loader can
  // hang in the WebView (asset URLs resolve differently), so blocking the first
  // paint on it would leave the user staring at the flat background. Render
  // immediately and let Geist swap in once loaded — the first screen is just the
  // logo image, so there's no visible text reflow. Native still gates so text
  // never flashes a system font.
  const ready = Platform.OS === "web" || fontsLoaded || !!fontError || fontWaitElapsed;

  // Hide the splash only once a JS view (the gradient splash or the app shell)
  // has laid out, so the gradient is already painted underneath — no flash of
  // the flat background. On Tauri this also tears down the native splash window.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
    closeTauriSplashscreen();
  }, []);

  // While fonts load (native only), render nothing and keep the native splash up
  // (it's already COLOR.bg + the same centered logo, so there's no separate JS
  // splash to keep in sync). hideAsync only fires from the app shell's onLayout.
  if (!ready) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <KeyboardProvider>
        <DialogProvider
          customStyles={{
            container: {
              backgroundColor: COLOR.surface,
              borderRadius: BORDER.big,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: GLASS.border,
              maxWidth: "90%",
              width: Platform.OS === "web" ? 450 : "100%",
            },
            title: {
              color: COLOR.textPrimary,
              fontFamily: FONT.semiBold,
              fontSize: FONTSIZE.subtitle,
            },
            description: {
              color: COLOR.textSecondary,
              fontFamily: FONT.regular,
              fontSize: FONTSIZE.medium,
            },
            input: {
              color: COLOR.textPrimary,
              fontFamily: FONT.regular,
            },
            footer: {
              padding: PADDING_MARGIN.lg,
              paddingTop: PADDING_MARGIN.md,
              gap: PADDING_MARGIN.sm,
            },
            action: {
              color: COLOR.accentSoft,
              fontSize: FONTSIZE.paragraph,
              fontWeight: "600",
            },
          }}
        >
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <SyncOnProvider />
              <RootSiblingParent>
                <StatusBar style="light" />
                <WebToaster />
                <View style={styles.root} onLayout={onLayoutRootView}>
                  <AppBackground style={StyleSheet.absoluteFill} />
                  <Stack screenOptions={{ contentStyle: { backgroundColor: "transparent" } }}>
                    <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
                    <Stack.Screen name="intro" options={{ headerShown: false, animation: "fade" }} />
                    <Stack.Screen name="home" options={{ headerShown: false, animation: "fade" }} />
                    <Stack.Screen name="changelog" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                    <Stack.Screen name="secret-code" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                    <Stack.Screen name="notes/[noteId]" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                    <Stack.Screen name="categories/organize" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                    <Stack.Screen name="categories/create" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                    <Stack.Screen name="categories/change" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen name="temporary-trash" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen name="settings/general" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen
                      name="settings/cloud-sync/connect"
                      options={{ headerShown: false, animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/cloud-sync/devices"
                      options={{ headerShown: false, animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen name="settings/information" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen
                      name="settings/about-developer"
                      options={{ headerShown: false, animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/developer-options"
                      options={{ headerShown: false, animation: "ios_from_left" }}
                    />
                    <Stack.Screen name="settings/help" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen name="settings/report" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen
                      name="settings/setup-secret-code"
                      options={{ headerShown: false, animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen name="settings/webhooks" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen
                      name="settings/voice-recognition"
                      options={{ headerShown: false, animation: "ios_from_left" }}
                    />
                    <Stack.Screen name="settings/ai-assistant" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen name="settings/note-creation" options={{ headerShown: false, animation: "ios_from_left" }} />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                </View>
              </RootSiblingParent>
            </PersistGate>
          </Provider>
        </DialogProvider>
      </KeyboardProvider>
    </I18nextProvider>
  );
});

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
