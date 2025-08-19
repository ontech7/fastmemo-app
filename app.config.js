const { configs } = require("./configs");

module.exports = {
  expo: {
    owner: "dontrok1",
    name: configs.app.name,
    slug: configs.app.slug,
    version: configs.app.version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: configs.app.slug,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    backgroundColor: configs.app.backgroundColor,
    ios: {
      supportsTablet: true,
      bundleIdentifier: configs.app.bundle,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: configs.app.backgroundColor,
      },
      edgeToEdgeEnabled: true,
      package: configs.app.bundle,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
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
          image: "./assets/images/splash-icon.png",
          imageWidth: 150,
          backgroundColor: configs.app.backgroundColor,
        },
      ],
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
    githubUrl: "https://github.com/ontech7/fastmemo-app",
    extra: {
      eas: {
        projectId: "1080a020-2103-4429-8f79-d517d79559cb", // DEV
      },
    },
  },
};
