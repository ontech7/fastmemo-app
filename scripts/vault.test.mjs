// Standalone correctness test for the vault crypto core.
// Run: node scripts/vault.test.mjs
// It bundles src/utils/vault.ts (incl. react-native-crypto-js) with esbuild, then exercises every flow.
// The vault is bundled twice: with the WebCrypto PBKDF2 of modules/fastmemo-crypto (what web/Tauri run;
// Node has WebCrypto) and with no native module (the pure-JS fallback), and each must open the other's vaults.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "vault.bundle.mjs");
const jsOnlyOut = join(os.tmpdir(), "vault.jsonly.bundle.mjs");
const cryptOut = join(os.tmpdir(), "crypt.bundle.mjs");
const webKdfOut = join(os.tmpdir(), "fastmemo-crypto.web.bundle.mjs");
const webKdfSrc = join(__dirname, "..", "modules", "fastmemo-crypto", "src", "FastmemoCryptoModule.web.ts");

// native-only modules; stub them so the bundles load under node
const alias = {
  "@": src,
  "expo-crypto": join(__dirname, "_expo-crypto-stub.js"),
  "expo-secure-store": join(__dirname, "_expo-secure-store-stub.js"),
};

// resolves `~/modules/fastmemo-crypto` (the vault's PBKDF2) to the given implementation
const kdfModule = (target) => ({
  name: "fastmemo-crypto",
  setup(b) {
    b.onResolve({ filter: /^~\/modules\/fastmemo-crypto$/ }, () => ({ path: target }));
  },
});

