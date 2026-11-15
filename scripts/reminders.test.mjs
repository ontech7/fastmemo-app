// Reminders (spec D.5): what should ring (planReminders), the quick choices (presets) and the month (monthGrid).
// Pure modules, bundled with esbuild; the phone's side with the library stood in for. Run: node scripts/reminders.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "reminders.bundle.mjs");

await build({
  stdin: {
    contents: `
      export { planReminders, isUpcoming, withReminder, notifyStateOf } from "@/libs/reminders/plan";
      export { presets, formatWhen, choiceNow } from "@/libs/reminders/presets";
      export { monthGrid } from "@/libs/reminders/month";
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
});

const { planReminders, isUpcoming, withReminder, notifyStateOf, presets, formatWhen, monthGrid, choiceNow } = await import(
  pathToFileURL(out).href
);

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail !== undefined ? `: ${detail}` : ""}`);
  }
};

console.log("\nwhat should ring");
const now = 1_000_000;
const N = (id, remindAt, extra = {}) => ({ id, title: "T" + id, remindAt, locked: false, hidden: false, ...extra });
const S = (noteId, at, extra = {}) => ({ noteId, at, private: false, title: "T" + noteId, ...extra });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok(
  "a future reminder is scheduled",
  eq(planReminders([N("a", now + 5)], [], now), { schedule: [S("a", now + 5)], cancel: [] })
);
ok(
  "past, now, or none: nothing",
  eq(planReminders([N("a", now), N("b", now - 1), N("c")], [], now), { schedule: [], cancel: [] })
);
ok(
  "already scheduled the same: nothing to do",
  eq(planReminders([N("a", now + 5)], [S("a", now + 5)], now), { schedule: [], cancel: [] })
);
ok(
  "the time moved",
  eq(planReminders([N("a", now + 9)], [S("a", now + 5)], now), { schedule: [S("a", now + 9)], cancel: ["a"] })
);
ok(
  "the title changed",
  eq(planReminders([N("a", now + 5, { title: "Nuovo" })], [S("a", now + 5)], now), {
    schedule: [S("a", now + 5, { title: "Nuovo" })],
    cancel: ["a"],
  })
);
ok(
  "it became protected: again, with no title",
  eq(planReminders([N("a", now + 5, { locked: true })], [S("a", now + 5)], now), {
    schedule: [S("a", now + 5, { private: true, title: "" })],
    cancel: ["a"],
  })
);
ok(
  "a protected or hidden note's title is nowhere in the plan",
  !JSON.stringify(
    planReminders(
      [N("a", now + 5, { locked: true, title: "Segreto" }), N("b", now + 5, { hidden: true, title: "Segreto" })],
      [],
      now
    )
  ).includes("Segreto")
);
ok(
  "a private note whose title changes is not scheduled again",
  eq(planReminders([N("a", now + 5, { locked: true, title: "Altro" })], [S("a", now + 5, { private: true, title: "" })], now), {
    schedule: [],
    cancel: [],
  })
);
ok("in the trash or deleted: cancelled", eq(planReminders([], [S("a", now + 5)], now), { schedule: [], cancel: ["a"] }));
ok(
  "the reminder removed, or passed: cancelled",
  eq(planReminders([N("a"), N("b", now - 1)], [S("a", now + 5), S("b", now - 1)], now), { schedule: [], cancel: ["a", "b"] })
);
ok(
  "removing leaves no key",
  !("remindAt" in withReminder(N("a", 5), null)) &&
    withReminder(N("a"), 7).remindAt === 7 &&
    isUpcoming({ remindAt: now + 1 }, now) &&
    !isUpcoming({ remindAt: now }, now) &&
    !isUpcoming({}, now)
);

