import type { ConfigContext, ExpoConfig } from "expo/config";
import {
  type AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  withMainActivity,
  withMainApplication,
} from "expo/config-plugins";
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

// Three shortcuts on the app's icon (spec D.2): New note, New list, Dictation. Each is one of the app's launch links
// (src/libs/launch/parse.ts, written here as literals: a config can't import the app's code), opened by package with no
// class, because MainActivity is disabled while an alternate icon is in use. The meta-data goes on MainActivity and on
// every alias; it wraps withAlternateIconIntentFilters, so the aliases exist when it runs. The labels are in a strings
// file of their own, in the app's seven languages; the icons are the app's pencil, list and microphone.
const LAUNCHER_SHORTCUTS = [
  { id: "new_note", link: "launch/new/text", icon: "shortcut_note" },
  { id: "new_list", link: "launch/new/todo", icon: "shortcut_list" },
  { id: "dictation", link: "launch/dictate", icon: "shortcut_mic" },
] as const;

type ShortcutLabels = Record<(typeof LAUNCHER_SHORTCUTS)[number]["id"], [short: string, long: string]>;

// "values" is English; the others are res/values-b+<lang>.
const LAUNCHER_SHORTCUT_LABELS: Record<string, ShortcutLabels> = {
  values: {
    new_note: ["New note", "New note"],
    new_list: ["New list", "New list"],
    dictation: ["Dictation", "Dictate a note"],
  },
  it: {
    new_note: ["Nuova nota", "Nuova nota"],
    new_list: ["Lista", "Nuova lista"],
    dictation: ["Dettatura", "Detta una nota"],
  },
  es: { new_note: ["Nota", "Nueva nota"], new_list: ["Lista", "Nueva lista"], dictation: ["Dictado", "Dictar una nota"] },
  fr: { new_note: ["Note", "Nouvelle note"], new_list: ["Liste", "Nouvelle liste"], dictation: ["Dictée", "Dicter une note"] },
  de: { new_note: ["Notiz", "Neue Notiz"], new_list: ["Liste", "Neue Liste"], dictation: ["Diktat", "Notiz diktieren"] },
  zh: { new_note: ["新建笔记", "新建笔记"], new_list: ["列表", "新建列表"], dictation: ["听写", "听写一条笔记"] },
  ja: {
    new_note: ["新規ノート", "新しいノート"],
    new_list: ["リスト", "新しいリスト"],
    dictation: ["音声入力", "ノートを音声入力"],
  },
};

// heroicons outline (react-native-heroicons/outline: PencilIcon, ListBulletIcon, MicrophoneIcon), 24 × 24, stroke 1.5.
const LAUNCHER_SHORTCUT_PATHS: Record<(typeof LAUNCHER_SHORTCUTS)[number]["icon"], string> = {
  shortcut_note:
    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125",
  shortcut_list:
    "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
  shortcut_mic:
    "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z",
};

const xmlText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "\\'");

