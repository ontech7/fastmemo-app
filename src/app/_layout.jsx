import "../styles/global.css";

import { configs } from "@/configs";
import { BORDER, COLOR } from "@/constants/styles";
import i18n from "@/libs/i18n";
import SyncOnProvider from "@/providers/SyncOnProvider";
import { persistor, store } from "@/slicers/store";
import { DialogProvider } from "@ontech7/react-native-dialog";
import { useTheme } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { MenuProvider } from "react-native-popup-menu";
import { RootSiblingParent } from "react-native-root-siblings";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

const WebToaster = Platform.OS === "web" ? require("react-hot-toast").Toaster : null;

export const unstable_settings = {
  initialRouteName: "index",
};

ErrorUtils.setGlobalHandler((error, isFatal) => {
  Sentry.captureException(error, { data: { isFatal } });
});

Sentry.init({
  dsn: "https://1b0f816610bb05a5257bfa7ae165f49e@o4509804550750208.ingest.de.sentry.io/4509804582207568",
  environment: configs.environment,
  sendDefaultPii: false,
});

export default Sentry.wrap(function RootLayout() {
  const { colors } = useTheme();
  colors.background = configs.app.backgroundColor;

  return (
    <I18nextProvider i18n={i18n}>
      <KeyboardProvider>
        <DialogProvider
          customStyles={{
            container: {
              borderRadius: BORDER.small,
              maxWidth: "90%",
              width: Platform.OS === "web" ? 450 : "100%",
            },
            action: {
              color: COLOR.boldBlue,
              fontWeight: "500",
            },
          }}
        >
          <MenuProvider
            customStyles={{
              backdrop: { opacity: 0.3, backgroundColor: COLOR.black },
            }}
          >
            <Provider store={store}>
              <PersistGate loading={null} persistor={persistor}>
                <SyncOnProvider />
                <RootSiblingParent>
                  <StatusBar style="light" />
                  {WebToaster && <WebToaster />}
                  <Stack>
                    <Stack.Screen
                      name="index"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "none" }}
                    />
                    <Stack.Screen
                      name="intro"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade" }}
                    />
                    <Stack.Screen
                      name="home"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade" }}
                    />
                    <Stack.Screen
                      name="changelog"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="secret-code"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="notes/[noteId]"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="categories/organize"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="categories/create"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="categories/change"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="temporary-trash"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/general"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/cloud-sync/connect"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/cloud-sync/devices"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="settings/information"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/about-developer"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/help"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/report"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/setup-secret-code"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "fade_from_bottom" }}
                    />
                    <Stack.Screen
                      name="settings/webhooks"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen
                      name="settings/voice-recognition"
                      options={{ headerShown: false, presentation: "transparentModal", animation: "ios_from_left" }}
                    />
                    <Stack.Screen name="+not-found" />
                  </Stack>
                </RootSiblingParent>
              </PersistGate>
            </Provider>
          </MenuProvider>
        </DialogProvider>
      </KeyboardProvider>
    </I18nextProvider>
  );
});
