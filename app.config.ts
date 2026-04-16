import type { ConfigContext, ExpoConfig } from "expo/config";

const isDev = process.env.EXPO_PUBLIC_ENV === "DEV";

const appName = isDev ? "Fast Memo Test" : "Fast Memo";
const appSlug = isDev ? "fastmemoapptest" : "FastMemoApp";
const appBundle = isDev ? "com.ontech7.fastmemoapptest" : "com.ontech7.FastMemoApp";
const appIcon = isDev ? "./src/assets/images/test/icon.png" : "./src/assets/images/icon.png";
const adaptiveIcon = isDev ? "./src/assets/images/test/adaptive-icon.png" : "./src/assets/images/adaptive-icon.png";
const favicon = isDev ? "./src/assets/images/test/favicon.png" : "./src/assets/images/favicon.png";
const backgroundColor = "#020e35";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "dontrok1",
  name: appName,
  slug: appSlug,
  version: "2.8.0",
  orientation: "portrait",
  icon: appIcon,
  scheme: appSlug,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  backgroundColor,
  ios: {
    supportsTablet: true,
    bundleIdentifier: appBundle,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: adaptiveIcon,
      backgroundColor,
    },
    edgeToEdgeEnabled: true,
    package: appBundle,
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon,
  },
  plugins: [
    "expo-router",
    "expo-image-picker",
    "expo-localization",
    "expo-secure-store",
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to use the microphone.",
        speechRecognitionPermission: "Allow $(PRODUCT_NAME) to use speech recognition.",
        androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"],
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./src/assets/images/splash-icon.png",
        imageWidth: 150,
        backgroundColor,
      },
    ],
    "llama.rn",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        note: "Use SENTRY_AUTH_TOKEN env to authenticate with Sentry.",
        project: "fastmemo-app",
        organization: "andrea-losavio",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "44c5f162-d9f8-40db-ae28-269fe48982ca", // DEV
    },
  },
});
