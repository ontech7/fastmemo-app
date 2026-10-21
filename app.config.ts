import type { ConfigContext, ExpoConfig } from "expo/config";
import { type AndroidConfig, type ConfigPlugin, withAndroidManifest, withDangerousMod } from "expo/config-plugins";
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
// refuse by default. The connect screen warns before saving an http address and recommends HTTPS (ADR-017). The
// manifest flag and a network security config: newer Android versions only read the config.
const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const withCleartextTraffic: ConfigPlugin = (config) =>
  withDangerousMod(
    withAndroidManifest(config, (modConfig) => {
      const application = modConfig.modResults.manifest.application?.[0];
      if (application) {
        application.$["android:usesCleartextTraffic"] = "true";
        application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
      }
      return modConfig;
    }),
    [
      "android",
      (modConfig) => {
        const dir = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "network_security_config.xml"), NETWORK_SECURITY_CONFIG);
        return modConfig;
      },
    ]
  );

// Changing the app icon on Android disables MainActivity and enables one of its <activity-alias> (expo-alternate-app-icons),
// which only gets the launcher intent filter: give every alias MainActivity's other filters too, otherwise the app's URL
// scheme (expo-router, the dev client) stops opening it once an alternate icon is chosen.
// It wraps the config, so it is registered before the `plugins` array, and Expo runs the mods registered last first: the
// aliases exist when it runs. Moved into `plugins` after expo-alternate-app-icons, it would find none and do nothing.
const isLauncherFilter = (filter: AndroidConfig.Manifest.ManifestIntentFilter) =>
  filter.action?.some((action) => action.$["android:name"] === "android.intent.action.MAIN") ?? false;

const withAlternateIconIntentFilters: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0] as
      | (AndroidConfig.Manifest.ManifestApplication & { "activity-alias"?: AndroidConfig.Manifest.ManifestActivity[] })
      | undefined;
    const mainActivity = application?.activity?.find((activity) => activity.$["android:name"] === ".MainActivity");
    const filters = (mainActivity?.["intent-filter"] ?? []).filter((filter) => !isLauncherFilter(filter));

    for (const alias of application?.["activity-alias"] ?? []) {
      if (alias.$["android:targetActivity" as keyof typeof alias.$] !== ".MainActivity") continue;
      alias["intent-filter"] = [...(alias["intent-filter"] ?? []).filter(isLauncherFilter), ...filters];
    }
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

// The alternate app icons (Settings > Developer options > Change app icon). Same names as AppIconName in
// src/constants/app-icons.ts; the images come from scripts/build-app-icons.mjs.
const alternateAppIcons = ["Halloween", "Christmas", "Easter", "Summer"].map((name) => {
  const image = `./assets/images/app-icons/${name.toLowerCase()}`;
  return {
    name,
    ios: `${image}.png`,
    android: {
      foregroundImage: `${image}-foreground.png`,
      backgroundImage: `${image}-background.png`,
      backgroundColor,
    },
  };
});

// The production EAS project (the old DEV project is no longer used).
const EAS_PROJECT_ID = "44c5f162-d9f8-40db-ae28-269fe48982ca";

export default ({ config }: ConfigContext): ExpoConfig =>
  withAlternateIconIntentFilters(
    withCleartextTraffic(
      withLlamaProguardRules({
        ...config,
        owner: "dontrok1",
        name: appName,
        slug: appSlug,
        version: "4.0.0",
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
          ["expo-alternate-app-icons", alternateAppIcons],
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
    )
  );
