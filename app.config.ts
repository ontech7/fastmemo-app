import type { ConfigContext, ExpoConfig } from "expo/config";

const isDev = process.env.EXPO_PUBLIC_ENV === "DEV";

const appName = isDev ? "Fast Memo Test" : "Fast Memo";
const appSlug = isDev ? "fastmemoapptest" : "FastMemoApp";
const appBundle = isDev ? "com.ontech7.fastmemoapptest" : "com.ontech7.FastMemoApp";
const appIcon = isDev ? "./assets/images/test/icon.png" : "./assets/images/icon.png";
const adaptiveIcon = isDev ? "./assets/images/test/adaptive-icon.png" : "./assets/images/adaptive-icon.png";
const favicon = isDev ? "./assets/images/test/favicon.png" : "./assets/images/favicon.png";
const backgroundColor = "#05091A";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "dontrok1",
  name: appName,
  slug: appSlug,
  version: "3.2.0",
  orientation: "portrait",
  icon: appIcon,
  scheme: appSlug,
  userInterfaceStyle: "automatic",
  backgroundColor,
  ios: {
    supportsTablet: true,
    bundleIdentifier: appBundle,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: adaptiveIcon,
      backgroundImage: "./assets/images/adaptive-icon-bg.png",
      backgroundColor,
    },
    package: appBundle,
    blockedPermissions: [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon,
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-font",
    "expo-image",
    "expo-image-picker",
    "expo-localization",
    "expo-secure-store",
    "expo-sharing",
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
        image: "./assets/images/splash-logo.png",
        imageWidth: 150,
        backgroundColor,
      },
    ],
    "llama.rn",
    [
      "@sentry/react-native",
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
