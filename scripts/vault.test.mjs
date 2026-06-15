// Standalone correctness test for the vault crypto core.
// Run: node scripts/vault.test.mjs
// It bundles src/utils/vault.ts (incl. react-native-crypto-js) with esbuild, then exercises every flow.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "vault.bundle.mjs");
const cryptOut = join(os.tmpdir(), "crypt.bundle.mjs");

// native-only modules; stub them so the bundles load under node
const alias = {
  "@": src,
  "expo-crypto": join(__dirname, "_expo-crypto-stub.js"),
  "expo-secure-store": join(__dirname, "_expo-secure-store-stub.js"),
};

await build({
  entryPoints: [join(src, "utils", "vault.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias,
});

await build({
  entryPoints: [join(src, "utils", "crypt.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: cryptOut,
  logLevel: "error",
  alias,
});

const V = await import(pathToFileURL(out).href);
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
const { vault, dek, recoveryKey } = V.createVault("correct horse battery staple");
ok("createVault returns a 64-hex DEK", /^[0-9a-f]{64}$/.test(dek));
ok("recovery key is grouped Base32", /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})+$/.test(recoveryKey));
ok("vault has version 2", vault.version === 2);
const unlocked = V.unlockVaultWithPassphrase(vault, "correct horse battery staple");
ok("correct passphrase returns the SAME dek", unlocked === dek);

console.log("\n[2] Wrong passphrase is rejected (never a false unlock)");
ok("wrong passphrase -> null", V.unlockVaultWithPassphrase(vault, "wrong passphrase") === null);
ok("empty passphrase -> null", V.unlockVaultWithPassphrase(vault, "") === null);
// brute a bunch of near-misses; a correct passphrase must NEVER be wrongly rejected and wrong ones never accepted
let falseAccept = 0;
for (let i = 0; i < 200; i++) {
  if (V.unlockVaultWithPassphrase(vault, "correct horse battery staple" + i) !== null) falseAccept++;
}
ok("200 near-miss passphrases all rejected", falseAccept === 0);
let falseReject = 0;
for (let i = 0; i < 50; i++) {
  const v = V.createVault("p@ss" + i);
  if (V.unlockVaultWithPassphrase(v.vault, "p@ss" + i) !== v.dek) falseReject++;
}
ok("50 fresh vaults all unlock with their own passphrase", falseReject === 0);

console.log("\n[3] Recovery key recovers the DEK");
ok("correct recovery key returns the same dek", V.unlockVaultWithRecoveryKey(vault, recoveryKey) === dek);
ok(
  "recovery key is case/format-insensitive",
  V.unlockVaultWithRecoveryKey(vault, recoveryKey.toLowerCase().replace(/-/g, " ")) === dek
);
ok("wrong recovery key -> null", V.unlockVaultWithRecoveryKey(vault, "ABCD-EFGH-JKMN-PQRS-TVWX-YZ23") === null);

console.log("\n[4] Change passphrase: DEK unchanged, old passphrase dies, new works");
const rewrapped = V.rewrapWithNewPassphrase(vault, dek, "my new passphrase");
ok(
  "old passphrase no longer unlocks the re-wrapped vault",
  V.unlockVaultWithPassphrase(rewrapped, "correct horse battery staple") === null
);
ok("new passphrase unlocks and returns the SAME dek", V.unlockVaultWithPassphrase(rewrapped, "my new passphrase") === dek);
ok("recovery key STILL works after passphrase change", V.unlockVaultWithRecoveryKey(rewrapped, recoveryKey) === dek);
ok(
  "a device that cached the dek is unaffected (dek identical)",
  V.unlockVaultWithPassphrase(rewrapped, "my new passphrase") === dek
);

console.log("\n[5] Recover then re-wrap recovery key");
const recoveredDek = V.unlockVaultWithRecoveryKey(vault, recoveryKey);
const newPassVault = V.rewrapWithNewPassphrase(vault, recoveredDek, "post-recovery pass");
const { vault: rotatedRecVault, recoveryKey: newRecoveryKey } = V.rewrapRecovery(newPassVault, recoveredDek);
ok("post-recovery passphrase unlocks", V.unlockVaultWithPassphrase(rotatedRecVault, "post-recovery pass") === dek);
ok("new recovery key works", V.unlockVaultWithRecoveryKey(rotatedRecVault, newRecoveryKey) === dek);
ok("old recovery key no longer works", V.unlockVaultWithRecoveryKey(rotatedRecVault, recoveryKey) === null);

console.log("\n[6] Cross-device interop: vault doc serialized through JSON (Firestore) round-trips");
const wire = JSON.parse(JSON.stringify(vault));
ok("vault survives JSON round-trip", V.unlockVaultWithPassphrase(wire, "correct horse battery staple") === dek);
ok("isVaultDoc recognizes a real vault", V.isVaultDoc(wire) === true);
ok("isVaultDoc rejects junk", V.isVaultDoc({ foo: 1 }) === false);

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