const shortcutsXml = (pkg: string, scheme: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${LAUNCHER_SHORTCUTS.map(
  ({ id, link, icon }) => `  <shortcut
    android:shortcutId="${id}"
    android:enabled="true"
    android:icon="@drawable/${icon}"
    android:shortcutShortLabel="@string/shortcut_${id}_short"
    android:shortcutLongLabel="@string/shortcut_${id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${pkg}"
      android:data="${scheme}://${link}" />
  </shortcut>`
).join("\n")}
</shortcuts>
`;

const shortcutStringsXml = (labels: ShortcutLabels) =>
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
${Object.entries(labels)
  .map(
    ([id, [short, long]]) =>
      `  <string name="shortcut_${id}_short">${xmlText(short)}</string>\n  <string name="shortcut_${id}_long">${xmlText(long)}</string>`
  )
  .join("\n")}
</resources>
`;

// The glyph edge to edge: the launcher already shrinks the icon into its circle.
const shortcutIconXml = (pathData: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:pathData="${pathData}"
    android:fillColor="#00000000"
    android:strokeColor="#4F6BFF"
    android:strokeWidth="1.5"
    android:strokeLineCap="round"
    android:strokeLineJoin="round" />
</vector>
`;

const withLauncherShortcuts: ConfigPlugin = (config) =>
  withDangerousMod(
    withAndroidManifest(config, (modConfig) => {
      const application = modConfig.modResults.manifest.application?.[0] as
        | (AndroidConfig.Manifest.ManifestApplication & { "activity-alias"?: AndroidConfig.Manifest.ManifestActivity[] })
        | undefined;
      const activities = [
        ...(application?.activity ?? []).filter((activity) => activity.$["android:name"] === ".MainActivity"),
        ...(application?.["activity-alias"] ?? []).filter(
          (alias) => alias.$["android:targetActivity" as keyof typeof alias.$] === ".MainActivity"
        ),
      ];
      for (const activity of activities) {
        const metaData = (activity["meta-data"] ?? []).filter((item) => item.$["android:name"] !== "android.app.shortcuts");
        metaData.push({ $: { "android:name": "android.app.shortcuts", "android:resource": "@xml/shortcuts" } });
        activity["meta-data"] = metaData;
      }
      return modConfig;
    }),
    [
      "android",
      (modConfig) => {
        const res = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res");
        const write = (dir: string, name: string, contents: string) => {
          fs.mkdirSync(path.join(res, dir), { recursive: true });
          fs.writeFileSync(path.join(res, dir, name), contents);
        };
        write("xml", "shortcuts.xml", shortcutsXml(appBundle, appSlug.toLowerCase()));
        for (const [lang, labels] of Object.entries(LAUNCHER_SHORTCUT_LABELS)) {
          write(lang === "values" ? "values" : `values-b+${lang}`, "shortcuts.xml", shortcutStringsXml(labels));
        }
        for (const [name, pathData] of Object.entries(LAUNCHER_SHORTCUT_PATHS)) {
          write("drawable", `${name}.xml`, shortcutIconXml(pathData));
        }
        return modConfig;
      },
    ]
  );

// At launch the stored notes are read with expo-file-system, and expo-modules builds the options object of that first call
// through kotlin-reflect, whose first use loads its metadata: the rest of the notes and every other Expo call wait behind it
// (~120 ms on the emulator, more on an older phone). Started on a thread of its own as the app starts, it runs while the JS
// engine starts instead. By name: a class renamed in an expo-file-system update only skips the warm-up.
const KOTLIN_REFLECT_WARMUP = "// FastMemo: kotlin-reflect warm-up (app.config.ts)";
const KOTLIN_REFLECT_WARMUP_CLASSES = [
  "InfoOptionsLegacy",
  "ReadingOptions",
  "WritingOptions",
  "RelocatingOptions",
  "DeletingOptions",
  "MakeDirectoryOptions",
].map((name) => `expo.modules.filesystem.legacy.${name}`);

const withKotlinReflectWarmup: ConfigPlugin = (config) =>
  withMainApplication(config, (modConfig) => {
    const { contents, language } = modConfig.modResults;
    if (language !== "kt" || contents.includes(KOTLIN_REFLECT_WARMUP)) return modConfig;
    const names = KOTLIN_REFLECT_WARMUP_CLASSES.map((name) => `"${name}"`).join(", ");
    modConfig.modResults.contents = contents.replace(
      /^([ \t]*)super\.onCreate\(\)\n/m,
      (line, indent: string) =>
        `${line}${indent}${KOTLIN_REFLECT_WARMUP}\n` +
        `${indent}Thread({\n` +
        `${indent}  for (name in listOf(${names})) {\n` +
        `${indent}    runCatching { Class.forName(name).kotlin.constructors.forEach { it.parameters } }\n` +
        `${indent}  }\n` +
        `${indent}}, "kotlin-reflect-warmup").start()\n`
    );
    return modConfig;
  });

// Android keeps the intent that started the app: when the system closed the app in the background and it is opened again
// (the recent apps), the activity is created again with that same intent (a share, a link, a shortcut), and React Native,
// expo-sharing and the router read it as new: a share made a second note. An activity created again (a saved state), or
// started again from the recent apps, starts as from the icon. And a new intent becomes the activity's own: when Android
// brings back a killed process in its kept task, a link, a shortcut, a widget's or a notification's tap comes as a new
// intent before React Native is up, which drops it; kept as the activity's intent, it is the starting link (LL-095).
const RECENTS_START_PLAIN = "// FastMemo: created again or opened from the recent apps, as from the icon (app.config.ts)";

const withRecentsStartPlain: ConfigPlugin = (config) =>
  withMainActivity(config, (modConfig) => {
    const { contents, language } = modConfig.modResults;
    if (language !== "kt" || contents.includes(RECENTS_START_PLAIN)) return modConfig;
    modConfig.modResults.contents = contents.replace(
      /^([ \t]*)super\.onCreate\((null|savedInstanceState)\)\n/m,
      (line, indent: string) =>
        `${indent}${RECENTS_START_PLAIN}\n` +
        `${indent}if (savedInstanceState != null || (intent.flags and android.content.Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {\n` +
        `${indent}  intent = android.content.Intent(android.content.Intent.ACTION_MAIN)\n` +
        `${indent}    .addCategory(android.content.Intent.CATEGORY_LAUNCHER)\n` +
        `${indent}    .setPackage(packageName)\n` +
        `${indent}}\n` +
        line
    );
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      /^([ \t]*)override fun getMainComponentName\(\)/m,
      (line, indent: string) =>
        `${indent}override fun onNewIntent(intent: android.content.Intent) {\n` +
        `${indent}  super.onNewIntent(intent)\n` +
        `${indent}  setIntent(intent)\n` +
        `${indent}}\n\n` +
        line
    );
    return modConfig;
  });

// The Geist weights, built into the apps (no font to load at launch). On Android the file name is the family name, as
// FONT in src/constants/styles.ts uses it. The web loads them (src/hooks/useAppFonts.web.ts).
const GEIST_FONTS = ["Regular", "Medium", "SemiBold", "Bold"].map((weight) => `./assets/fonts/Geist-${weight}.ttf`);

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
  withLauncherShortcuts(
    withAlternateIconIntentFilters(
      withRecentsStartPlain(
        withKotlinReflectWarmup(
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
              // Lowercase: EAS Update refuses a manifest with "FastMemoApp" (LL-076). Builds since 4.1.0 have it too.
              scheme: appSlug.toLowerCase(),
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
                // A reminder rings at its minute (spec D.5): the user grants it in "Alarms and reminders".
                permissions: ["android.permission.SCHEDULE_EXACT_ALARM"],
                blockedPermissions: [
                  "android.permission.READ_MEDIA_IMAGES",
                  "android.permission.READ_MEDIA_VIDEO",
                  "android.permission.READ_MEDIA_AUDIO",
                  // expo-notifications brings these: no badge, no push, no install referrer (spec D.5).
                  "android.permission.READ_APP_BADGE",
                  "com.google.android.c2dm.permission.RECEIVE",
                  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
                  "com.anddoes.launcher.permission.UPDATE_COUNT",
                  "com.htc.launcher.permission.READ_SETTINGS",
                  "com.htc.launcher.permission.UPDATE_SHORTCUT",
                  "com.huawei.android.launcher.permission.CHANGE_BADGE",
                  "com.huawei.android.launcher.permission.READ_SETTINGS",
                  "com.huawei.android.launcher.permission.WRITE_SETTINGS",
                  "com.majeur.launcher.permission.UPDATE_BADGE",
                  "com.oppo.launcher.permission.READ_SETTINGS",
                  "com.oppo.launcher.permission.WRITE_SETTINGS",
                  "com.sec.android.provider.badge.permission.READ",
                  "com.sec.android.provider.badge.permission.WRITE",
                  "com.sonyericsson.home.permission.BROADCAST_BADGE",
                  "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
                  "me.everything.badger.permission.BADGE_COUNT_READ",
                  "me.everything.badger.permission.BADGE_COUNT_WRITE",
                ],
              },
              web: {
                bundler: "metro",
                output: "single",
                favicon,
              },
              plugins: [
                // Every screen in the main bundle on web, as up to SDK 57: SDK 58 loads each route's code on first visit by default,
                // and the desktop app showed an empty screen before every screen it opened.
                ["expo-router", { asyncRoutes: { web: false } }],
                "expo-status-bar",
                ["expo-font", { fonts: GEIST_FONTS }],
                "expo-image",
                "expo-image-picker",
                "expo-localization",
                "expo-secure-store",
                // Sharing to the app (spec D.3): text, an address, pictures. Nothing it can't keep, so it isn't offered for them.
                [
                  "expo-sharing",
                  {
                    android: {
                      enabled: true,
                      singleShareMimeTypes: ["text/plain", "image/*"],
                      multipleShareMimeTypes: ["image/*"],
                    },
                  },
                ],
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
                // Its iOS memory entitlements are added only when EAS_BUILD_PROFILE or NODE_ENV says production, so the config
                // (and the fingerprint) differed between EAS and this machine: OTAs would never match the build. iOS isn't shipped.
                ["llama.rn", { enableEntitlements: false }],
                ["expo-alternate-app-icons", alternateAppIcons],
                // Reminders, scheduled and shown on the phone only: no push token, no Firebase file (spec D.5).
                ["expo-notifications", { icon: "./assets/images/notification-icon.png", color: "#4F6BFF" }],
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
        )
      )
    )
  );
