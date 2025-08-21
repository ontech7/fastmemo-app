const configs = {
  environment: process.env.EXPO_PUBLIC_ENV || "DEV",

  apiUrl: process.env.EXPO_PUBLIC_API_URL || "",

  app: {
    name: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "Fast Memo" : "Fast Memo Test",
    slug: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "FastMemoApp" : "fastmemoapptest",
    bundle: process.env.EXPO_PUBLIC_ENV !== "DEV" ? "com.ontech7.FastMemoApp" : "com.ontech7.fastmemoapptest",
    version: "2.5.1",
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