console.log("\nwhether the phone may ask");
// Android 13+: expo answers "denied" for a question never asked too (notifications count as off until allowed).
ok("allowed: granted", notifyStateOf({ granted: true, canAskAgain: true, status: "granted" }) === "granted");
ok(
  "never asked, though the status says denied: the system's question can show",
  notifyStateOf({ granted: false, canAskAgain: true, status: "denied" }) === "askable"
);
ok("refused for good: the app's dialog", notifyStateOf({ granted: false, canAskAgain: false, status: "denied" }) === "denied");

console.log("\nthe presets");
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const keys = (date) =>
  presets(date)
    .map((p) => p.key)
    .join();
const wed = presets(new Date(2026, 10, 11, 10, 30, 40)); // Wednesday 11 November 2026, 10:30:40
ok(
  "a weekday morning: all four",
  eq(wed, [
    { key: "hour", at: at(2026, 11, 11, 11, 30) },
    { key: "tonight", at: at(2026, 11, 11, 20) },
    { key: "tomorrow", at: at(2026, 11, 12, 9) },
    { key: "monday", at: at(2026, 11, 16, 9) },
  ])
);
ok(
  "a quick choice pressed later than the sheet opened is the choice of that moment; tonight once past is none",
  choiceNow("hour", new Date(2026, 10, 11, 21, 10)) === at(2026, 11, 11, 22, 10) &&
    choiceNow("tonight", new Date(2026, 10, 11, 18, 0)) === at(2026, 11, 11, 20) &&
    choiceNow("tonight", new Date(2026, 10, 11, 20, 5)) === null
);
ok(
  "tonight only before 19:00",
  keys(new Date(2026, 10, 11, 18, 59)) === "hour,tonight,tomorrow,monday" &&
    keys(new Date(2026, 10, 11, 19, 0)) === "hour,tomorrow,monday" &&
    keys(new Date(2026, 10, 11, 19, 30)) === "hour,tomorrow,monday"
);
ok(
  "on a Sunday tomorrow is Monday",
  keys(new Date(2026, 10, 15, 12, 0)) === "hour,tonight,tomorrow" &&
    presets(new Date(2026, 10, 15, 12, 0))[2].at === at(2026, 11, 16, 9)
);
ok("on a Monday, Monday is next week's", presets(new Date(2026, 10, 16, 8, 0)).at(-1).at === at(2026, 11, 23, 9));
ok(
  "just before midnight",
  eq(presets(new Date(2026, 10, 11, 23, 30)).slice(0, 2), [
    { key: "hour", at: at(2026, 11, 12, 0, 30) },
    { key: "tomorrow", at: at(2026, 11, 12, 9) },
  ])
);
ok(
  "just after midnight",
  presets(new Date(2026, 10, 12, 0, 10)).find((p) => p.key === "tomorrow").at === at(2026, 11, 13, 9) &&
    presets(new Date(2026, 10, 12, 0, 10)).find((p) => p.key === "tonight").at === at(2026, 11, 12, 20)
);
ok(
  "the year's end",
  presets(new Date(2026, 11, 31, 22, 0)).find((p) => p.key === "tomorrow").at === at(2027, 1, 1, 9) &&
    presets(new Date(2026, 11, 31, 22, 0)).find((p) => p.key === "monday").at === at(2027, 1, 4, 9)
);

ok(
  "formatWhen in the app's language",
  (() => {
    const it = formatWhen(at(2026, 11, 12, 9), "it");
    const en = formatWhen(at(2026, 11, 12, 9), "en");
    return it.includes("12/11") && it.includes(" 9:00") && en.includes("11/12") && en.includes("9:00");
  })(),
  [formatWhen(at(2026, 11, 12, 9), "it"), formatWhen(at(2026, 11, 12, 9), "en")]
);

console.log("\nthe month");
const flat = (grid) =>
  grid.map((week) => week.map((d) => (d.inMonth ? "" : "(") + d.day + (d.inMonth ? "" : ")")).join(" ")).join(" | ");
