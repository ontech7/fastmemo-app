// Diagnostics test: what a report and an error may carry (the installation code, the report payload, the three-a-day
// log, the send, and the allow-list in front of Sentry).
// Run: node scripts/diagnostics.test.mjs
// It bundles the pure modules of src/libs/diagnostics with esbuild; AsyncStorage is the in-memory stub.

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "diagnostics.bundle.mjs");

// Modules the diagnostics import that need a device: minimal stand-ins.
const STUBS = {
  "expo-device": `export const brand = "Google"; export const modelName = "Pixel"; export const osName = "Android"; export const osVersion = "16"; export const deviceType = 1; export const DeviceType = { 0: "UNKNOWN", 1: "PHONE", 2: "TABLET", 3: "DESKTOP", 4: "TV", UNKNOWN: 0, PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4 };`,
  "@/libs/appIcon": `export const getAppIcon = () => null;`,
  "@/libs/device": `export const getDeviceInfo = () => ({ brand: "web", modelName: "Chrome (Browser)" });`,
  "@/utils/version": `export const getDisplayAppVersion = () => "4.1.0"; export const getCurrentAppVersion = () => "4.1.0"; export const OTA_REVISION = 0; export const isDesktopOrWeb = () => false;`,
};

const resolver = {
  name: "fastmemo-test-resolver",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => (STUBS[args.path] !== undefined ? { path: args.path, namespace: "stub" } : null));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

