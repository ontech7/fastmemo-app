// Integration test of the self-hosted server adapter (src/libs/cloud/serverBackend.ts) and of the sync engine on it,
// against a real fastmemo-server (the sibling repo, or FASTMEMO_SERVER_DIR) started on a free port over a temp database.
// Run: node scripts/sync-server.test.mjs
// It bundles the adapter, the engine and the real notes/categories slices with esbuild (native-only imports stubbed).

import { build } from "esbuild";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");
const serverDir = process.env.FASTMEMO_SERVER_DIR ?? join(root, "..", "fastmemo-server");
const out = join(os.tmpdir(), "sync-server.bundle.mjs");

if (!fs.existsSync(join(serverDir, "src", "main.ts"))) {
  console.error(`fastmemo-server not found at ${serverDir} (set FASTMEMO_SERVER_DIR)`);
  process.exit(1);
}

const STUBS = {
  "@/libs/cloud": `export const only_if_cloudConnected = (cb) => cb(); export const isCloudConnected = () => true; export const cloud = null;`,
  // The app's note store, which the wipe thunk uses (ADR-018).
  "@/libs/storage/notes": `export const noteStore = null; export const notesNeedSorting = () => false;`,
  "@/libs/vaultSession": `export const isVaultUnlocked = () => true; export const getDEK = () => "k1";`,
  "@/utils/crypt": `export const CryptNote = { encrypt: (note) => ({ ...note, sealed: "outbox" }) };`,
  "@/configs/default": `export const defaultCategory = { order: 0, name: "All", icon: "none", index: true, selected: true };`,
  "@/constants/icons": `export const CATEGORY_MAP = {};`,
  "@/libs/secureStore": `export const secureStoreGet = async () => null; export const secureStoreSet = async () => {}; export const secureStoreRemove = async () => {};`,
  "@/utils/vault": `export const VAULT_VERSION = 2; export const isVaultDoc = (v) => !!v && typeof v === "object";`,
};

await build({
  stdin: {
    contents: `
      export { configureStore } from "@reduxjs/toolkit";
      export * as notes from "@/slicers/notesSlice";
      export { default as notesReducer } from "@/slicers/notesSlice";
      export * as categories from "@/slicers/categoriesSlice";
      export { default as categoriesReducer } from "@/slicers/categoriesSlice";
      export { noteRev } from "@/libs/cloud/revision";
      export { SyncEngine } from "@/libs/cloud/syncEngine";
      export { ServerBackend } from "@/libs/cloud/serverBackend";
      export { CloudRouter } from "@/libs/cloud/router";
      export { cloudScope, isLoopbackUrl, isPlainHttp, normalizeServerUrl } from "@/libs/cloud/scope";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) =>
          STUBS[args.path] !== undefined ? { path: args.path, namespace: "stub" } : null
        );
        b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
      },
    },
  ],
  define: { "process.env.EXPO_PUBLIC_ENV": '"TEST"', "process.env.EXPO_PUBLIC_API_URL": '""' },
});

const M = await import(pathToFileURL(out).href);
const { notes: N, categories: C } = M;

// The adapter logs every failure with console.log (as in the app): quiet here, the assertions tell.
const log = console.log.bind(console);
console.log = (...args) => {
  if (typeof args[0] === "string" && /^(\s+[✓✗]|\n|===)/.test(args[0])) log(...args);
};

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits until `cond()` holds (true), or `ms` passed (false). */
const until = async (cond, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await sleep(40);
  }
  return !!(await cond());
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Addresses                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\n=== Addresses ===");
ok(
  "a bare IP or .local name gets http, a domain https",
  M.normalizeServerUrl("192.168.1.5:8080/") === "http://192.168.1.5:8080" &&
    M.normalizeServerUrl("nas.local") === "http://nas.local" &&
    M.normalizeServerUrl(" notes.example.com ") === "https://notes.example.com"
);
ok(
  "plain http is told apart",
  M.isPlainHttp("192.168.1.5:8080") &&
    M.isPlainHttp("HTTP://notes.example.com") &&
    !M.isPlainHttp("notes.example.com") &&
    !M.isPlainHttp("https://10.0.0.2")
);
ok(
  "this machine is loopback, a LAN or public address isn't",
  ["localhost:8080", "http://127.0.0.1:8080", "http://127.1.2.3", "http://[::1]:8080/x", "http://dev.localhost"].every(
    M.isLoopbackUrl
  ) &&
    ![
      "192.168.1.5:8080",
      "http://localhost.example.com",
      "http://notes.example.com",
      "http://127.0.0.1.nip.io",
      "http://10.0.0.2",
    ].some(M.isLoopbackUrl)
);

/* ------------------------------------------------------------------------------------------------------------------ */
/* The server                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

const KEY = "integration-access-key-0123456789";
const ADMIN = "integration-admin-key-0123456789";

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Starts fastmemo-server; `dataDir` and `port` to restart one over the same data. */
const startServer = async ({ dataDir = fs.mkdtempSync(join(os.tmpdir(), "fastmemo-it-")), port, env = {} } = {}) => {
  port ??= await freePort();
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", join(serverDir, "src", "main.ts")], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_DIR: dataDir,
      DATABASE_URL: "",
      FASTMEMO_ACCESS_KEY: KEY,
      FASTMEMO_ADMIN_KEY: ADMIN,
      LOG_LEVEL: "info",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stderr.on("data", (d) => (output += d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server didn't start:\n${output}`)), 15000);
    child.stdout.on("data", (d) => {
      output += d;
      if (output.includes("fastmemo-server started")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error(`server exited (${code}):\n${output}`)));
  });
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    port,
    dataDir,
    admin: async (method, path) => {
      const res = await fetch(url + path, { method, headers: { Authorization: `Bearer ${ADMIN}` } });
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill("SIGTERM");
      }),
  };
};