ok(
  "November 2026 from Monday: six weeks",
  flat(monthGrid(2026, 11, 1)).startsWith("(26) (27) (28) (29) (30) (31) 1 | 2 3 4 5 6 7 8") &&
    monthGrid(2026, 11, 1).length === 6 &&
    flat(monthGrid(2026, 11, 1)).endsWith("30 (1) (2) (3) (4) (5) (6)")
);
ok(
  "November 2026 from Sunday: five weeks",
  flat(monthGrid(2026, 11, 0)).startsWith("1 2 3 4 5 6 7") && monthGrid(2026, 11, 0).length === 5
);
ok(
  "December 2026 runs into 2027",
  (() => {
    const last = monthGrid(2026, 12, 1).at(-1).at(-1);
    return last.year === 2027 && last.month === 1 && last.day === 3 && !last.inMonth;
  })()
);
ok(
  "February 2027 from Monday: exactly four weeks",
  monthGrid(2027, 2, 1).length === 4 &&
    monthGrid(2027, 2, 1)
      .flat()
      .every((d) => d.inMonth)
);
ok(
  "January 2027's first week starts in 2026",
  (() => {
    const first = monthGrid(2027, 1, 1)[0][0];
    return first.year === 2026 && first.month === 12 && first.day === 28;
  })()
);