await build({
  stdin: {
    contents: `
      export * from "@/libs/diagnostics/installId";
      export * from "@/libs/diagnostics/report";
      export * from "@/libs/diagnostics/scrub";
    `,
    resolveDir: src,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "error",
  alias: {
    "@": src,
    "@react-native-async-storage/async-storage": join(__dirname, "_async-storage-stub.js"),
    "expo-crypto": join(__dirname, "_expo-crypto-stub.js"),
  },
  plugins: [resolver],
});

const { default: storage } = await import(pathToFileURL(join(__dirname, "_async-storage-stub.js")).href);
let fresh = 0;
/** A new copy of the modules, with no code in memory (as at an app start). */
const load = () => import(`${pathToFileURL(out).href}?fresh=${++fresh}`);

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

/* ------------------------------------------------------------------------------------------------------------------ */

console.log("\ninstallation code");
{
  storage.__reset();
  const { makeInstallId, getInstallId, isInstallId, peekInstallId } = await load();
  ok("format", /^FM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(makeInstallId(new Uint8Array([0, 31, 32, 255, 7, 8, 9, 10]))));
  ok("not known before it is read", peekInstallId() === null);
  const [x, y] = await Promise.all([getInstallId(), getInstallId()]);
  ok("made once", x === y && (await getInstallId()) === x && storage.writes === 1 && isInstallId(x));
  ok("peek gives it once read", peekInstallId() === x);
  const again = await load();
  ok("the next start reads the same code", (await again.getInstallId()) === x && storage.writes === 1);
}
{
  storage.__reset();
  await storage.setItem("@installId", "hello");
  const { getInstallId, isInstallId } = await load();
  ok("a malformed stored value is replaced", isInstallId(await getInstallId()) && storage.get("@installId") !== "hello");
}
{
  storage.__reset();
  storage.__failReads(true);
  const { getInstallId, isInstallId } = await load();
  ok("a read that throws writes nothing", isInstallId(await getInstallId()) && storage.writes === 0);
  storage.__failReads(false);
}

const M = await load();
const { buildReportPayload, payloadRows, pruneReportLog, canSendReport, nextReportAt, attachmentsFit, sendReport } = M;
const { routePattern, hostKind, scrubBreadcrumb, scrubEvent, isTransientNetworkError, isEmailValid } = M;

console.log("\npayload");
const always = { appVersion: "4.1.0 · OTA 0", os: "Android", osVersion: "16", appLanguage: "it", installId: "FM-7K2Q-9DXA" };
const p = buildReportPayload({ topics: ["other"], description: "  L'app è sparita ", email: " ", attachments: [], always });
ok(
  "trimmed, empty parts left out",
  p.description === "L'app è sparita" && !("email" in p) && !("attachments" in p) && !("deviceInfo" in p),
  p
);
const full = {
  topics: ["cloud"],
  description: "x",
  always: { ...always, deviceName: "Anna's phone" },
  deviceInfo: {
    brand: "Google",
    modelName: "Pixel 10 Pro",
    deviceType: "PHONE",
    cloud: "server",
    appIcon: "default",
    appVersion: "4.1.0",
    deviceName: "Anna's phone",
  },
};
ok("the phone's name is never there", !JSON.stringify(buildReportPayload(full)).includes("deviceName"));
ok(
  "rows are the values as sent",
  payloadRows(buildReportPayload(full)).device.some((r) => r.key === "cloud" && r.value === "server")
);
ok("no device rows without device information", payloadRows(p).device === null);
{
  const rows = payloadRows(
    buildReportPayload({
      ...full,
      email: " a@b.it ",
      attachments: [{ filename: "a.jpg", encoding: "base64", content: "QQ==" }],
    })
  );
  const rest = Object.fromEntries(rows.rest.map((r) => [r.key, r.value]));
  ok(
    "the rest: topic, length, images, email",
    rest.topics === "cloud" && rest.descriptionLength === "1" && rest.images === "1" && rest.email === "a@b.it",
    rows.rest
  );
  ok("always rows in order", rows.always.map((r) => r.key).join() === "appVersion,os,osVersion,appLanguage,installId");
}
ok("an email that looks right", isEmailValid("anna@example.it") && !isEmailValid("anna@") && !isEmailValid("a b@c.d"));

console.log("\nthree a day");
const now = Date.parse("2026-11-11T12:00:00Z");
const h = 3600e3;
const iso = (t) => new Date(t).toISOString();
ok("old entries leave", pruneReportLog([iso(now - 25 * h), iso(now - h)], null, now).length === 1);
ok("4.0.0's lock counts as one", pruneReportLog(undefined, iso(now + 10 * h), now).length === 1);
ok("a past lock counts as none", pruneReportLog([], iso(now - h), now).length === 0);
ok("unparsable entries are dropped", pruneReportLog(["nope", 7, iso(now - h)], "garbage", now).length === 1);
ok(
  "third allowed, fourth not",
  canSendReport([iso(now - h), iso(now - 2 * h)], now) &&
    !canSendReport([iso(now - h), iso(now - 2 * h), iso(now - 3 * h)], now)
);
ok("when the next one is allowed", nextReportAt([iso(now - 3 * h), iso(now - 2 * h), iso(now - h)], now) === now + 21 * h);
ok("no wait while one can be sent", nextReportAt([iso(now - h)], now) === null);
ok(
  "pictures over the cap don't fit",
  !attachmentsFit([{ filename: "a.jpg", encoding: "base64", content: "x".repeat(3_000_001) }])
);
ok(
  "pictures under the cap fit, counted together",
  attachmentsFit([{ filename: "a.jpg", encoding: "base64", content: "x".repeat(1_500_000) }]) &&
    !attachmentsFit([1, 2, 3].map(() => ({ filename: "a.jpg", encoding: "base64", content: "x".repeat(1_000_001) })))
);

console.log("\nsending");
const answers = (body) => async () => ({ json: async () => body });
{
  let seen = null;
  const r = await sendReport(p, "https://x", {
    fetch: async (url, init) => {
      seen = { url, init };
      return { json: async () => ({ success: true }) };
    },
  });
  ok("success", r.ok === true);
  ok(
    "posted as JSON to /report/",
    seen.url === "https://x/report/" &&
      seen.init.method === "POST" &&
      seen.init.headers["Content-Type"] === "application/json" &&
      JSON.parse(seen.init.body).description === "L'app è sparita"
  );
}
ok("refused", (await sendReport(p, "https://x", { fetch: answers({ success: false }) })).ok === false);
ok(
  "offline",
  (
    await sendReport(p, "https://x", {
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    })
  ).ok === false
);
ok(
  "not JSON",
  (
    await sendReport(p, "https://x", {
      fetch: async () => ({
        json: async () => {
          throw new SyntaxError("x");
        },
      }),
    })
  ).ok === false
);
ok(
  "no answer",
  (
    await sendReport(p, "https://x", {
      fetch: (_u, o) => new Promise((_r, rej) => o.signal.addEventListener("abort", () => rej(new Error("aborted")))),
      timeoutMs: 20,
    })
  ).ok === false
);

console.log("\nwhat reaches Sentry");
const ctx = { serverUrl: "https://notes.example.com", apiUrl: "https://fastmemo.example/api" };
ok(
  "a note's address is a pattern",
  routePattern("http://localhost:8081/notes/3f2a9c10-aaaa-bbbb-cccc-1234567890ab?x=1") === "notes/[noteId]"
);
ok("a new note keeps its name", routePattern("/notes/new-kanban") === "notes/new-kanban" && routePattern("/") === "index");
ok("a hash is dropped", routePattern("tauri://localhost/settings/report#top") === "settings/report");
ok("console is dropped", scrubBreadcrumb({ category: "console", message: "note title" }, ctx) === null);
ok(
  "unknown kinds are dropped",
  scrubBreadcrumb({ category: "ui.click", message: "x" }, ctx) === null && scrubBreadcrumb({ category: "touch" }, ctx) === null
);
ok(
  "our own trail is kept",
  scrubBreadcrumb({ category: "app", message: "note.open", data: { type: "text" } }, ctx)?.message === "note.open"
);
const net = scrubBreadcrumb(
  {
    category: "fetch",
    message: "POST https://firestore.googleapis.com/v1/projects/my-proj/x",
    data: { url: "https://firestore.googleapis.com/v1/projects/my-proj/x?key=K", method: "POST", status_code: 200 },
  },
  ctx
);
ok(
  "a request keeps only its kind",
  net.data.host === "firebase" && !JSON.stringify(net).includes("my-proj") && !JSON.stringify(net).includes("key="),
  net
);
ok(
  "the server is 'server'",
  hostKind("https://notes.example.com/v1/notes", ctx) === "server" &&
    hostKind("https://fastmemo.example/api/report/", ctx) === "website"
);
ok("anything else is 'other'", hostKind("https://www.gstatic.com/generate_204", ctx) === "other");
ok(
  "navigation is a pattern",
  scrubBreadcrumb({ category: "navigation", data: { from: "/home", to: "/notes/abc", params: { noteId: "abc" } } }, ctx).data
    .to === "notes/[noteId]"
);
ok(
  "navigation keeps nothing else",
  JSON.stringify(
    scrubBreadcrumb({ category: "navigation", data: { from: "/home", to: "/notes/abc", params: { noteId: "abc" } } }, ctx).data
  ) === '{"from":"home","to":"notes/[noteId]"}'
);
{
  const e = scrubEvent({ request: { url: "tauri://localhost/notes/abc" }, user: { id: "FM-1", ip_address: "1.2.3.4" } });
  ok("the event's address too", e.request.url === "notes/[noteId]");
  ok("the user is only its id", JSON.stringify(e.user) === '{"id":"FM-1"}');
}
ok(
  "offline is not an error to report",
  isTransientNetworkError(new TypeError("Network request failed")) && !isTransientNetworkError(new RangeError("x"))
);
ok(
  "aborts, timeouts and Firestore's unavailable are transient",
  isTransientNetworkError(Object.assign(new Error("x"), { name: "AbortError" })) &&
    isTransientNetworkError(Object.assign(new Error("y"), { code: "unavailable" })) &&
    isTransientNetworkError(Object.assign(new Error("z"), { code: "deadline-exceeded" })) &&
    isTransientNetworkError(new Error("Request timed out")) &&
    !isTransientNetworkError(Object.assign(new Error("w"), { code: "permission-denied" })) &&
    !isTransientNetworkError(undefined)
);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
