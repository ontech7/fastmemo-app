const { configs } = require("./configs");

module.exports = {
  expo: {
    name: configs.app.name,
    slug: configs.app.slug,
    version: configs.app.version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "fastmemoappnewarch",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    backgroundColor: configs.app.backgroundColor,
    ios: {
      supportsTablet: true,
      bundleIdentifier: configs.app.bundle,
      buildNumber: "10",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: configs.app.backgroundColor,
      },
      edgeToEdgeEnabled: true,
      package: configs.app.bundle,
      versionCode: 17,
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
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "cover",
          backgroundColor: configs.app.backgroundColor,
        },
      ],
      ["./plugins/withDisableForcedDarkModeAndroid.js", {}],
    ],
    experiments: {
      typedRoutes: true,
    },
    githubUrl: "https://github.com/ontech7/fastmemo-app-new-arch",
  },
};
