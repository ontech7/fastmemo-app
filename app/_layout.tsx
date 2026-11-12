// Must be first: installs global.crypto.getRandomValues (secure RNG) so crypto-js
// can generate IVs/salts on native (Hermes), where there is no WebCrypto global.
import "react-native-get-random-values";

import "@/styles/global.css";

import CrashScreen from "@/components/CrashScreen";
import WebToaster from "@/components/WebToaster";
import AppBackground from "@/components/ui/AppBackground";
import { BORDER, COLOR, FONT, FONTSIZE, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useModelDownloadResume } from "@/hooks/useModelDownloadResume";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { installDesktopMenu } from "@/libs/desktopMenu";
import { initDiagnostics } from "@/libs/diagnostics";
import { installFlushOnExit } from "@/libs/flushOnExit";
import i18n from "@/libs/i18n";
import { installMcpBridge } from "@/libs/mcp/bridge";
import { installMessageGuard } from "@/libs/messageGuard";
import AppUpdateProvider from "@/providers/AppUpdateProvider";
import DiagnosticsProvider from "@/providers/DiagnosticsProvider";
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
installMcpBridge();
installDesktopMenu();

SplashScreen.preventAutoHideAsync().catch(() => {});

const renderCrashScreen = ({ eventId }: { eventId: string }) => <CrashScreen eventId={eventId} />;

export const unstable_settings = {
  anchor: "index",
};

// Sentry, its scrubbing and its tags. Its own handler reports a fatal JS error once, marked fatal (ADR-035).
initDiagnostics();

export default Sentry.wrap(function RootLayout() {
  const { colors } = useTheme();
  colors.background = "transparent";

  // Web: no Backspace history navigation; desktop: Esc, Cmd/Ctrl+N/F, no reload (no-op on native).
  useKeyboardShortcuts();

  // The apps have the fonts built in. The web loads them while it renders: its first screen is the logo image, with no
  // text to reflow when Geist comes in.
  useAppFonts();

  // An AI model download the app was closed during: finished, or followed again (no-op on the web).
  useModelDownloadResume();

  // Hide the splash only once a JS view (the gradient splash or the app shell)
  // has laid out, so the gradient is already painted underneath — no flash of
  // the flat background.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A render error anywhere (a provider included) shows the crash screen instead of a blank one; Sentry has the error
  // before the fallback renders (ADR-035).
  return (
    <Sentry.ErrorBoundary fallback={renderCrashScreen}>
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
                // A target of at least 44 dp, its label centred.
                button: {
                  minHeight: 44,
                  justifyContent: "center",
                },
                text: {
                  color: COLOR.accentSoft,
                  fontSize: FONTSIZE.paragraph,
                  fontFamily: FONT.semiBold,
                },
              },
            }}
          >
            <Provider store={store}>
              <PersistGate loading={null} persistor={persistor}>
                <SyncOnProvider />
                <DiagnosticsProvider />
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
                        <Stack.Screen
                          name="categories/create"
                          options={{ headerShown: false, animation: "fade_from_bottom" }}
                        />
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
                        <Stack.Screen
                          name="settings/information"
                          options={{ headerShown: false, animation: "ios_from_left" }}
                        />
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
                        <Stack.Screen name="settings/mcp" options={{ headerShown: false, animation: "ios_from_left" }} />
                        <Stack.Screen
                          name="settings/voice-recognition"
                          options={{ headerShown: false, animation: "ios_from_left" }}
                        />
                        <Stack.Screen
                          name="settings/ai-assistant"
                          options={{ headerShown: false, animation: "ios_from_left" }}
                        />
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
    </Sentry.ErrorBoundary>
  );
});

/* STYLES */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
