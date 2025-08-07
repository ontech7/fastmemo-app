import { configs } from "@/configs";
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { I18nextProvider } from "react-i18next";

import i18n from "@/libs/i18n";

import "react-native-reanimated";

Sentry.init({
  dsn: configs.sentry.dns,
  environment: configs.environment,
  sendDefaultPii: false,
});

export default Sentry.wrap(function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <Stack>
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </I18nextProvider>
  );
});
