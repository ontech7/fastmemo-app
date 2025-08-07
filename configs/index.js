const configs = {
  environment: process.env.EXPO_PUBLIC_ENV || "DEV",

  app: {
    name: "Fast Memo",
    slug: "FastMemoApp",
    bundle: "com.ontech7.FastMemoApp",
    version: "2.3.0",
    backgroundColor: "#020e35",

    websiteUrl: "https://fastmemo.vercel.app",
    playStoreUrl:
      "http://play.google.com/store/apps/details?id=com.ontech7.FastMemoApp",
    appStoreUrl:
      "https://apps.apple.com/it/app/fast-memo-note-in-un-click/id6450381916",
  },

  notes: {
    daysToDelete: 30,
    sizeLimit: 1 * 1024 * 1024, // 1 MB
  },

  cloud: {
    deviceLimit: 3,
    secretKey: process.env.EXPO_PUBLIC_SECRET_KEY || "",
  },

  sentry: {
    dns: process.env.SENTRY_DSN || "",
  },

  firebase: {
    appName: "fastmemo",
  },
};

module.exports = { configs };
