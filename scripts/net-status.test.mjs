// The web/desktop connection status (src/libs/netStatus.ts, LL-082): the browser's online/offline events, and a probe
// request only while something retains it (a cloud is connected) and the page is visible, one timer for the whole app.
// Run: node scripts/net-status.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "net-status.bundle.mjs");

await build({
  stdin: { contents: `export * from "@/libs/netStatus";`, resolveDir: src, loader: "ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: { "@": src },
});

const { createNetStatus, PROBE_INTERVAL_MS } = await import(pathToFileURL(out).href);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
};

/** A fake browser: a manual clock for the interval, a count of probes, switches for online, visible and the answer. */
const make = ({ online = true, visible = true, answer = true } = {}) => {
  const listeners = { online: new Set(), offline: new Set(), visibility: new Set() };
  const timers = new Map();
  let nextTimer = 1;
  const s = { probes: 0, online, visible, answer, now: 0 };
  const on = (name) => (listener) => {
    listeners[name].add(listener);
    return () => listeners[name].delete(listener);
  };
  const env = {
    isOnline: () => s.online,
    isVisible: () => s.visible,
    probe: () => {
      s.probes++;
      return Promise.resolve(s.answer);
    },
    onOnline: on("online"),
    onOffline: on("offline"),
    onVisibility: on("visibility"),
    setInterval: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, ms, at: s.now + ms });
      return id;
    },
    clearInterval: (id) => timers.delete(id),
  };
  /** Moves the clock, running each timer as many times as it falls due. */
  s.tick = (ms) => {
    const end = s.now + ms;
    for (;;) {
      const due = [...timers.values()].filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      s.now = due.at;
      due.at += due.ms;
      due.fn();
    }
    s.now = end;
  };
  /** Lets the probes' promises answer. */
  s.settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  s.fire = (name) => [...listeners[name]].forEach((listener) => listener());
  s.timers = () => timers.size;
  s.store = createNetStatus(env);
  return s;
};

console.log("\nwhen it asks");
ok("the interval", PROBE_INTERVAL_MS === 30_000);
ok(
  "no cloud: no request at all",
  (() => {
    const s = make();
    s.store.subscribe(() => {});
    s.store.subscribe(() => {});
    s.tick(120_000);
    return s.probes === 0;
  })()
);
ok(
  "three consumers, one request per interval",
  await (async () => {
    const s = make();
    const r = [s.store.retainProbe(), s.store.retainProbe(), s.store.retainProbe()];
    await s.settle();
    s.tick(30_000);
    await s.settle();
    return s.probes === 2 && r.length === 3 && s.timers() === 1;
  })()
);
ok(
  "hidden: no request; visible again: one at once",
  await (async () => {
    const s = make();
    s.store.retainProbe();
    await s.settle();
    const before = s.probes;
    s.visible = false;
    s.fire("visibility");
    s.tick(90_000);
    await s.settle();
    const whileHidden = s.probes;
    s.visible = true;
    s.fire("visibility");
    await s.settle();
    return before === 1 && whileHidden === 1 && s.probes === 2;
  })()
);
ok(
  "released: the timer stops",
  await (async () => {
    const s = make();
    const release = s.store.retainProbe();
    await s.settle();
    release();
    s.tick(90_000);
    await s.settle();
    return s.probes === 1 && s.timers() === 0;
  })()
);
ok(
  "released twice is released once",
  await (async () => {
    const s = make();
    const a = s.store.retainProbe();
    s.store.retainProbe();
    await s.settle();
    a();
    a();
    s.tick(30_000);
    await s.settle();
    return s.probes === 2;
  })()
);

console.log("\nwhat it says");
ok(
  "it starts from what the browser says",
  make({ online: false }).store.getSnapshot().isConnected === false &&
    make().store.getSnapshot().isConnected === true &&
    make().store.getSnapshot().type === "unknown"
);
ok(
  "offline event is told at once",
  (() => {
    const s = make();
    let calls = 0;
    s.store.subscribe(() => calls++);
    s.online = false;
    s.fire("offline");
    const snap = s.store.getSnapshot();
    return snap.isConnected === false && snap.type === "none" && calls === 1;
  })()
);
ok(
  "online with a cloud waits for the probe",
  await (async () => {
    const s = make({ answer: false });
    s.store.retainProbe();
    await s.settle();
    s.online = false;
    s.fire("offline");
    s.online = true;
    s.fire("online");
    const meanwhile = s.store.getSnapshot().isConnected;
    await s.settle();
    return meanwhile === false && s.store.getSnapshot().isConnected === false && s.probes === 2;
  })()
);
ok(
  "online with a cloud, and the probe answers: connected",
  await (async () => {
    const s = make();
    s.store.retainProbe();
    await s.settle();
    s.online = false;
    s.fire("offline");
    s.online = true;
    s.fire("online");
    await s.settle();
    const snap = s.store.getSnapshot();
    return snap.isConnected === true && snap.type === "wifi";
  })()
);
ok(
  "online without a cloud trusts the browser",
  (() => {
    const s = make();
    s.online = false;
    s.fire("offline");
    s.online = true;
    s.fire("online");
    const snap = s.store.getSnapshot();
    return snap.isConnected === true && snap.type === "unknown" && s.probes === 0;
  })()
);
ok(
  "a probe that fails says offline, the next that passes says online",
  await (async () => {
    const s = make({ answer: false });
    s.store.retainProbe();
    await s.settle();
    const first = s.store.getSnapshot();
    s.answer = true;
    s.tick(30_000);
    await s.settle();
    const second = s.store.getSnapshot();
    return first.isConnected === false && first.type === "none" && second.isConnected === true && second.type === "wifi";
  })()
);
ok(
  "the last release goes back to what the browser says",
  await (async () => {
    const s = make({ answer: false });
    const release = s.store.retainProbe();
    await s.settle();
    const probed = s.store.getSnapshot().isConnected;
    release();
    const snap = s.store.getSnapshot();
    return probed === false && snap.isConnected === true && snap.type === "unknown";
  })()
);
ok(
  "an answer that comes after the release changes nothing",
  await (async () => {
    const s = make({ answer: false });
    const release = s.store.retainProbe();
    release();
    await s.settle();
    return s.store.getSnapshot().isConnected === true;
  })()
);
ok(
  "the snapshot is the same object until something changes",
  await (async () => {
    const s = make();
    const a = s.store.getSnapshot();
    const b = s.store.getSnapshot();
    s.store.retainProbe();
    await s.settle();
    const probed = s.store.getSnapshot();
    s.tick(30_000);
    await s.settle();
    const again = s.store.getSnapshot();
    s.online = false;
    s.fire("offline");
    const changed = s.store.getSnapshot();
    return a === b && probed !== a && again === probed && changed !== again;
  })()
);
ok(
  "a listener is told only of changes",
  await (async () => {
    const s = make();
    let calls = 0;
    s.store.subscribe(() => calls++);
    s.store.retainProbe();
    await s.settle();
    s.tick(60_000);
    await s.settle();
    return calls === 1;
  })()
);
ok(
  "an unsubscribed listener isn't told",
  (() => {
    const s = make();
    let calls = 0;
    const off = s.store.subscribe(() => calls++);
    off();
    s.online = false;
    s.fire("offline");
    return calls === 0;
  })()
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