console.log("\nthe phone's side: started after the home, the library loaded then");
{
  // libs/reminders with the library, the app's launch path and the settings stood in for.
  const outGlue = join(os.tmpdir(), "reminders-glue.bundle.mjs");
  const stub = (filter, contents) => ({
    name: `stub-${filter}`,
    setup(b) {
      b.onResolve({ filter }, () => ({ path: String(filter), namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (args) =>
        args.path === String(filter) ? { contents, loader: "js" } : undefined
      );
    },
  });
  await build({
    stdin: { contents: `export { startReminders } from "@/libs/reminders";`, resolveDir: src, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outGlue,
    logLevel: "error",
    alias: { "@": src },
    plugins: [
      stub(
        /^expo-notifications$/,
        `const n = (globalThis.__notif ??= { listeners: 0, scheduled: [], launching: null });
         export const AndroidImportance = { HIGH: 4 };
         export const SchedulableTriggerInputTypes = { DATE: "date" };
         export const setNotificationHandler = () => {};
         export const setNotificationChannelAsync = async () => {};
         export const addNotificationResponseReceivedListener = () => { n.listeners++; return { remove: () => { n.listeners--; } }; };
         export const getLastNotificationResponse = () => n.launching;
         export const clearLastNotificationResponse = () => { n.launching = null; };
         export const getAllScheduledNotificationsAsync = async () => n.scheduled.slice();
         export const scheduleNotificationAsync = async (r) => { if (n.refuse === r.identifier) throw new Error("500 alarms"); n.scheduled.push(r); };
         export const cancelScheduledNotificationAsync = async (id) => { n.scheduled = n.scheduled.filter((r) => r.identifier !== id); };
         export const getExactAlarmPermissionsAsync = async () => ({ granted: true });`
      ),
      stub(/^react-native$/, "export const AppState = { addEventListener: () => ({ remove() {} }) };"),
      stub(/^i18next$/, "export const t = (k) => k; export default { on() {}, off() {} };"),
      stub(/libs\/launch$/, "export const requestLaunch = (a) => { (globalThis.__launched ??= []).push(a); };"),
      stub(
        /slicers\/settingsSlice$/,
        "export const setReminderSettings = (p) => ({ type: 'settings/reminders', payload: p });"
      ),
    ],
  });
  const { startReminders } = await import(pathToFileURL(outGlue).href);
  const settle = () => new Promise((r) => setTimeout(r, 20));
  ok("loading the app's side doesn't load the library", globalThis.__notif === undefined);
  globalThis.__notif = { listeners: 0, scheduled: [], launching: null };
  const storeOf = (items) => ({
    getState: () => ({ notes: { items }, settings: { reminders: { exact: true } } }),
    subscribe: () => () => {},
    dispatch: () => {},
  });
  const note = { id: "n1", title: "Milk", remindAt: Date.now() + 60_000, locked: false, hidden: false };

  globalThis.__notif.launching = {
    notification: { date: 1, request: { identifier: "fm-reminder-n1", content: { data: { noteId: "n1" } } } },
  };
  const stop = startReminders(storeOf([note]));
  await settle();
  ok(
    "the tap that started the app opens its note",
    JSON.stringify(globalThis.__launched) === JSON.stringify([{ kind: "note", id: "n1" }])
  );
  ok("the tap listener is on", globalThis.__notif.listeners === 1);
  ok(
    "a note's reminder is scheduled",
    globalThis.__notif.scheduled.length === 1 && globalThis.__notif.scheduled[0].identifier === "fm-reminder-n1"
  );
  stop();
  ok("stopped: the listener is off", globalThis.__notif.listeners === 0);

  // one the system refuses (Android's 500 alarms an app): the others are scheduled all the same
  // the library is loaded: its stub holds this object
  Object.assign(globalThis.__notif, { scheduled: [], refuse: "fm-reminder-a" });
  const later = (id) => ({ ...note, id, remindAt: Date.now() + 120_000 });
  const stopRefused = startReminders(storeOf([later("a"), later("b"), later("c")]));
  await settle();
  ok(
    "a reminder the system refuses doesn't stop the others",
    globalThis.__notif.scheduled
      .map((r) => r.identifier)
      .sort()
      .join() === "fm-reminder-b,fm-reminder-c",
    globalThis.__notif.scheduled.map((r) => r.identifier).join()
  );
  stopRefused();
  Object.assign(globalThis.__notif, { scheduled: [], refuse: undefined });

  const stopEarly = startReminders(storeOf([]));
  stopEarly(); // before the library has loaded
  await settle();
  ok("stopped before the library loaded: no listener left behind", globalThis.__notif.listeners === 0);
}

console.log("\nthe clock the cards read: a reminder goes when its time passes");
{
  const outClock = join(os.tmpdir(), "reminders-clock.bundle.mjs");
  await build({
    stdin: {
      contents: `export { nextWake, watchReminder, subscribeClock, clockNow } from "@/libs/reminders/clock";`,
      resolveDir: src,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outClock,
    logLevel: "error",
    alias: { "@": src },
    plugins: [
      {
        name: "stub-react-native",
        setup(b) {
          b.onResolve({ filter: /^react-native$/ }, () => ({ path: "rn", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents:
              "export const AppState = { addEventListener: (_e, f) => { globalThis.__front = f; return { remove() {} }; } };",
            loader: "js",
          }));
        },
      },
    ],
  });
  const { nextWake, watchReminder, subscribeClock, clockNow } = await import(pathToFileURL(outClock).href);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  ok("the next wake is the nearest time still to come", nextWake([5, 30, 20], 10) === 20);
  ok("nothing to come: no wake", nextWake([5, 10], 10) === null && nextWake([], 10) === null);

  let ticks = 0;
  const unsubscribe = subscribeClock(() => ticks++);
  const at = Date.now() + 60;
  const unwatch = watchReminder(at);
  ok("before its time: the clock is before it", clockNow() < at && ticks === 0);
  await wait(150);
  ok("its time passed: the clock moved past it, once", clockNow() >= at && ticks === 1, `ticks ${ticks}`);
  unwatch();

  await wait(30);
  const before = ticks;
  const unwatchPast = watchReminder(Date.now() - 5); // shown by a card the clock hasn't seen pass
  await wait(30);
  ok("one already passed when shown: the clock catches up", ticks === before + 1 && clockNow() >= Date.now() - 40);
  unwatchPast();

  const t0 = ticks;
  const unwatchGone = watchReminder(Date.now() + 40);
  unwatchGone(); // the card went before the time
  await wait(100);
  ok("no card shows it any more: no wake", ticks === t0, `ticks ${ticks - t0}`);

  await wait(20);
  const t1 = ticks;
  globalThis.__front?.("active");
  ok("back to the front: the clock reads the time again", ticks === t1 + 1);
  unsubscribe();
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
