// The GitHub APK (eas.json `production-apk`, ADR-031) links its updater; the Play build doesn't, so its native code and
// fingerprint stay the same. FASTMEMO_DISTRIBUTION is also set when the Publish OTA workflow publishes for the APK: the
// update's runtime must be the APK's fingerprint.
module.exports = {
  dependencies:
    process.env.FASTMEMO_DISTRIBUTION === "github"
      ? { "fastmemo-installer": { root: "./modules-apk/fastmemo-installer" } }
      : {},
};
