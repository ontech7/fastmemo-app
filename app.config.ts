import type { ConfigContext, ExpoConfig } from "expo/config";
import { type ConfigPlugin, withAndroidManifest, withDangerousMod } from "expo/config-plugins";
import fs from "node:fs";
import path from "node:path";

// R8 is on for Android release builds since SDK 57, and llama.rn ships no consumer rules: keep
// its JNI classes (as its README asks), otherwise on-device AI breaks in release builds only.
const LLAMA_PROGUARD_RULE = "-keep class com.rnllama.** { *; }";

const withLlamaProguardRules: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    (modConfig) => {
      const file = path.join(modConfig.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const rules = fs.readFileSync(file, "utf8");
      if (!rules.includes(LLAMA_PROGUARD_RULE)) {
        fs.writeFileSync(file, `${rules.trimEnd()}\n\n# llama.rn (JNI)\n${LLAMA_PROGUARD_RULE}\n`);
      }
      return modConfig;
    },
  ]);

// A self-hosted FastMemo server on a home network is often plain http (a LAN address), which Android release builds
// refuse by default. The connect screen warns before saving an http address and recommends HTTPS (ADR-017).
const withCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application) application.$["android:usesCleartextTraffic"] = "true";
    return modConfig;
  });

const isDev = process.env.EXPO_PUBLIC_ENV === "DEV";

const appName = isDev ? "Fast Memo Test" : "Fast Memo";
const appSlug = isDev ? "fastmemoapptest" : "FastMemoApp";
const appBundle = isDev ? "com.ontech7.fastmemoapptest" : "com.ontech7.FastMemoApp";
const appIcon = isDev ? "./assets/images/test/icon.png" : "./assets/images/icon.png";
const adaptiveIcon = isDev ? "./assets/images/test/adaptive-icon.png" : "./assets/images/adaptive-icon.png";
const favicon = isDev ? "./assets/images/test/favicon.png" : "./assets/images/favicon.png";
const backgroundColor = "#05091A";

// The production EAS project (the old DEV project is no longer used).
const EAS_PROJECT_ID = "44c5f162-d9f8-40db-ae28-269fe48982ca";

export default ({ config }: ConfigContext): ExpoConfig =>
  withCleartextTraffic(
    withLlamaProguardRules({
      ...config,
      owner: "dontrok1",
      name: appName,
      slug: appSlug,
      version: "3.2.0",
      runtimeVersion: { policy: "fingerprint" },
      updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
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
          projectId: EAS_PROJECT_ID,
        },
      },
    })
  );
