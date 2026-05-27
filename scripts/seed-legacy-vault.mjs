// scripts/seed-legacy-vault.mjs
// Simula uno stato "vault v1 (legacy)" nel Firestore collegato:
//   - rimuove vault/config  -> probeVault() => presence "absent"
//   - scrive note cifrate con la chiave legacy, senza marker (formato pre-vault)
// Poi dal NUOVO build: Cloud Sync => "Attiva crittografia" (mode=migrate).
//
// Uso:  API_KEY=... PROJECT_ID=... APP_ID=... node scripts/seed-legacy-vault.mjs
//
// CHIAVE LEGACY: in produzione è SEMPRE stata "" — SECRET_KEY non ha il prefisso
// EXPO_PUBLIC_, quindi l'app la rimuove dal bundle e a runtime cifrava/decifrava
// con la stringa vuota. Per riprodurre la produzione FEDELMENTE lascia SECRET_KEY
// vuota/non impostata: lo script userà "" come faceva l'app reale (`configs.cloud.secretKey`).

import CryptoJS from "crypto-js"; // stesso formato OpenSSL di react-native-crypto-js
import "dotenv/config";
import { initializeApp } from "firebase/app";
import { deleteDoc, doc, getFirestore, setDoc } from "firebase/firestore";

const { API_KEY, PROJECT_ID, APP_ID } = process.env;
if (!API_KEY || !PROJECT_ID || !APP_ID) throw new Error("Mancano API_KEY/PROJECT_ID/APP_ID");

// Specchio esatto di configs.cloud.secretKey = process.env.SECRET_KEY || "".
// In produzione vale "" (vedi sopra): così le note seedate sono leggibili dalla
// migrazione esattamente come quelle reali.
const LEGACY_KEY = process.env.SECRET_KEY || "";

const db = getFirestore(initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID, appId: APP_ID }));
const enc = (s) => CryptoJS.AES.encrypt(s, LEGACY_KEY).toString(); // NB: nessun marker = legacy

const category = { order: 0, name: "All", icon: "none", index: true, selected: true };
const base = (id, title) => ({
  id,
  title,
  category,
  type: "text",
  date: "2024-01-01",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
});

const notes = [
  { ...base("legacy-1", "Nota legacy 1"), text: enc("contenuto vecchio cifrato con SECRET_KEY") },
  { ...base("legacy-2", "Nota legacy 2"), text: enc("seconda nota legacy") },
];

// 1) rimuovi il vault doc -> presence "absent"
await deleteDoc(doc(db, "vault", "config"));
// 2) scrivi le note legacy
for (const n of notes) await setDoc(doc(db, "notes", n.id), n);

console.log(`OK: vault/config rimosso, ${notes.length} note legacy scritte. Ora connetti dal nuovo build.`);
process.exit(0);
