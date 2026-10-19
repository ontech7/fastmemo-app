// Integration test of the Firestore adapter (src/libs/cloud/firebaseBackend.ts) against a real, disposable project.
// Run: set -a; . ./.env.secret; set +a; node scripts/sync-firestore.test.mjs
// Needs FIRESTORE_API_KEY / FIRESTORE_PROJECT_ID / FIRESTORE_APP_ID. It writes only test devices and notes with a
// random "synctest-" prefix, and deletes them at the end. Other devices connected to the project never get them in a
// queue (they're never recipients), but would see the notes in a full sync run while the test is running.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const { FIRESTORE_API_KEY, FIRESTORE_PROJECT_ID, FIRESTORE_APP_ID } = process.env;
if (!FIRESTORE_API_KEY || !FIRESTORE_PROJECT_ID || !FIRESTORE_APP_ID) {
  console.error("Missing FIRESTORE_API_KEY / FIRESTORE_PROJECT_ID / FIRESTORE_APP_ID");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
// Inside the project, so the external firebase imports resolve from node_modules.
const out = join(root, "node_modules", ".cache", "sync-firestore.bundle.mjs");

const STUBS = {
  "@/configs/default": `export const defaultCategory = { order: 0, name: "All", icon: "none", index: true, selected: true };`,
  "@/utils/vault": `export const VAULT_VERSION = 2; export const isVaultDoc = (v) => !!v && typeof v === "object";`,
};

await build({
  stdin: {
    contents: `export { FirebaseBackend } from "@/libs/cloud/firebaseBackend"; export { noteRev } from "@/libs/cloud/revision";`,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
  packages: "external",
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => (STUBS[args.path] ? { path: args.path, namespace: "stub" } : null));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
      },
    },
  ],
});

const { FirebaseBackend, noteRev } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tag = `synctest-${Math.random().toString(36).slice(2, 8)}`;
const A = `${tag}-A`;
const B = `${tag}-B`;
const id = (name) => `${tag}-${name}`;

const note = (name, rev, extra = {}) => ({
  id: id(name),
  type: "text",
  title: name,
  text: `sealed:${name}@${rev}`,
  category: { order: 0, name: "All", icon: "none", index: true, selected: true },
  date: "",
  createdAt: rev,
  updatedAt: rev,
  rev,
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
  ...extra,
});
const ops = (add = [], del = [], bases = {}) => ({
  notes: { add, delete: del, detach: [] },
  categories: { add: [], delete: [] },
  bases,
});

const backend = new FirebaseBackend();
backend.init({
  apiKey: FIRESTORE_API_KEY,
  projectId: FIRESTORE_PROJECT_ID,
  appId: FIRESTORE_APP_ID,
  authDomain: `${FIRESTORE_PROJECT_ID}.firebaseapp.com`,
  storageBucket: `${FIRESTORE_PROJECT_ID}.appspot.com`,
  messagingSenderId: FIRESTORE_APP_ID.split(":")[1] ?? "",
});

const created = new Set();
const unsubscribers = [];

