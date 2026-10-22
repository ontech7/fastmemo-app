// The user changelog of a version, in English: changelog.mobile / changelog.web in the app's i18n source (en.ts). It's the
// one changelog: what users read in the app, on Play, in the desktop updater (latest.json) and in the GitHub release.
//
//   node scripts/changelog-notes.mjs mobile 4.0.0   # changelog.mobile.description_4_0_0
//   node scripts/changelog-notes.mjs web 2.0.0      # changelog.web.description_2_0_0 (the desktop app)
//
// Prints the bullets; exits 1 when the entry is missing or empty, so a release never goes out without its notes.
import fs from "node:fs";

const [track, version] = process.argv.slice(2);
if (!["mobile", "web"].includes(track) || !/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node scripts/changelog-notes.mjs <mobile|web> <X.Y.Z>");
  process.exit(2);
}

const source = fs.readFileSync(new URL("../src/libs/i18n/locales/en.ts", import.meta.url), "utf8");
const changelog = source.slice(source.indexOf("\n  changelog: {"));
const web = changelog.indexOf("\n    web: {");
const mobile = changelog.indexOf("\n    mobile: {");
const block = track === "web" ? changelog.slice(web, mobile) : changelog.slice(mobile);

const key = `description_${version.replaceAll(".", "_")}`;
const notes = block.match(new RegExp(`\\b${key}:\\s*\`([^\`]*)\``))?.[1].trim();
if (!notes) {
  console.error(`No changelog.${track}.${key} in src/libs/i18n/locales/en.ts`);
  process.exit(1);
}
console.log(notes);
