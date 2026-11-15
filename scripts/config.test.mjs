// app.config.ts's code mods (the inline plugins that edit MainApplication, MainActivity and build.gradle): a template
// that no longer has the line a mod looks for fails the prebuild, never builds an app with half a change.
// Run: node scripts/config.test.mjs

import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// next to node_modules, so the packages it leaves outside resolve
const out = join(__dirname, "..", "node_modules", ".cache", "app-config.bundle.mjs");
await build({
  entryPoints: [join(__dirname, "..", "app.config.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: out,
  logLevel: "error",
});
const { replaceOrFail } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? `: ${detail}` : ""}`);
  }
};

console.log("\nthe code mods");
ok(
  "the line found: replaced",
  replaceOrFail("a\n  super.onCreate()\nb", /^([ \t]*)super\.onCreate\(\)\n/m, (line) => `${line}  x\n`, "warm-up") ===
    "a\n  super.onCreate()\n  x\nb"
);
let message = "";
try {
  replaceOrFail(
    "class MainApplication : Application() {\n",
    /^class MainApplication : Application\(\), ReactApplication \{\n/m,
    () => "",
    "WorkManager on demand"
  );
} catch (error) {
  message = String(error?.message);
}
ok(
  "the line missing (another template): the prebuild stops, naming the mod",
  message.includes("WorkManager on demand"),
  message
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
