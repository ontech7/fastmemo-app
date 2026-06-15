// scripts/restore-firestore.mjs
// Riporta un progetto Firestore ESATTAMENTE allo stato del backup JSON
// (source of truth). Per ogni collection: cancella i documenti presenti, poi
// riscrive quelli del backup con gli stessi ID. Se il backup non contiene il
// doc `vault/config`, dopo il restore il vault risulta ASSENTE → probeVault()
// ritorna "absent" + needsMigration, cioè lo stato legacy pronto per la migrazione.
//
// Uso:
//   API_KEY=... PROJECT_ID=... APP_ID=... node scripts/restore-firestore.mjs
//   (opzionale) IN=scripts/fixtures/legacy-test-firestore.json
//
// ATTENZIONE: operazione DISTRUTTIVA sul Firestore indicato. Usala solo sul
// progetto di test.

import "dotenv/config";
import { initializeApp } from "firebase/app";
import { collection, deleteDoc, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { API_KEY, PROJECT_ID, APP_ID } = process.env;
if (!API_KEY || !PROJECT_ID || !APP_ID) throw new Error("Mancano API_KEY/PROJECT_ID/APP_ID");

const COLLECTIONS = ["notes", "categories", "vault", "connectedDevices", "handshake"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const inFile = process.env.IN ? join(process.cwd(), process.env.IN) : join(__dirname, "fixtures", "legacy-test-firestore.json");
const dump = JSON.parse(readFileSync(inFile, "utf8"));

if (dump._meta?.projectId && dump._meta.projectId !== PROJECT_ID) {
  console.warn(`ATTENZIONE: il backup è del progetto "${dump._meta.projectId}" ma stai ripristinando su "${PROJECT_ID}".`);
}

const db = getFirestore(initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID, appId: APP_ID }));

for (const name of COLLECTIONS) {
  // 1) cancella tutto ciò che c'è ora (incl. un eventuale vault/config creato da un test)
  const snap = await getDocs(collection(db, name));
  for (const d of snap.docs) await deleteDoc(doc(db, name, d.id));

  // 2) riscrive i documenti del backup
  const docs = dump[name] || {};
  const ids = Object.keys(docs);
  for (const id of ids) await setDoc(doc(db, name, id), docs[id]);

  console.log(`  ${name}: ripristinati ${ids.length} docs (cancellati ${snap.size})`);
}

console.log(`\nRestore completato da: ${inFile}`);
console.log(`Stato vault: ${Object.keys(dump.vault || {}).length === 0 ? "ASSENTE (legacy, pronto per la migrazione)" : "presente"}`);
process.exit(0);
