// Checks of the note HTML sanitizing (LL-060) that run without a browser.
// Run: node scripts/sanitize.test.mjs
// The sanitizing itself needs a DOM: it was checked in headless Chrome and on Android (see LL-060). Here: the generated
// editor script is up to date with src/editor and the installed DOMPurify, it can go into the editor's HTML as it is, and
// the PDF export escapes the title.

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bundleSanitizer, moduleText, OUTPUT } from "./build-sanitize.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  }
};

console.log("\n=== The editor's sanitizer ===");
const bundle = await bundleSanitizer();
ok(`${OUTPUT} is up to date (run \`node scripts/build-sanitize.mjs\`)`, readFileSync(OUTPUT, "utf8") === moduleText(bundle));
ok(`it carries the installed DOMPurify (${bundle.version})`, bundle.js.includes(`DOMPurify ${bundle.version}`));
ok("it installs its hooks once", bundle.js.includes("__fmSanitize"));

console.log("\n=== PDF export ===");
const outfile = join(os.tmpdir(), "sanitize.html.bundle.mjs");
await build({
  entryPoints: [join(root, "src/utils/html.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "error",
  alias: { "@": join(root, "src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\/libs\/ai$/ }, () => ({ path: "ai", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export const stripHtml = (s) => s.replace(/<[^>]*>/g, '');",
          loader: "js",
        }));
      },
    },
  ],
});
const { wrapHtmlForPdf } = await import(pathToFileURL(outfile).href);
const pdf = wrapHtmlForPdf(`<img src=x onerror="alert(1)"> & "quotes"`, "<div>body</div>");
ok(
  "the title is text in <title> and in the heading",
  pdf.includes(`<title>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;quotes&quot;</title>`) &&
    pdf.includes(`<h1 class="note-title">&lt;img`) &&
    !pdf.includes("<img src=x"),
  pdf.slice(0, 200)
);
ok(
  "no title: the default one, no heading",
  wrapHtmlForPdf("", "x").includes("<title>Note</title>") && !wrapHtmlForPdf("", "x").includes('<h1 class="note-title">')
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
