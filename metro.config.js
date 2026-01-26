const path = require("path");
const { resolve } = require("metro-resolver");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

const resolver = config.resolver || {};
const defaultResolveRequest = resolver.resolveRequest;

config.resolver = {
  ...resolver,
  assetExts: Array.from(new Set([...(resolver.assetExts || []), "html"])),
  extraNodeModules: {
    ...(resolver.extraNodeModules || {}),
    "react-native-webview": path.resolve(__dirname, "node_modules/react-native-web-webview"),
  },
  resolveRequest(context, moduleName, platform) {
    if (platform === "web" && moduleName === "react-native-webview") {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "node_modules/react-native-web-webview/dist/index.js"),
      };
    }

    if (typeof defaultResolveRequest === "function") {
      return defaultResolveRequest(context, moduleName, platform);
    }

    return resolve(context, moduleName, platform);
  },
};

module.exports = config;