for (const [outfile, kdf] of [
  [out, webKdfSrc],
  [jsOnlyOut, join(__dirname, "_fastmemo-crypto-stub.js")],
]) {
  await build({
    entryPoints: [join(src, "utils", "vault.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "error",
    alias,
    plugins: [kdfModule(kdf)],
  });
}

await build({
  entryPoints: [join(src, "utils", "crypt.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: cryptOut,
  logLevel: "error",
  alias,
});

// the WebCrypto PBKDF2 on its own, to compare it with crypto-js directly
await build({ entryPoints: [webKdfSrc], bundle: true, platform: "node", format: "esm", outfile: webKdfOut, logLevel: "error" });

const V = await import(pathToFileURL(out).href);
const VJs = await import(pathToFileURL(jsOnlyOut).href);
const Crypt = await import(pathToFileURL(cryptOut).href);

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
};

console.log("\n[1] Create vault + unlock with correct passphrase");
const { vault, dek, recoveryKey } = await V.createVault("correct horse battery staple");
ok("createVault returns a 64-hex DEK", /^[0-9a-f]{64}$/.test(dek));
ok("recovery key is grouped Base32", /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})+$/.test(recoveryKey));
ok("vault has version 2", vault.version === 2);
const unlocked = await V.unlockVaultWithPassphrase(vault, "correct horse battery staple");
ok("correct passphrase returns the SAME dek", unlocked === dek);

console.log("\n[2] Wrong passphrase is rejected (never a false unlock)");
ok("wrong passphrase -> null", (await V.unlockVaultWithPassphrase(vault, "wrong passphrase")) === null);
ok("empty passphrase -> null", (await V.unlockVaultWithPassphrase(vault, "")) === null);
// brute a bunch of near-misses; a correct passphrase must NEVER be wrongly rejected and wrong ones never accepted
let falseAccept = 0;
for (let i = 0; i < 200; i++) {
  if ((await V.unlockVaultWithPassphrase(vault, "correct horse battery staple" + i)) !== null) falseAccept++;
}
ok("200 near-miss passphrases all rejected", falseAccept === 0);
let falseReject = 0;
for (let i = 0; i < 50; i++) {
  const v = await V.createVault("p@ss" + i);
  if ((await V.unlockVaultWithPassphrase(v.vault, "p@ss" + i)) !== v.dek) falseReject++;
}
ok("50 fresh vaults all unlock with their own passphrase", falseReject === 0);

console.log("\n[3] Recovery key recovers the DEK");
ok("correct recovery key returns the same dek", (await V.unlockVaultWithRecoveryKey(vault, recoveryKey)) === dek);
ok(
  "recovery key is case/format-insensitive",
  (await V.unlockVaultWithRecoveryKey(vault, recoveryKey.toLowerCase().replace(/-/g, " "))) === dek
);
ok("wrong recovery key -> null", (await V.unlockVaultWithRecoveryKey(vault, "ABCD-EFGH-JKMN-PQRS-TVWX-YZ23")) === null);

console.log("\n[4] Change passphrase: DEK unchanged, old passphrase dies, new works");
const rewrapped = await V.rewrapWithNewPassphrase(vault, dek, "my new passphrase");
ok(
  "old passphrase no longer unlocks the re-wrapped vault",
  (await V.unlockVaultWithPassphrase(rewrapped, "correct horse battery staple")) === null
);
ok(
  "new passphrase unlocks and returns the SAME dek",
  (await V.unlockVaultWithPassphrase(rewrapped, "my new passphrase")) === dek
);
ok("recovery key STILL works after passphrase change", (await V.unlockVaultWithRecoveryKey(rewrapped, recoveryKey)) === dek);
ok(
  "a device that cached the dek is unaffected (dek identical)",
  (await V.unlockVaultWithPassphrase(rewrapped, "my new passphrase")) === dek
);

console.log("\n[5] Recover then re-wrap recovery key");
const recoveredDek = await V.unlockVaultWithRecoveryKey(vault, recoveryKey);
const newPassVault = await V.rewrapWithNewPassphrase(vault, recoveredDek, "post-recovery pass");
const { vault: rotatedRecVault, recoveryKey: newRecoveryKey } = await V.rewrapRecovery(newPassVault, recoveredDek);
ok("post-recovery passphrase unlocks", (await V.unlockVaultWithPassphrase(rotatedRecVault, "post-recovery pass")) === dek);
ok("new recovery key works", (await V.unlockVaultWithRecoveryKey(rotatedRecVault, newRecoveryKey)) === dek);
ok("old recovery key no longer works", (await V.unlockVaultWithRecoveryKey(rotatedRecVault, recoveryKey)) === null);

console.log("\n[6] Cross-device interop: vault doc serialized through JSON (Firestore) round-trips");
const wire = JSON.parse(JSON.stringify(vault));
ok("vault survives JSON round-trip", (await V.unlockVaultWithPassphrase(wire, "correct horse battery staple")) === dek);
ok("isVaultDoc recognizes a real vault", V.isVaultDoc(wire) === true);
ok("isVaultDoc rejects junk", V.isVaultDoc({ foo: 1 }) === false);

console.log("\n[6b] Native/WebCrypto and pure-JS PBKDF2 open each other's vaults");
for (const passphrase of ["correct horse battery staple", "pässwörd àèìòù ✓ 密码", ""]) {
  const fast = await V.createVault(passphrase);
  const slow = await VJs.createVault(passphrase);
  const label = JSON.stringify(passphrase);
  ok(
    `${label}: WebCrypto vault unlocks with pure JS`,
    (await VJs.unlockVaultWithPassphrase(fast.vault, passphrase)) === fast.dek
  );
  ok(
    `${label}: pure-JS vault unlocks with WebCrypto`,
    (await V.unlockVaultWithPassphrase(slow.vault, passphrase)) === slow.dek
  );
  ok(
    `${label}: recovery key works across implementations`,
    (await VJs.unlockVaultWithRecoveryKey(fast.vault, fast.recoveryKey)) === fast.dek &&
      (await V.unlockVaultWithRecoveryKey(slow.vault, slow.recoveryKey)) === slow.dek
  );
}
// 6b alone would also pass if the module silently fell back to crypto-js (its self-check failing): compare
// the module's own output, so a broken WebCrypto path can't ship as a quiet return of the 1-2s freeze.
const { default: WebKdf } = await import(pathToFileURL(webKdfOut).href);
const { default: CryptoJS6c } = await import("crypto-js"); // what vault.ts uses
const pbkdf2Js = (secret, saltHex, iterations) =>
  CryptoJS6c.PBKDF2(secret, CryptoJS6c.enc.Hex.parse(saltHex), {
    keySize: 32 / 4,
    iterations,
    hasher: CryptoJS6c.algo.SHA256,
  }).toString(CryptoJS6c.enc.Hex);
ok("the WebCrypto module is available under node", WebKdf !== null);
for (const [secret, saltHex, iterations] of [
  ["pässwörd ✓ 密码 🔑", "00112233445566778899aabbccddeeff", 1000],
  ["long passphrase ".repeat(5), "00112233445566778899AABBCCDDEEFF", 2],
  ["", "deadbeefdeadbeefdeadbeefdeadbeef", 1],
]) {
  ok(
    `WebCrypto PBKDF2 = crypto-js (${JSON.stringify(secret).slice(0, 24)}, ${iterations} it.)`,
    (await WebKdf.pbkdf2Sha256Async(secret, saltHex, iterations, 32)) === pbkdf2Js(secret, saltHex, iterations)
  );
}
const halfEmoji = "pass\ud83d";
let halfEmojiThrows = false;
try {
  await V.createVault(halfEmoji);
} catch {
  halfEmojiThrows = true;
}
ok("half an emoji fails on the native/WebCrypto build like in pure JS (no key only one path can derive)", halfEmojiThrows);

const rewrappedJs = await VJs.rewrapWithNewPassphrase(vault, dek, "cambiata in JS");
ok(
  "a passphrase changed in pure JS unlocks with WebCrypto",
  (await V.unlockVaultWithPassphrase(rewrappedJs, "cambiata in JS")) === dek
);

console.log("\n[7] Note payload encrypted with DEK on 'device A' decrypts on 'device B' holding same DEK");
import("react-native-crypto-js").then((m) => {
  const CryptoJS = m.default || m;
  const cipher = CryptoJS.AES.encrypt("segreto della nota", dek).toString();
  const plain = CryptoJS.AES.decrypt(cipher, dek).toString(CryptoJS.enc.Utf8);
  ok("note round-trips under the DEK", plain === "segreto della nota");
  // a wrong key either yields garbage or (commonly) throws "Malformed UTF-8" —
  // both mean "did not decrypt". CryptNote.decrypt must therefore guard this.
  let wrongPlain = "";
  try {
    wrongPlain = CryptoJS.AES.decrypt(cipher, V.generateDEK()).toString(CryptoJS.enc.Utf8);
  } catch {
    wrongPlain = "__threw__";
  }
  ok("note does NOT decrypt under a different DEK", wrongPlain !== "segreto della nota");

  console.log("\n[8] tryDecryptNote — migration safety");
  const key = V.generateDEK();
  const wrongKey = V.generateDEK();
  // build notes the real way (CryptNote.encrypt adds the auth marker)
  const textNote = Crypt.CryptNote.encrypt({ id: "n1", type: "text", text: "contenuto segreto" }, key);
  const todoNote = Crypt.CryptNote.encrypt({ id: "n2", type: "todo", list: [{ id: "a", text: "compito" }] }, key);

  // Right key reads the note (no false negative that would hide data)
  ok("right key -> decrypts text note", Crypt.tryDecryptNote(textNote, key)?.text === "contenuto segreto");
  ok("right key -> decrypts todo item", Crypt.tryDecryptNote(todoNote, key)?.list?.[0]?.text === "compito");

  // With the auth marker, a wrong/empty key is RELIABLY rejected (null) — so the
  // migration always skips (never overwrites) notes it didn't encrypt, and sync
  // never stores wrong-key garbage as plaintext.
  ok("wrong key -> null (reliably rejected)", Crypt.tryDecryptNote(textNote, wrongKey) === null);
  ok("empty key -> null (reliably rejected)", Crypt.tryDecryptNote(textNote, "") === null);
  ok("wrong key on todo -> null", Crypt.tryDecryptNote(todoNote, wrongKey) === null);

  // Statistical proof: across many random wrong keys, NONE is accepted.
  let accepted = 0;
  const realNote = Crypt.CryptNote.encrypt({ id: "x", type: "text", text: "hello world" }, key);
  for (let i = 0; i < 500; i++) {
    if (Crypt.tryDecryptNote(realNote, V.generateDEK()) !== null) accepted++;
  }
  ok("0/500 random wrong keys accepted by the marker", accepted === 0);

  // A LEGACY note (no marker) is correctly treated as "not ours" by strict decrypt,
  // but readable by the lenient CryptNote.decrypt with the legacy key.
  const legacyKey = V.generateDEK();
  const legacyNote = { id: "leg", type: "text", text: CryptoJS.AES.encrypt("vecchia nota", legacyKey).toString() };
  ok("strict rejects a legacy (pre-marker) note", Crypt.tryDecryptNote(legacyNote, legacyKey) === null);
  ok("lenient reads a legacy note with the legacy key", Crypt.CryptNote.decrypt(legacyNote, legacyKey).text === "vecchia nota");

  // Empty-body notes must round-trip to "" (not to ciphertext) — regression guard
  // for the decFieldLenient "|| value" bug and the marker on empty content.
  const emptyNew = Crypt.CryptNote.encrypt({ id: "e1", type: "text", text: "" }, key);
  ok("new empty-body note -> '' via strict", Crypt.tryDecryptNote(emptyNew, key)?.text === "");
  ok("new empty-body note -> '' via lenient", Crypt.CryptNote.decrypt(emptyNew, key).text === "");
  const legacyEmpty = { id: "le", type: "text", text: CryptoJS.AES.encrypt("", legacyKey).toString() };
  ok("legacy empty-body note reads as '' (not ciphertext)", Crypt.CryptNote.decrypt(legacyEmpty, legacyKey).text === "");

  console.log("\n[9] Production legacy reality: SECRET_KEY was never inlined (empty key)");
  // SECRET_KEY lacks the EXPO_PUBLIC_ prefix, so it was stripped from the client
  // bundle and every pre-vault note was AES-sealed with the EMPTY key "". The
  // migration must read these with "" and re-seal under the DEK — NOT skip them
  // on an "empty key" guard, which dropped every real legacy note (see LL-028).
  const emptyKeyLegacy = { id: "ek", type: "text", text: CryptoJS.AES.encrypt("nota prod legacy", "").toString() };
  ok(
    "legacy note sealed with empty key is readable via lenient('')",
    Crypt.CryptNote.decrypt(emptyKeyLegacy, "").text === "nota prod legacy"
  );
  ok("strict still rejects the empty-key legacy note (no marker)", Crypt.tryDecryptNote(emptyKeyLegacy, "") === null);
  // Simulate the migrateLegacyVault sweep: decrypt with legacy "" -> re-seal under the DEK.
  const reSealed = Crypt.CryptNote.encrypt(Crypt.CryptNote.decrypt(emptyKeyLegacy, ""), key);
  ok("migration re-seals it so the DEK can read it back", Crypt.tryDecryptNote(reSealed, key)?.text === "nota prod legacy");
  // Empty-body legacy note sealed with "" must also round-trip to "" (not ciphertext).
  const emptyKeyLegacyEmpty = { id: "eke", type: "text", text: CryptoJS.AES.encrypt("", "").toString() };
  ok("empty-body legacy note sealed with '' reads as ''", Crypt.CryptNote.decrypt(emptyKeyLegacyEmpty, "").text === "");

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
});
