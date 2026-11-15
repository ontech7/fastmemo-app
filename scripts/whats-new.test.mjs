// The news of a new version (libs/whatsNew) and the changelog's lines (utils/changelog): when the home's message shows,
// when the sidebar's icon stays, what a failed read does, and which part of a line is read first.
// Run: node scripts/whats-new.test.mjs
// It bundles the modules with esbuild; AsyncStorage is the in-memory stub.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "whats-new.bundle.mjs");

await build({
  stdin: {
    contents: `
      export * from "@/libs/whatsNew";
      export { changelogLines } from "@/utils/changelog";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: {
    "@": src,
    "@react-native-async-storage/async-storage": join(__dirname, "_async-storage-stub.js"),
  },
});

const M = await import(pathToFileURL(out).href);
const { default: storage } = await import(pathToFileURL(join(__dirname, "_async-storage-stub.js")).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
};

console.log("\nwhat the home shows after a launch");
ok("an update shows the message", M.whatsNewPhase("4.0.0", null, "4.1.0") === "message");
ok("nothing written yet (an old install) shows the message", M.whatsNewPhase(null, null, "4.1.0") === "message");
ok("the same version, changelog not opened: the icon", M.whatsNewPhase("4.1.0", "4.1.0", "4.1.0") === "icon");
ok("the same version, changelog opened: nothing", M.whatsNewPhase("4.1.0", null, "4.1.0") === "none");
ok("an older version still pending doesn't count", M.whatsNewPhase("4.1.0", "4.0.0", "4.1.0") === "none");

console.log("\nthe whole way, on this device (each launch a fresh copy of the module)");
let launches = 0;
const launch = () => import(`${pathToFileURL(out).href}?launch=${++launches}`);
storage.__reset();
await storage.setItem("@appVersion", "4.0.0");
let app = await launch();
await app.checkWhatsNew("4.1.0");
ok("after the update: the message", app.getWhatsNewPhase() === "message");
ok("the message shows once: the version is written at once", storage.get("@appVersion") === "4.1.0");
ok("and the changelog is pending", storage.get("@whatsNewPending") === "4.1.0");
await app.checkWhatsNew("4.1.0");
ok("the home mounting again in the same launch keeps the message", app.getWhatsNewPhase() === "message");
app.landWhatsNew(true);
ok("the message flew: the icon, landing", app.getWhatsNewPhase() === "icon" && app.whatsNewLanded() === true);
app.landWhatsNew(true);
ok("landing twice changes nothing", app.getWhatsNewPhase() === "icon");
app = await launch();
await app.checkWhatsNew("4.1.0");
ok("next launch, not opened: the icon, not landing", app.getWhatsNewPhase() === "icon" && app.whatsNewLanded() === false);
app.seenWhatsNew();
await new Promise((r) => setTimeout(r, 0));
ok("opened: nothing", app.getWhatsNewPhase() === "none");
ok("and nothing pending", storage.get("@whatsNewPending") === undefined);
app = await launch();
await app.checkWhatsNew("4.1.0");
ok("next launch after opening: nothing", app.getWhatsNewPhase() === "none");

console.log("\na new install, a failed read");
storage.__reset();
await storage.setItem("@appVersion", "4.1.0");
app = await launch();
await app.checkWhatsNew("4.1.0");
ok("a new install (its secret code wrote the version): nothing", app.getWhatsNewPhase() === "none");
storage.__reset();
await storage.setItem("@appVersion", "4.0.0");
const before = storage.writes;
storage.__failReads(true);
app = await launch();
await app.checkWhatsNew("4.1.0");
storage.__failReads(false);
ok("a failed read shows nothing", app.getWhatsNewPhase() === "none");
ok("and writes nothing (LL-039)", storage.writes === before && storage.get("@appVersion") === "4.0.0");
app = await launch();
await app.checkWhatsNew("4.1.0");
ok("the next launch announces it", app.getWhatsNewPhase() === "message");
app.landWhatsNew(false);
ok("left behind without flying: the icon, not landing", app.getWhatsNewPhase() === "icon" && app.whatsNewLanded() === false);

console.log("\na changelog's lines");
const lines = M.changelogLines(
  [
    "• Ricerca unica: trova le parole dentro tutte le note.",
    "",
    "• Recherche unique : trouve les mots.",
    "• 検索：すべてのノートから探します。",
    "• Sincronizzazione alle 10:30 ogni giorno.",
    "• Apri https://fastmemo.losav.cc dal menu.",
    "• Fix varie.",
    "Una riga senza punto.",
    "• Una frase lunghissima che va avanti ben oltre il limite di una semplice intestazione corta: il resto.",
  ].join("\n")
);
ok("empty lines go", lines.length === 8, lines.length);
ok(
  "the lead, with its colon",
  lines[0].lead === "Ricerca unica:" && lines[0].rest === " trova le parole dentro tutte le note.",
  lines[0]
);
ok("the bullet is the list's, not the text's", lines[0].bullet === true && !lines[0].rest.includes("•"));
ok("a French colon keeps its space", lines[1].lead === "Recherche unique :" && lines[1].rest === " trouve les mots.", lines[1]);
ok("a full-width colon", lines[2].lead === "検索：" && lines[2].rest === "すべてのノートから探します。", lines[2]);
ok("a time is not a lead", lines[3].lead === "" && lines[3].rest === "Sincronizzazione alle 10:30 ogni giorno.", lines[3]);
ok("a link is not a lead", lines[4].lead === "", lines[4]);
ok("a line without a colon", lines[5].lead === "" && lines[5].rest === "Fix varie.", lines[5]);
ok("a line without a bullet", lines[6].bullet === false && lines[6].rest === "Una riga senza punto.", lines[6]);
ok("a long phrase before the colon is no lead", lines[7].lead === "", lines[7]);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
