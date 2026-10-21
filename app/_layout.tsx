// Must be first: installs global.crypto.getRandomValues (secure RNG) so crypto-js
// can generate IVs/salts on native (Hermes), where there is no WebCrypto global.
import "react-native-get-random-values";
// Before anything renders a draggable list: re-provides InteractionManager (removed in RN 0.87).
import "@/libs/polyfills/interactionManager";

import "@/styles/global.css";

import WebToaster from "@/components/WebToaster";
import AppBackground from "@/components/ui/AppBackground";
import { configs } from "@/configs";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { installDesktopMenu } from "@/libs/desktopMenu";
import { installFlushOnExit } from "@/libs/flushOnExit";
import i18n from "@/libs/i18n";
import { installMessageGuard } from "@/libs/messageGuard";
import AppUpdateProvider from "@/providers/AppUpdateProvider";
import SyncOnProvider from "@/providers/SyncOnProvider";
import { persistor, store } from "@/slicers/store";
import { DialogProvider } from "@ontech7/react-native-dialog";
import * as Sentry from "@sentry/react-native";
import { Stack, useTheme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { I18nextProvider } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { RootSiblingParent } from "react-native-root-siblings";
import { enableFreeze } from "react-native-screens";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

enableFreeze(true);

installMessageGuard();
installFlushOnExit();
installDesktopMenu();

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: "index",
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

  // Web: no Backspace history navigation; desktop: Esc, Cmd/Ctrl+N/F, no reload (no-op on native).
  useKeyboardShortcuts();

  // The apps have the fonts built in. The web loads them while it renders: its first screen is the logo image, with no
  // text to reflow when Geist comes in.
  useAppFonts();

  // Hide the splash only once a JS view (the gradient splash or the app shell)
  // has laid out, so the gradient is already painted underneath — no flash of
  // the flat background.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

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
              textInput: {
                color: COLOR.textPrimary,
                fontFamily: FONT.regular,
              },
            },
            footer: {
              padding: PADDING_MARGIN.lg,
              paddingTop: PADDING_MARGIN.md,
              gap: PADDING_MARGIN.sm,
            },
            action: {
              text: {
                color: COLOR.accentSoft,
                fontSize: FONTSIZE.paragraph,
                fontWeight: "600",
              },
            },
          }}
        >
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <SyncOnProvider />
              <AppUpdateProvider>
                <RootSiblingParent>
                  <StatusBar style="light" />
                  <WebToaster />
                  <View style={styles.root} onLayout={onLayoutRootView}>
                    <AppBackground style={StyleSheet.absoluteFill} />
                    {/* `id={undefined}` is the runtime default; expo-router 58's navigator
                        types only demand it because strictNullChecks is off. */}
                    <Stack id={undefined} screenOptions={{ contentStyle: { backgroundColor: "transparent" } }}>
                      <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
                      <Stack.Screen name="intro" options={{ headerShown: false, animation: "fade" }} />
                      {/* No animation into home (from the logo, the intro, a note that can't open): it ran while home was drawing its
                          first frame, and stuttered. The intro keeps its fade. */}
                      <Stack.Screen name="home" options={{ headerShown: false, animation: "none" }} />
                      <Stack.Screen name="changelog" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                      <Stack.Screen name="secret-code" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                      <Stack.Screen name="notes/[noteId]" options={{ headerShown: false, animation: "fade_from_bottom" }} />
                      <Stack.Screen
                        name="categories/organize"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
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
                      <Stack.Screen
                        name="settings/cloud-sync/vault-setup"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
                      <Stack.Screen
                        name="settings/cloud-sync/vault-unlock"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
                      <Stack.Screen
                        name="settings/cloud-sync/vault-recovery"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
                      <Stack.Screen
                        name="settings/cloud-sync/vault-recover"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
                      <Stack.Screen
                        name="settings/cloud-sync/vault-change"
                        options={{ headerShown: false, animation: "fade_from_bottom" }}
                      />
                      <Stack.Screen
                        name="settings/cloud-sync/vault-reset"
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
                      <Stack.Screen name="settings/ai-eval" options={{ headerShown: false, animation: "ios_from_left" }} />
                      <Stack.Screen name="settings/app-icon" options={{ headerShown: false, animation: "ios_from_left" }} />
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
                      <Stack.Screen
                        name="settings/note-creation"
                        options={{ headerShown: false, animation: "ios_from_left" }}
                      />
                      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
                    </Stack>
                  </View>
                </RootSiblingParent>
              </AppUpdateProvider>
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
