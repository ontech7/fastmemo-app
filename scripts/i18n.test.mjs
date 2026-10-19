// Locale parity check: every locale must define exactly the keys of en.ts.
// Run: node scripts/i18n.test.mjs
// A key missing from a locale doesn't fail at runtime, i18next silently falls back to English (the whole vault UI once
// shipped untranslated in 5 locales that way), so this is the only thing that catches it.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const locales = join(__dirname, "..", "src", "libs", "i18n", "locales");
const LANGS = ["en", "it", "es", "fr", "de", "zh", "ja"];

const load = async (lang) => {
  const outfile = join(os.tmpdir(), `i18n.${lang}.bundle.mjs`);
  await build({ entryPoints: [join(locales, `${lang}.ts`)], bundle: true, format: "esm", platform: "node", outfile });
  return (await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)).default;
};

// "section.key" paths of every string leaf
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const reference = new Set(flatten(await load("en")));
let failed = 0;

for (const lang of LANGS.slice(1)) {
  const keys = new Set(flatten(await load(lang)));
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) failed++;
  console.log(`${missing.length || extra.length ? "FAIL" : "ok  "} ${lang}: ${keys.size} keys`);
  for (const k of missing) console.log(`       missing ${k}`);
  for (const k of extra) console.log(`       extra   ${k}`);
}

console.log(`\n=== ${LANGS.length - 1 - failed} passed, ${failed} failed (${reference.size} keys in en) ===\n`);
process.exit(failed === 0 ? 0 : 1);