try {
  console.log("\nconnection");
  ok("verify (write + delete round trip)", await backend.verify());
  const vault = await backend.readVault();
  ok("readVault answers from the server", vault.status !== "error", vault.status);

  console.log("\ndevices");
  ok("register A", await backend.registerDevice({ uuid: A, modelName: "test A", brand: "test" }));
  ok("register B", await backend.registerDevice({ uuid: B, modelName: "test B", brand: "test" }));
  const devices = await backend.listDevices();
  ok("both are listed", devices?.some((d) => d.uuid === A) && devices?.some((d) => d.uuid === B));

  // B listens, as the engine does.
  let latest = null;
  unsubscribers.push(
    backend.subscribeDevices(
      B,
      (snapshot) => {
        if (snapshot.fromServer) latest = snapshot;
      },
      (e) => console.error("listener error", e)
    )
  );
  const incomingFrom = async (source, predicate, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const change = latest?.incoming.find((c) => c.source === source);
      if (change && predicate(change)) return change;
      await sleep(200);
    }
    return null;
  };

  console.log("\npush + fan-out + ack");
  const r1 = Date.now();
  const n1 = note("n1", r1);
  created.add(n1.id);
  let result = await backend.push(A, ops([n1]), [B]);
  ok("push commits", result.complete && result.committed.notes.add.includes(n1.id), result);
  ok("the note is in the cloud", (await backend.fetchNote(n1.id))?.text === n1.text);

  let change = await incomingFrom(A, (c) => !!c.notes.add[n1.id]);
  ok("B's listener gets A's queued change", !!change);
  ok("...with the full note", change?.notes.add[n1.id]?.text === n1.text);

  // A queues more before B acks: B's ack must not commit (it would drop the new change).
  const n2 = note("n2", r1 + 1);
  created.add(n2.id);
  await backend.push(A, ops([n2]), [B]);
  ok("ack over changed queues is refused", (await backend.ackChanges(B, change)) === "changed");
  change = await incomingFrom(A, (c) => !!c.notes.add[n2.id]);
  ok("the newer queue reaches B (the older entry with it)", !!change?.notes.add[n1.id] && !!change?.notes.add[n2.id]);
  ok("ack of what was applied commits", (await backend.ackChanges(B, change)) === "acked");
  // A collection read "from the server" is answered by the open listener's view, which gets a transaction's write a
  // moment after it commits.
  const cleared = (d) => d?.devicesToSync.length === 0 && d?.pendingNotes === 0;
  let afterAck = null;
  for (let i = 0; i < 25 && !cleared(afterAck); i++) {
    if (i > 0) await sleep(200);
    afterAck = (await backend.listDevices())?.find((d) => d.uuid === A);
  }
  ok("A's queues are cleared once no recipient is left", cleared(afterAck), afterAck);

  console.log("\nguards");
  result = await backend.push(A, ops([note("n1", r1 - 10)], [], { [n1.id]: r1 - 10 }), []);
  ok(
    "an upload based on an older version is refused",
    result.superseded.some((n) => n.id === n1.id) && !result.committed.notes.add.includes(n1.id)
  );
  ok("...and the cloud keeps the newer one", (await backend.fetchNote(n1.id))?.rev === r1);
  result = await backend.push(A, ops([n1], [], { [n1.id]: r1 - 10 }), []);
  ok("re-pushing the version already there counts as committed", result.committed.notes.add.includes(n1.id));
  const n1b = note("n1", r1 + 5, { text: "newer" });
  result = await backend.push(A, ops([n1b], [], { [n1.id]: r1 }), []);
  ok("an upload based on the cloud's version goes through", result.committed.notes.add.includes(n1.id));
  result = await backend.push(A, ops([], [{ id: n1.id, rev: r1 + 1, deletedAt: r1 + 1 }]), []);
  ok(
    "a deletion older than the cloud version is refused",
    result.superseded.some((n) => n.id === n1.id)
  );
  result = await backend.push(A, ops([], [{ id: n1.id, rev: r1 + 9, deletedAt: r1 + 9 }]), []);
  ok("a newer deletion applies", result.committed.notes.delete.includes(n1.id) && (await backend.fetchNote(n1.id)) === null);

  console.log("\nundefined fields");
  const loose = note("loose", Date.now(), { local: undefined });
  created.add(loose.id);
  result = await backend.push(A, ops([loose]), []);
  ok("an undefined field is dropped, not a rejected write", result.committed.notes.add.includes(loose.id), result.rejected);

  console.log("\nsize limits");
  const big = note("big", Date.now(), { text: "x".repeat(650_000) });
  created.add(big.id);
  result = await backend.push(A, ops([big]), [B]);
  ok("a large note is committed", result.committed.notes.add.includes(big.id), result.rejected);
  change = await incomingFrom(A, (c) => !!c.notes.add[big.id]);
  ok(
    "...and queued as a reference, not in full",
    change?.notes.add[big.id]?.ref === true && change?.notes.add[big.id]?.rev === noteRev(big)
  );
  ok("the receiver can fetch it", (await backend.fetchNote(big.id))?.text.length === 650_000);
  await backend.ackChanges(B, change);

  const tooBig = note("toobig", Date.now(), { text: "y".repeat(1_100_000) });
  const small = note("small", Date.now());
  created.add(tooBig.id);
  created.add(small.id);
  result = await backend.push(A, ops([tooBig, small]), []);
  ok("a note over 1 MiB is rejected for good", result.rejected.includes(tooBig.id), result.rejected);
  ok("...without blocking the other one", result.committed.notes.add.includes(small.id) && result.complete);

  console.log("\npresence");
  ok("setPresence", await backend.setPresence(A, { noteId: small.id, at: Date.now() }));
  const start = Date.now();
  let seen = null;
  while (Date.now() - start < 10000 && !seen) {
    seen = latest?.devices.find((d) => d.uuid === A && d.presence?.noteId === small.id) ?? null;
    if (!seen) await sleep(200);
  }
  ok("others see it live", !!seen);

  console.log("\ncleanup");
  await backend.push(A, ops([n2, small]), [B]);
  ok("dropRecipient", await backend.dropRecipient(B));
  let afterDrop = null;
  for (let i = 0; i < 25 && !cleared(afterDrop); i++) {
    if (i > 0) await sleep(200);
    afterDrop = (await backend.listDevices())?.find((d) => d.uuid === A);
  }
  ok("...clears the queues that only waited for the removed device", cleared(afterDrop), afterDrop);
} finally {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  const far = Date.now() + 10 ** 9;
  const stubs = [...created].map((noteId) => ({ id: noteId, rev: far, deletedAt: far }));
  const cleanup = await backend.push(A, ops([], stubs), []);
  ok("test notes deleted", cleanup.committed.notes.delete.length === stubs.length, cleanup);
  ok("test devices removed", (await backend.unregisterDevice(A)) && (await backend.unregisterDevice(B)));
  await backend.dispose();
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
