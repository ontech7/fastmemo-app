const configs = {
  environment: process.env.EXPO_PUBLIC_ENV || "DEV",

  apiUrl: process.env.EXPO_PUBLIC_API_URL || "",

  app: {
    version: {
      mobile: "2.7.0",
      web: "0.1.0-beta",
    },
    name: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "Fast Memo" : "Fast Memo Test",
    slug: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "FastMemoApp" : "fastmemoapptest",
    bundle: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "com.ontech7.FastMemoApp" : "com.ontech7.fastmemoapptest",
    icon: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "./src/assets/images/icon.png" : "./src/assets/images/test/icon.png",
    adaptiveIcon:
      process.env.EXPO_PUBLIC_ENV !== "DEV"
        ? "./src/assets/images/adaptive-icon.png"
        : "./src/assets/images/test/adaptive-icon.png",
    favicon: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "./src/assets/images/favicon.png" : "./src/assets/images/test/favicon.png",
    backgroundColor: "#020e35",

    websiteUrl: "https://fastmemo.vercel.app",
    playStoreUrl: "http://play.google.com/store/apps/details?id=com.ontech7.FastMemoApp",
    appStoreUrl: "https://apps.apple.com/it/app/fast-memo-note-in-un-click/id6450381916",
  },

  notes: {
    daysToDelete: 30,
    sizeLimit: 1 * 1024 * 1024, // 1 MB
  },

  cloud: {
    deviceLimit: 3,
    secretKey: process.env.SECRET_KEY || "",
  },

  sentry: {
    dns: process.env.SENTRY_DSN || "",
  },

  firebase: {
    appName: "fastmemo",
  },
};

module.exports = { configs };
