// scripts/verify-legacy-migration.mjs
// Prova OFFLINE che il fix di migrazione legacy funziona sui DATI REALI del backup,
// usando il vero codice di src/utils/crypt.ts (bundlato con esbuild, come vault.test.mjs).
//
// Per ogni nota del backup simula esattamente la sweep di migrateLegacyVault:
//   1) plain = CryptNote.decrypt(note, "")     // legge la legacy con la chiave vuota
//   2) sealed = CryptNote.encrypt(plain, dek)   // ri-cifra sotto il nuovo DEK (con marker)
//   3) back  = tryDecryptNote(sealed, dek)      // ciò che il device rileggerà dopo il sync
// e verifica che `back` non sia null e che il contenuto coincida con la decifratura
// legacy diretta. Nessuna scrittura su Firestore.
//
// Uso:  node scripts/verify-legacy-migration.mjs   (opzionale IN=...)

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const alias = {
  "@": src,
  "expo-crypto": join(__dirname, "_expo-crypto-stub.js"),
  "expo-secure-store": join(__dirname, "_expo-secure-store-stub.js"),
};

const vaultOut = join(os.tmpdir(), "vault.verify.mjs");
const cryptOut = join(os.tmpdir(), "crypt.verify.mjs");
await build({ entryPoints: [join(src, "utils", "vault.ts")], bundle: true, platform: "node", format: "esm", outfile: vaultOut, logLevel: "error", alias });
await build({ entryPoints: [join(src, "utils", "crypt.ts")], bundle: true, platform: "node", format: "esm", outfile: cryptOut, logLevel: "error", alias });

const V = await import(pathToFileURL(vaultOut).href);
const Crypt = await import(pathToFileURL(cryptOut).href);

const inFile = process.env.IN ? join(process.cwd(), process.env.IN) : join(__dirname, "fixtures", "legacy-test-firestore.json");
const dump = JSON.parse(readFileSync(inFile, "utf8"));
const notes = Object.entries(dump.notes || {});

// Firma del contenuto cifrabile di una nota, per confrontare prima/dopo.
const contentSig = (n) => {
  const t = n.type || "text";
  if (t === "text") return JSON.stringify(n.text ?? "");
  if (t === "todo") return JSON.stringify((n.list || []).map((i) => i.text));
  if (t === "kanban") return JSON.stringify((n.columns || []).map((c) => (c.items || []).map((i) => i.text)));
  if (t === "code") return JSON.stringify((n.tabs || []).map((tab) => [tab.code, tab.title]));
  return "";
};

const dek = V.generateDEK();
let ok = 0;
let fail = 0;
const failures = [];

for (const [id, raw] of notes) {
  const note = { ...raw, type: raw.type || "text" };

  const plain = Crypt.CryptNote.decrypt(note, ""); // step 1: legacy read con ""
  const sealed = Crypt.CryptNote.encrypt(plain, dek); // step 2: re-seal sotto il DEK
  const back = Crypt.tryDecryptNote(sealed, dek); // step 3: rilettura device

  if (back && contentSig(back) === contentSig(plain)) {
    ok++;
  } else {
    fail++;
    failures.push({ id, type: note.type, reason: back ? "contenuto diverso dopo round-trip" : "tryDecryptNote = null" });
  }
}

console.log(`\nMigrazione simulata su ${notes.length} note reali (DEK casuale):`);
console.log(`  ✓ recuperate correttamente: ${ok}`);
console.log(`  ✗ fallite: ${fail}`);
if (failures.length) console.log("  dettaglio:", JSON.stringify(failures.slice(0, 10), null, 2));

console.log(failures.length === 0 ? "\nOK — tutte le note legacy reali migrano e si rileggono sotto il DEK.\n" : "\nKO — alcune note non migrano.\n");
process.exit(fail === 0 ? 0 : 1);
