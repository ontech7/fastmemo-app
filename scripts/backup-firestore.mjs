// scripts/backup-firestore.mjs
// Dump (read-only) di tutte le collection note di un progetto Firestore in un JSON,
// preservando gli ID dei documenti. Da usare come "source of truth" per ripetere i
// test di migrazione: prima di ogni test si riporta Firestore a questo stato con
// `restore-firestore.mjs`.
//
// Uso:
//   API_KEY=... PROJECT_ID=... APP_ID=... node scripts/backup-firestore.mjs
//   (opzionale) OUT=scripts/fixtures/legacy-test-firestore.json

import "dotenv/config";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { API_KEY, PROJECT_ID, APP_ID } = process.env;
if (!API_KEY || !PROJECT_ID || !APP_ID) throw new Error("Mancano API_KEY/PROJECT_ID/APP_ID");

// Le collection usate dall'app (src/libs/firebase.ts COLLECTIONS). Il client SDK non
// può elencare le collection, quindi le enumeriamo esplicitamente.
const COLLECTIONS = ["notes", "categories", "vault", "connectedDevices", "handshake"];

const db = getFirestore(initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID, appId: APP_ID }));

const dump = { _meta: { projectId: PROJECT_ID, exportedAt: new Date().toISOString() } };

for (const name of COLLECTIONS) {
  const snap = await getDocs(collection(db, name));
  const docs = {};
  snap.forEach((d) => {
    docs[d.id] = d.data();
  });
  dump[name] = docs;
  console.log(`  ${name}: ${snap.size} docs`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = process.env.OUT ? join(process.cwd(), process.env.OUT) : join(__dirname, "fixtures", "legacy-test-firestore.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(dump, null, 2) + "\n");

console.log(`\nBackup scritto in: ${outFile}`);
process.exit(0);