const settingsFor = (url, key = KEY) => ({
  provider: "server",
  serverUrl: url,
  serverKey: key,
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
});

/** An adapter with its own network switch and token storage (each device has its own secure storage). */
const makeBackend = (url, key = KEY) => {
  const net = { online: true, requests: 0 };
  const tokens = new Map();
  const backend = new M.ServerBackend({
    fetch: (input, init) => {
      net.requests++;
      return net.online ? fetch(input, init) : Promise.reject(new TypeError("Network request failed"));
    },
    storage: {
      get: async (k) => tokens.get(k) ?? null,
      set: async (k, v) => void tokens.set(k, v),
      remove: async (k) => void tokens.delete(k),
    },
  });
  backend.init(settingsFor(url, key));
  return { backend, net, tokens };
};

const note = (id, rev, extra = {}) => ({
  id,
  type: "text",
  title: id,
  text: `sealed:${id}@${rev}`,
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
const ops = (add = [], del = [], bases = {}, detach = []) => ({
  notes: { add, delete: del, detach },
  categories: { add: [], delete: [] },
  bases,
});

const cleanups = [];
const servers = [];
const newServer = async (options) => {
  const server = await startServer(options);
  servers.push(server);
  return server;
};

try {
  /* ---------------------------------------------------------------------------------------------------------------- */
  /* The adapter on its own                                                                                           */
  /* ---------------------------------------------------------------------------------------------------------------- */

  log("\nServerBackend: connecting");
  const server = await newServer();
  {
    const { backend } = makeBackend(server.url);
    ok("verify: the right key", await backend.verify());
    ok("...and the server's device limit is taken", backend.deviceLimit === 10);
    ok("verify: a wrong key fails", !(await makeBackend(server.url, "wrong-key-wrong-key-123").backend.verify()));
    const closed = makeBackend(`http://127.0.0.1:${await freePort()}`).backend;
    const started = Date.now();
    ok("verify: nothing listening fails, quickly", !(await closed.verify()) && Date.now() - started < 6000);

    const other = http.createServer((_, res) => res.end(JSON.stringify({ hello: "world" })));
    await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
    ok(
      "verify: something that isn't a fastmemo-server fails",
      !(await makeBackend(`http://127.0.0.1:${other.address().port}`).backend.verify())
    );
    other.close();

    ok("before registering, the key reads the devices (the connect flow)", Array.isArray(await backend.listDevices()));
    ok("...and the vault", (await backend.readVault()).status === "absent");

    // After a restart the app doesn't handshake again: the device list carries the limit too.
    const limited = await newServer({ env: { MAX_DEVICES: "4" } });
    const restarted = makeBackend(limited.url).backend;
    await restarted.listDevices();
    ok("the device list brings the server's limit (no handshake after a restart)", restarted.deviceLimit === 4);
  }

  log("\nServerBackend: devices, feed, presence");
  {
    const a = makeBackend(server.url);
    const b = makeBackend(server.url);
    ok(
      "register",
      (await a.backend.registerDevice({ uuid: "A", modelName: "Mac", brand: "Apple" })) &&
        (await b.backend.registerDevice({ uuid: "B", modelName: "", brand: "" }))
    );
    ok("the token is kept in the device's storage", [...a.tokens.values()].length === 1);
    const devices = await a.backend.listDevices();
    ok(
      "both listed (empty model/brand default to web)",
      devices.length === 2 && devices.find((d) => d.uuid === "B").modelName === "web"
    );

    ok("vault created", (await a.backend.createVaultExclusive({ key: "k1", version: 2 })) === "created");
    ok("...only once", (await b.backend.createVaultExclusive({ key: "other" })) === "exists");
    ok("vault read", (await b.backend.readVault()).vault?.key === "k1");

    const snapshots = [];
    const vaultReads = [];
    const unsubscribe = b.backend.subscribeDevices(
      "B",
      (s) => snapshots.push(s),
      (e) => snapshots.push({ error: e })
    );
    const unsubscribeVault = b.backend.subscribeVault((read) => vaultReads.push(read));
    ok("a listener gets the current state at once", await until(() => snapshots.length > 0 && vaultReads.length > 0, 3000));
    ok(
      "...from the server, with this device in the list",
      snapshots[0].fromServer && snapshots[0].devices.some((d) => d.uuid === "B")
    );
    ok("...and the vault", vaultReads[0].status === "present" && vaultReads[0].vault.key === "k1");

    const pushed = await a.backend.push("A", ops([note("n1", 100), note("n2", 100)]), ["B"]);
    ok("push", pushed.complete && pushed.committed.notes.add.length === 2);
    ok(
      "the other device hears of it within a second (long poll)",
      await until(() => snapshots.at(-1)?.incoming?.[0]?.notes.add.n1, 1500)
    );
    const change = snapshots.at(-1).incoming[0];
    ok(
      "...as one change set from the feed",
      change.source === "server" && Object.keys(change.notes.add).sort().join() === "n1,n2"
    );
    ok("...named by its page and its last sequence number", /^.+\|\d+$/.test(change.token), change.token);
    ok("the pusher doesn't get its own change", (await a.backend.pullDevices("A")).incoming.length === 0);
    ok(
      "a device that has someone's changes pending is in its devicesToSync",
      snapshots
        .at(-1)
        .devices.find((d) => d.uuid === "A")
        .devicesToSync.includes("B")
    );

    const count = snapshots.length;
    ok("acknowledged", (await b.backend.ackChanges("B", change)) === "acked");
    ok(
      "...the feed is empty afterwards",
      await until(() => snapshots.length > count && snapshots.at(-1).incoming.length === 0, 3000)
    );

    const stale = await a.backend.push("A", ops([note("n1", 300)], [], { n1: 50 }), ["B"]);
    ok(
      "an upload based on an older version comes back superseded",
      stale.superseded.length === 1 && stale.superseded[0].rev === 100
    );

    await a.backend.setPresence("A", { noteId: "n1", at: 123 });
    ok(
      "presence reaches the other device",
      await until(() => snapshots.at(-1)?.devices.find((d) => d.uuid === "A")?.presence?.noteId === "n1", 2000)
    );

    await server.admin("POST", "/admin/api/devices/B/full-sync");
    ok(
      "a full sync asked from the dashboard shows up",
      await until(() => typeof snapshots.at(-1)?.devices.find((d) => d.uuid === "B")?.fullSyncDue === "number", 2000)
    );
    const due = snapshots.at(-1).devices.find((d) => d.uuid === "B").fullSyncDue;
    await b.backend.clearFullSyncDue("B", due);
    ok("...and clears", await until(() => snapshots.at(-1)?.devices.find((d) => d.uuid === "B")?.fullSyncDue === null, 2000));

    await a.backend.writeVault({ key: "k2", version: 2 });
    ok("a replaced vault reaches the vault listener", await until(() => vaultReads.at(-1)?.vault?.key === "k2", 2000));

    // A new long poll replaces the old one: it answers at once if it missed a change, or waits for the next one.
    await b.backend.reconnect();
    const before = snapshots.length;
    const reconnected = Date.now();
    await a.backend.push("A", ops([note("after-reconnect", 1)]), ["B"]);
    ok(
      "reconnect: the new long poll gets the next change at once",
      (await until(() => snapshots.length > before && snapshots.at(-1).incoming[0]?.notes.add["after-reconnect"], 2000)) &&
        Date.now() - reconnected < 2000
    );

    unsubscribe();
    unsubscribeVault();
    ok("unsubscribing stops the long poll", await until(() => true, 300));
  }

  log("\nServerBackend: data");
  {
    // Its own server: pruning depends on what every device registered has read.
    const dataServer = await newServer();
    const a = makeBackend(dataServer.url);
    await a.backend.registerDevice({ uuid: "A", modelName: "Mac", brand: "Apple" });
    const lagging = makeBackend(dataServer.url);
    await lagging.backend.registerDevice({ uuid: "L", modelName: "Pixel", brand: "Google" });
    await a.backend.push(
      "A",
      ops([note("n1", 1)], [{ id: "n2", type: "text", rev: 500, updatedAt: 500 }], {}, [
        { id: "d1", type: "text", rev: 10, updatedAt: 10 },
      ]),
      []
    );
    const tombstones = await a.backend.fetchTombstones();
    ok("tombstones: deleted and detached", tombstones.n2?.rev === 500 && tombstones.d1?.detach === true);
    ok(
      "pruning keeps a marker another device hasn't read yet (here it's that device's only news of the deletion)",
      (await a.backend.pruneTombstones(["n2", "d1"])) && Object.keys(await a.backend.fetchTombstones()).length === 2
    );
    await a.backend.unregisterDevice("L");
    ok(
      "...and drops it once every device has",
      (await a.backend.pruneTombstones(["n2", "d1"])) && Object.keys(await a.backend.fetchTombstones()).length === 0
    );
    ok("fetchNote: a missing note is null", (await a.backend.fetchNote("nope")) === null);
    ok("fetchNote: an existing one", (await a.backend.fetchNote("n1"))?.id === "n1");
    ok(
      "writeNotes, then fetchNotes",
      (await a.backend.writeNotes([note("w1", 1), note("w2", 1)])) &&
        (await a.backend.fetchNotes()).filter((n) => n.id === "w1" || n.id === "w2").length === 2
    );
    await a.backend.push(
      "A",
      {
        ...ops(),
        categories: {
          add: [
            { icon: "b", order: 2 },
            { icon: "a", order: 1 },
          ],
          delete: [],
        },
      },
      []
    );
    ok("categories, by order", (await a.backend.fetchCategories()).map((c) => c.icon).join() === "a,b");
    ok(
      "wipeCategories keeps only the default one",
      (await a.backend.wipeCategories()) && (await a.backend.fetchCategories()).map((c) => c.icon).join() === "none"
    );
    await a.backend.writeNotes(Array.from({ length: 1250 }, (_, i) => note(`many-${i}`, 1)));
    ok(
      "fetchNotes reads every page (the server pages by 500 notes / ~8 MB)",
      (await a.backend.fetchNotes()).filter((n) => n.id.startsWith("many-")).length === 1250
    );
    ok("wipeNotes", (await a.backend.wipeNotes()) && (await a.backend.fetchNotes()).length === 0);

    a.net.online = false;
    ok(
      "offline: reads say they failed (null / error / undefined), never empty",
      (await a.backend.fetchNotes()) === null &&
        (await a.backend.readVault()).status === "error" &&
        (await a.backend.fetchNote("x")) === undefined &&
        (await a.backend.listDevices()) === null
    );
    const offline = await a.backend.push("A", ops([note("o1", 1)]), []);
    ok("offline: a push is incomplete, nothing committed", !offline.complete && offline.committed.notes.add.length === 0);
    ok("offline: an ack is an error (retried)", (await a.backend.ackChanges("A", { token: "1" })) === "error");
    a.net.online = true;
  }

  log("\nServerBackend: removal, token, re-init");
  {
    const a = makeBackend(server.url);
    const b = makeBackend(server.url);
    await a.backend.registerDevice({ uuid: "A", modelName: "Mac", brand: "Apple" });
    await b.backend.registerDevice({ uuid: "B", modelName: "Pixel", brand: "Google" });
    const snapshots = [];
    b.backend.subscribeDevices(
      "B",
      (s) => snapshots.push(s),
      () => {}
    );
    await until(() => snapshots.length > 0, 2000);

    // The same device after a restart: a new adapter over the same storage finds its token.
    const restarted = new M.ServerBackend({
      storage: { get: async (k) => b.tokens.get(k) ?? null, set: async () => {}, remove: async () => {} },
    });
    restarted.init(settingsFor(server.url));
    ok(
      "after a restart the device uses its stored token",
      (await restarted.pullDevices("B"))?.devices.some((d) => d.uuid === "B")
    );

    await a.backend.unregisterDevice("B");
    ok(
      "removed elsewhere: the listener gets an empty device list (the engine disconnects)",
      await until(() => snapshots.at(-1)?.devices.length === 0, 3000)
    );
    ok("...and the token is forgotten", b.tokens.size === 0);
    ok("a pull says so too", (await restarted.pullDevices("B"))?.devices.length === 0);

    const errors = [];
    a.backend.subscribeDevices(
      "A",
      () => {},
      (e) => errors.push(e)
    );
    await a.backend.dispose();
    ok(
      "dispose tells the listeners (they subscribe again on the new connection)",
      errors.length === 1 && !a.backend.isActive()
    );
  }

  log("\nServerBackend: the token is only gone when the server refuses it");
  {
    // Storage that fails to read for a while (a locked keystore, a busy disk): not the same as "no token".
    const b = makeBackend(server.url);
    await b.backend.registerDevice({ uuid: "TB", modelName: "Pixel", brand: "Google" });
    let readable = false;
    const flaky = new M.ServerBackend({
      storage: {
        get: async (k) => {
          if (!readable) throw new Error("keystore locked");
          return b.tokens.get(k) ?? null;
        },
        set: async (k, v) => void b.tokens.set(k, v),
        remove: async (k) => void b.tokens.delete(k),
      },
    });
    flaky.init(settingsFor(server.url));
    const snapshots = [];
    flaky.subscribeDevices(
      "TB",
      (snapshot) => snapshots.push(snapshot),
      () => {}
    );
    await sleep(1500);
    ok("an unreadable token isn't taken for a removal", snapshots.length === 0 && b.tokens.size === 1);
    ok("...a pull is an error to retry, not an empty list", (await flaky.pullDevices("TB")) === null);
    readable = true;
    ok(
      "...and once it reads, the device syncs",
      await until(() => snapshots.at(-1)?.devices.some((d) => d.uuid === "TB"), 4000)
    );
    await flaky.dispose();

    // Registering again replaces the token: a request that still carried the old one is refused, which isn't a removal.
    const c = makeBackend(server.url);
    await c.backend.registerDevice({ uuid: "TC", modelName: "Mac", brand: "Apple" });
    const seen = [];
    c.backend.subscribeDevices(
      "TC",
      (snapshot) => seen.push(snapshot),
      () => {}
    );
    await until(() => seen.length > 0, 2000);
    const old = [...c.tokens.values()][0];
    const stale = new M.ServerBackend({
      storage: { get: async () => old, set: async () => {}, remove: async () => {} },
    });
    stale.init(settingsFor(server.url));
    ok("re-registered", await c.backend.registerDevice({ uuid: "TC", modelName: "Mac", brand: "Apple" }));
    const fresh = [...c.tokens.values()][0];
    ok("...with a new token", fresh !== old && c.tokens.size === 1);
    ok("the old token is refused", (await stale.pullDevices("TC"))?.devices.length === 0);
    await sleep(800);
    ok(
      "...but the device holding the new one isn't removed, nor its token forgotten",
      seen.every((snapshot) => snapshot.devices.length > 0) && c.tokens.get([...c.tokens.keys()][0]) === fresh
    );
    await c.backend.dispose();
    await stale.dispose();

    // A request waiting for the token when the connection moves to another server never goes out to the old one with the
    // new server's key.
    const sent = [];
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const moving = new M.ServerBackend({
      fetch: (input, init) => {
        sent.push({ url: String(input), key: init.headers["X-Access-Key"] });
        return fetch(input, init);
      },
      storage: {
        get: async () => {
          await gate;
          return null;
        },
        set: async () => {},
        remove: async () => {},
      },
    });
    moving.init(settingsFor(server.url, KEY));
    const pending = moving.fetchNotes();
    moving.init(settingsFor("http://127.0.0.1:9", "the-other-servers-key"));
    release();
    ok("a request across a re-init fails (retried by the engine)", (await pending) === null);
    ok(
      "...and nothing reached the first server with the second one's key",
      sent.every((r) => !(r.url.startsWith(server.url) && r.key === "the-other-servers-key")),
      sent
    );
    await moving.dispose();
  }

  log("\nServerBackend: checking settings leaves the connection alone");
  {
    const a = makeBackend(server.url);
    await a.backend.registerDevice({ uuid: "CK", modelName: "Mac", brand: "Apple" });
    const errors = [];
    const snapshots = [];
    a.backend.subscribeDevices(
      "CK",
      (snapshot) => snapshots.push(snapshot),
      (e) => errors.push(e)
    );
    await until(() => snapshots.length > 0, 2000);
    ok("the right key checks out", await a.backend.check(settingsFor(server.url)));
    ok("a wrong key doesn't", !(await a.backend.check(settingsFor(server.url, "not-the-key-0123456789"))));
    ok("nor a server that isn't there", !(await a.backend.check(settingsFor("http://127.0.0.1:9"))));
    const count = snapshots.length;
    await a.backend.push("CK", ops([note("ck1", 1)]), []);
    ok(
      "...and the live connection never noticed: no listener error, still live",
      errors.length === 0 && (await until(() => snapshots.length > count, 2000))
    );
    ok(
      "the router checks on the settings' own cloud",
      await new M.CloudRouter({ firebase: null, server: a.backend }).check(settingsFor(server.url))
    );
    await a.backend.dispose();
  }

  log("\nServerBackend: a slow link");
  {
    // Requests over `limit` bytes never answer (a link too slow for them): they time out.
    const slow = (limit, match) => (input, init) => {
      const url = String(input);
      const size = match(url, init);
      if (size > limit) {
        return new Promise((_, reject) =>
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        );
      }
      return fetch(input, init);
    };
    const tokens = new Map();
    const storage = {
      get: async (k) => tokens.get(k) ?? null,
      set: async (k, v) => void tokens.set(k, v),
      remove: async (k) => void tokens.delete(k),
    };
    const pushes = new M.ServerBackend({
      longTimeout: 300,
      storage,
      fetch: slow(450_000, (url, init) => (url.endsWith("/v1/push") ? (init.body?.length ?? 0) : 0)),
    });
    pushes.init(settingsFor(server.url));
    await pushes.registerDevice({ uuid: "SL", modelName: "Pixel", brand: "Google" });
    const heavy = ["h1", "h2", "h3"].map((id) => note(id, 1, { text: "x".repeat(200_000) }));
    let tries = 0;
    let pushed;
    do {
      tries++;
      pushed = await pushes.push("SL", ops(heavy), []);
    } while (!pushed.complete && tries < 8);
    ok(
      "a push that times out is retried in smaller requests until they go through",
      pushed.complete && tries === 4 && pushed.committed.notes.add.length > 0,
      { tries, complete: pushed.complete }
    );

    const asked = [];
    const pages = new M.ServerBackend({
      longTimeout: 300,
      storage,
      fetch: slow(1_000_000, (url) => {
        const bytes = Number(new URL(url).searchParams.get("bytes") ?? 0);
        if (url.includes("/v1/notes?")) asked.push(bytes);
        return bytes;
      }),
    });
    pages.init(settingsFor(server.url));
    const all = await pages.fetchNotes();
    ok(
      "pages that time out are asked for again, smaller",
      all?.filter((n) => n.id.startsWith("h")).length === 3 && asked.slice(0, 4).join() === "8000000,4000000,2000000,1000000",
      asked
    );
    await pushes.dispose();
    await pages.dispose();
  }

  log("\nServerBackend: a request over the server's size limit");
  {
    const small = await newServer({ env: { MAX_BODY_MB: "1", MAX_NOTE_MB: "4" } });
    const a = makeBackend(small.url);
    await a.backend.registerDevice({ uuid: "A", modelName: "Mac", brand: "Apple" });
    const big = note("big", 1, { text: "x".repeat(1_200_000) });
    const res = await a.backend.push("A", ops([note("s1", 1), big, note("s2", 1)]), []);
    ok(
      "the oversized note alone is rejected for good, the others go through",
      res.complete && res.rejected.join() === "addNotes:big" && res.committed.notes.add.sort().join() === "s1,s2",
      res
    );
    await small.stop();
  }

  /* ---------------------------------------------------------------------------------------------------------------- */
  /* The engine on it                                                                                                 */
  /* ---------------------------------------------------------------------------------------------------------------- */

  const fakeCrypto = {
    encrypt: (n) => ({ ...n, sealed: "k1" }),
    decrypt: (n) => {
      if (n.sealed !== "k1") return null;
      const { sealed: _sealed, ...plain } = n;
      return plain;
    },
    matches: (vault) => vault.key === "k1",
  };

  /** A device: a store, the real engine, and an adapter on the server. */
  const makeDevice = async (srv, name, opts = {}) => {
    const store = M.configureStore({
      reducer: { notes: M.notesReducer, categories: M.categoriesReducer, settings: (s = {}) => s },
      middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
    });
    const { backend, net, tokens } = makeBackend(srv.url);
    if (opts.register !== false) await backend.registerDevice({ uuid: name, modelName: name, brand: "test" });
    const device = {
      name,
      store,
      backend,
      net,
      tokens,
      events: [],
      removed: false,
      stale: false,
      live: () => store.getState().notes.items,
      get: (id) => store.getState().notes.items.find((n) => n.id === id),
      dispatch: (action) => store.dispatch(action),
      outboxEmpty: () => {
        const { add, delete: del, detach } = store.getState().notes.cloud.items;
        return Object.keys(add).length + Object.keys(del).length + Object.keys(detach ?? {}).length === 0;
      },
      offline: async () => {
        net.online = false;
        await backend.reconnect();
      },
      online: async () => {
        net.online = true;
        await device.engine.resume();
      },
    };
    device.engine = new M.SyncEngine({
      backend,
      me: name,
      store,
      actions: {
        applyNotesPlan: N.applyNotesPlan,
        notesPushed: N.notesPushed,
        dropNoteUploads: N.dropNoteUploads,
        adoptLegacyOutbox: N.adoptLegacyOutbox,
        applyCategoriesPlan: C.applyCategoriesPlan,
        categoriesPushed: C.categoriesPushed,
        addLocalCategories: C.addLocalCategories,
        deleteLocalCategories: C.deleteLocalCategories,
      },
      crypto: fakeCrypto,
      persist: async () => {},
      flushEditors: () => {},
      conflictSuffix: () => "(conflict)",
      timing: opts.timing ?? { pushMinInterval: 0, ackQuiet: 30, ackMaxWait: 150 },
      events: {
        onApplied: (e) => device.events.push(e),
        onDevices: () => {},
        onRemoved: () => (device.removed = true),
        onVaultStale: () => (device.stale = true),
      },
    });
    cleanups.push(() => device.engine.stop());
    return device;
  };

  const newNote = (id, text, extra = {}) => ({
    id,
    type: "text",
    title: id,
    text,
    category: { order: 0, name: "All", icon: "none", index: true, selected: true },
    date: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    important: false,
    locked: false,
    readOnly: false,
    hidden: false,
    deleteDate: null,
    ...extra,
  });
  const edit = (device, id, text) => device.dispatch(N.addNote({ ...device.get(id), text, updatedAt: Date.now() }));
  const texts = (device) =>
    device
      .live()
      .map((n) => `${n.id}=${n.text}`)
      .sort()
      .join(" | ");

  /** A fresh server with a vault every device opens. */
  const scenario = async (title, run) => {
    log(`\n${title}`);
    const srv = await newServer();
    const setup = makeBackend(srv.url);
    await setup.backend.createVaultExclusive({ key: "k1", version: 2 });
    try {
      await run(srv);
    } finally {
      cleanups.splice(0).forEach((stop) => stop());
      await srv.stop();
    }
  };

  await scenario("engine: propagation and live edits", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "hello")));
    ok("a new note reaches the other device", await until(() => b.get("n1")?.text === "hello"));
    ok("...and both outboxes empty", await until(() => a.outboxEmpty() && b.outboxEmpty()));
    edit(a, "n1", "hello world");
    ok("an edit reaches it", await until(() => b.get("n1")?.text === "hello world"));
    ok(
      "the receiver is told which note changed (live editor refresh)",
      b.events.some((e) => e.changed.includes("n1"))
    );
    edit(b, "n1", "back from B");
    ok("...and back", await until(() => a.get("n1")?.text === "back from B"));
    ok(
      "both know it as synced",
      await until(() => a.get("n1").syncedRev === M.noteRev(a.get("n1")) && b.get("n1").syncedRev === M.noteRev(b.get("n1")))
    );
    const overview = await srv.admin("GET", "/admin/api/overview");
    ok(
      "the server's cursors catch up (nothing behind)",
      await until(async () => (await srv.admin("GET", "/admin/api/overview")).devices.every((d) => d.behind === 0)),
      overview.devices
    );
  });

  await scenario("engine: offline edits on both sides keep both versions", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "base")));
    await until(() => b.get("n1")?.text === "base");
    await a.offline();
    await b.offline();
    edit(a, "n1", "from A");
    await sleep(5);
    edit(b, "n1", "from B");
    await a.online();
    await until(() => a.outboxEmpty());
    await b.online();
    ok("both converge", await until(() => texts(a) === texts(b) && a.outboxEmpty() && b.outboxEmpty(), 10000), [
      texts(a),
      texts(b),
    ]);
    ok(
      "...keeping both versions (one as a conflict copy)",
      texts(a).includes("from A") && texts(a).includes("from B"),
      texts(a)
    );
  });

  await scenario("engine: an edit after a deletion made elsewhere wins", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "v1")));
    await until(() => b.get("n1"));
    await b.offline();
    a.dispatch(N.temporaryDeleteNote("n1"));
    await until(() => a.outboxEmpty() && !a.get("n1"));
    await sleep(5);
    edit(b, "n1", "edited offline");
    await b.online();
    ok(
      "the edit comes back on the device that deleted it",
      await until(() => a.get("n1")?.text === "edited offline", 10000),
      texts(a)
    );
    ok("...with no copy", a.live().length === 1 && b.live().length === 1);
  });

  await scenario("engine: a device offline for a while catches up across feed pages", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    await until(() => true, 200);
    await b.offline();
    for (let i = 0; i < 1100; i++) a.dispatch(N.addNote(newNote(`bulk-${i}`, `text ${i}`)));
    ok("the sender gets them all out", await until(() => a.outboxEmpty(), 20000));
    await b.online();
    ok("the other device gets all 1100 (three pages)", await until(() => b.live().length === 1100, 20000), b.live().length);
    ok(
      "...and its cursor is at the end",
      await until(
        async () => (await srv.admin("GET", "/admin/api/overview")).devices.find((d) => d.uuid === "B").behind === 0,
        5000
      )
    );
  });

  await scenario("engine: the server goes down and comes back; nothing is lost", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "before")));
    await until(() => b.get("n1"));
    await srv.stop();
    edit(a, "n1", "while down");
    a.dispatch(N.addNote(newNote("n2", "new while down")));
    await sleep(500);
    ok("the edits wait in the outbox", !a.outboxEmpty());
    const again = await startServer({ dataDir: srv.dataDir, port: srv.port });
    servers.push(again);
    await a.engine.resume();
    await b.engine.resume();
    ok(
      "they reach the other device once the server is back",
      await until(() => b.get("n1")?.text === "while down" && b.get("n2"), 15000),
      texts(b)
    );
    ok("...and leave the outbox", await until(() => a.outboxEmpty()));
    await again.stop();
  });

  await scenario("engine: three devices, deletions and categories", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    const c = await makeDevice(srv, "C");
    [a, b, c].forEach((d) => d.engine.start());
    a.dispatch(N.addNote(newNote("n1", "one")));
    a.dispatch(N.addNote(newNote("n2", "two")));
    a.dispatch(C.createCategory({ name: "Work", icon: "briefcase" }));
    ok(
      "everyone has them",
      await until(() =>
        [b, c].every((d) => d.live().length === 2 && d.store.getState().categories.items.some((x) => x.icon === "briefcase"))
      )
    );
    await c.offline();
    b.dispatch(N.temporaryDeleteNote("n2"));
    edit(a, "n1", "one, edited");
    await until(() => a.outboxEmpty() && b.outboxEmpty());
    await c.online();
    ok(
      "the offline one catches up: edit and deletion",
      await until(() => c.get("n1")?.text === "one, edited" && !c.get("n2")),
      texts(c)
    );
    ok(
      "...the deletion went to its trash",
      c.store.getState().notes.temporaryItems.some((n) => n.id === "n2")
    );
  });

  await scenario("engine: removed from another device, it stops and says so", async (srv) => {
    const a = await makeDevice(srv, "A");
    const b = await makeDevice(srv, "B");
    a.engine.start();
    b.engine.start();
    await until(() => true, 300);
    await a.backend.unregisterDevice("B");
    ok("the removed device is told", await until(() => b.removed, 5000));
    ok("...and stops", !b.engine.isRunning);
  });

  await scenario("engine: a new device's full sync brings everything already there", async (srv) => {
    const a = await makeDevice(srv, "A");
    a.engine.start();
    for (let i = 0; i < 30; i++) a.dispatch(N.addNote(newNote(`old-${i}`, `old ${i}`)));
    await until(() => a.outboxEmpty());
    const d = await makeDevice(srv, "D");
    ok("full sync", await d.engine.fullSync());
    ok("...it has every note", d.live().length === 30);
    d.engine.start();
    a.dispatch(N.addNote(newNote("after", "after connecting")));
    ok("and then the live ones", await until(() => d.get("after")));
  });

  await scenario("engine: the vault replaced elsewhere makes this device's key stale", async (srv) => {
    const a = await makeDevice(srv, "A");
    a.engine.start();
    await until(() => true, 300);
    await makeBackend(srv.url).backend.writeVault({ key: "k2", version: 2 });
    ok("the engine stops and asks for the new password", (await until(() => a.stale, 5000)) && !a.engine.isRunning);
  });

  await scenario("engine: the server's own pacing (no test overrides)", async (srv) => {
    const a = await makeDevice(srv, "A", { timing: {} });
    const b = await makeDevice(srv, "B", { timing: {} });
    a.engine.start();
    b.engine.start();
    a.dispatch(N.addNote(newNote("n1", "v0")));
    await until(() => b.get("n1"));
    const started = Date.now();
    for (let i = 1; i <= 5; i++) {
      edit(a, "n1", `v${i}`);
      await sleep(120);
    }
    ok(
      "typing reaches the other device within about a second",
      (await until(() => b.get("n1")?.text === "v5", 3000)) && Date.now() - started < 2500,
      Date.now() - started
    );
    ok(
      "acknowledged soon after (cursor caught up)",
      await until(async () => (await srv.admin("GET", "/admin/api/overview")).devices.every((d) => d.behind === 0), 8000)
    );
  });
} catch (e) {
  failed++;
  console.error("  ✗ crashed:", e);
} finally {
  cleanups.splice(0).forEach((stop) => stop());
  await Promise.all(servers.map((s) => s.stop()));
}

log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
