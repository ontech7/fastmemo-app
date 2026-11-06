// End-to-end test of the local MCP server: a fake AI client against a real build, through the bridge a client would start.
// Run with the test app open, MCP on and the default switches (`{"enabled": true}` in its mcp.json):
//   node scripts/mcp-e2e.test.mjs "<test app>/Contents/MacOS/Fast Memo Test"
// Options:
//   --restart           macOS: also quits the test app, makes a call on a bridge left running, and opens it again.
//   --wait-minutes <n>  instead of the checks: one call, <n> minutes of nothing, then timed calls. Close the window first.
// Only the test build's data: any other binary is refused. Titles are unique per run. The notes stay in the test app (trashed
// if `trash_note` happens to be on), so it needs no empty store. Hidden notes can't be made here: see scripts/mcp.test.mjs.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";

const TEST_BINARIES = ["Fast Memo Test", "Fast Memo Test.exe"];
/** The app gives the page 10 s (`PAGE_TIMEOUT`): past this, the bridge itself didn't answer. */
const REPLY_TIMEOUT_MS = 20_000;
const APP_WAIT_MS = 60_000;
const CLOSED_WINDOW_LIMIT_MS = 5_000;
const CLIENT = { name: "fastmemo-e2e", version: "1.0.0" };
const MODERN = {
  _meta: {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
  },
};

const argv = process.argv.slice(2);
const restart = argv.includes("--restart");
const waitAt = argv.indexOf("--wait-minutes");
const waitMinutes = waitAt >= 0 ? Number(argv[waitAt + 1]) : null;
const binary = argv.find((arg, index) => !arg.startsWith("--") && (waitAt < 0 || index !== waitAt + 1));

if (!binary || !TEST_BINARIES.includes(basename(binary)) || !existsSync(binary)) {
  console.error(
    `Refused: this runs only against the "Fast Memo Test" binary, and it writes notes. Got: ${binary ?? "no path"}`
  );
  console.error(
    'Usage: node scripts/mcp-e2e.test.mjs "<test app>/Contents/MacOS/Fast Memo Test" [--restart] [--wait-minutes <n>]'
  );
  process.exit(2);
}
if (waitMinutes !== null && !(waitMinutes > 0)) {
  console.error("--wait-minutes needs a number of minutes.");
  process.exit(2);
}
if (restart && process.platform !== "darwin") {
  console.error("--restart is for macOS: quit and reopen the app by hand elsewhere.");
  process.exit(2);
}

let passed = 0;
let failed = 0;
const ok = (name, cond, detail) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One `<binary> --mcp`: one session, as an AI client starts it. Newline-delimited JSON-RPC over stdio. */
class Bridge {
  static started = [];

  constructor() {
    this.child = spawn(binary, ["--mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    this.nextId = 1;
    this.waiting = new Map();
    this.notJsonRpc = [];
    this.exited = new Promise((resolve) => this.child.once("exit", resolve));
    this.child.once("error", (err) => this.waiting.forEach(({ reject }) => reject(err)));
    this.child.stdin.on("error", () => {});
    this.child.stderr.resume();
    createInterface({ input: this.child.stdout }).on("line", (line) => this.receive(line));
    Bridge.started.push(this);
  }

  receive(line) {
    let reply = null;
    try {
      reply = JSON.parse(line);
    } catch {
      // Below: stdout carries JSON-RPC only.
    }
    if (reply?.jsonrpc !== "2.0") {
      this.notJsonRpc.push(line);
      return;
    }
    this.waiting.get(reply.id)?.resolve(reply);
    this.waiting.delete(reply.id);
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`no reply to ${method} in ${REPLY_TIMEOUT_MS} ms`));
      }, REPLY_TIMEOUT_MS);
      this.waiting.set(id, {
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
        reject,
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  /** The handshake of a client from before 2026-07-28. */
  async initialize() {
    const reply = await this.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: CLIENT });
    this.notify("notifications/initialized");
    return reply;
  }

  /** A tool's answer: its text, and whether it's a tool error. A JSON-RPC error is a failure of the protocol itself. */
  async call(name, args = {}, extra = {}) {
    const { result, error } = await this.request("tools/call", { name, arguments: args, ...extra });
    if (error) throw new Error(`${name}: ${JSON.stringify(error)}`);
    return { text: result.content[0].text, isError: result.isError };
  }

  read = (id) => this.call("fastmemo_read_note", { id });
  edit = (args) => this.call("fastmemo_edit_note", args);
  flags = (args) => this.call("fastmemo_set_note_flags", args);
  search = (query) => this.call("fastmemo_search_notes", { query, limit: 50 });

  /** A note this run needs: a refusal here makes the checks after it meaningless. */
  async create(args) {
    const reply = await this.call("fastmemo_create_note", args);
    if (reply.isError) throw new Error(`create_note refused: ${reply.text}`);
    return { ...JSON.parse(reply.text), text: reply.text };
  }

  async close() {
    this.child.stdin.end();
    await this.exited;
  }
}

const body = (reply) => JSON.parse(reply.text);
const sameAnswer = (a, b) => a.isError === true && b.isError === true && a.text === b.text;
const found = (reply) => (reply.isError ? [] : body(reply).notes);

/** Asks until the page answers: the bridge answers from the first moment, the page once the store has rehydrated. */
async function waitForPage(bridge) {
  const deadline = Date.now() + APP_WAIT_MS;
  for (;;) {
    const reply = await bridge.call("fastmemo_list_categories");
    if (!reply.isError || Date.now() > deadline) return reply;
    await sleep(1000);
  }
}

async function runChecks() {
  const stamp = Date.now().toString(36);
  const word = (name) => `e2e${name}${stamp}`;
  const created = [];
  const madeUpId = "00000000-0000-4000-8000-000000000000";
  const madeUpRev = 1;

  const modern = new Bridge();
  const first = new Bridge();
  const discover = await modern.request("server/discover", MODERN);
  const legacyInit = await first.initialize();
  ok(
    "both handshakes work",
    legacyInit.result?.protocolVersion === "2025-11-25" && discover.result?.supportedVersions?.[0] === "2026-07-28",
    { legacyInit, discover }
  );

  const categories = await waitForPage(first);
  if (categories.isError) throw new Error(`the test app doesn't answer: is it open, with MCP on? ${categories.text}`);
  ok("list_categories answers", Array.isArray(body(categories).categories), categories);

  const modernCall = await modern.call("fastmemo_list_categories", {}, MODERN);
  const modernList = await modern.request("tools/list", MODERN);
  ok("a 2026-07-28 request, with no handshake, reaches the page", !modernCall.isError && modernList.result?.tools?.length > 0, {
    modernCall,
    modernList,
  });
  await modern.close();

  // --- The tools an agent sees ---

  const tools = (await first.request("tools/list")).result.tools;
  const names = tools.map((tool) => tool.name);
  ok(
    "8 tools with the default switches: edit_note listed, since create_note is on, and trash_note not",
    tools.length === 8 && names.includes("fastmemo_edit_note") && !names.includes("fastmemo_trash_note"),
    names
  );
  ok(
    "all of them carry the prefix",
    names.every((name) => name.startsWith("fastmemo_"))
  );

  // --- A note of each type ---

  const emoji = "🦊🧠";
  const roundTrip = await first.create({
    type: "text",
    title: `E2E emoji ${emoji} ${stamp}`,
    text: `<p>${word("round")} ${emoji} caffè</p>`,
  });
  created.push(roundTrip.id);
  const roundRead = await first.read(roundTrip.id);
  ok(
    "text note round trip with emoji",
    !roundRead.isError &&
      body(roundRead).content === `<p>${word("round")} ${emoji} caffè</p>` &&
      body(roundRead).title === `E2E emoji ${emoji} ${stamp}` &&
      body(roundRead).type === "text" &&
      body(roundRead).rev === roundTrip.rev,
    { roundTrip, roundRead }
  );
  ok(
    "its words are found by search",
    found(await first.search(word("round"))).some((note) => note.id === roundTrip.id)
  );

  // Every tag the description promises, so there's a note to open and edit by hand in the test app. Same for the types below.
  const richHtml = [
    "<h1>Titolo</h1>",
    "<h2>Sezione</h2>",
    "<h3>Sottosezione</h3>",
    '<p>Testo con <strong>grassetto</strong>, <em>corsivo</em>, <code>codice</code> e <a href="https://example.com">un link</a>.</p>',
    "<ul><li>uno</li><li>due</li></ul>",
    "<ol><li>primo</li><li>secondo</li></ol>",
    "<blockquote>Una citazione</blockquote>",
    "<pre>const x = 1;\nconsole.log(x);</pre>",
  ].join("");
  const rich = await first.create({ type: "text", title: `E2E testo ${stamp}`, text: richHtml });
  created.push(rich.id);
  const richContent = body(await first.read(rich.id)).content;
  const richTags = ["h1", "h2", "h3", "strong", "em", "code", "a", "ul", "ol", "li", "blockquote", "pre"];
  ok(
    "the tags create_note's description lists survive the real sanitizer",
    richTags.every((tag) => richContent.includes(`<${tag}`)),
    richContent
  );

  const hostile = await first.create({
    type: "text",
    title: `E2E hostile ${stamp}`,
    text: `<p onclick="alert(1)">${word("hostile")}</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>`,
  });
  created.push(hostile.id);
  const hostileContent = body(await first.read(hostile.id)).content;
  ok(
    "hostile HTML comes out sanitized by the real DOMPurify",
    hostileContent.includes(word("hostile")) && !/<script|onclick|javascript:/i.test(hostileContent),
    hostileContent
  );

  const todo = await first.create({
    type: "todo",
    title: `E2E todo ${stamp}`,
    items: [{ text: word("todo") }, { text: "Fatto", checked: true }],
  });
  created.push(todo.id);
  const todoList = JSON.parse(body(await first.read(todo.id)).content);
  ok(
    "a todo note reads back with its items",
    todo.type === "todo" && todoList.length === 2 && todoList[0].text === word("todo") && todoList[1].checked === true,
    todoList
  );

  const code = await first.create({
    type: "code",
    title: `E2E code ${stamp}`,
    tabs: [{ title: "main.py", language: "python", code: `print("${word("code")}")\n` }],
  });
  created.push(code.id);
  const codeTabs = JSON.parse(body(await first.read(code.id)).content);
  ok(
    "a code note reads back with its tab",
    code.type === "code" &&
      codeTabs.length === 1 &&
      codeTabs[0].language === "python" &&
      codeTabs[0].code.includes(word("code")),
    codeTabs
  );

  const kanban = await first.create({
    type: "kanban",
    title: `E2E kanban ${stamp}`,
    columns: [{ name: "Da fare", cards: [word("kanban"), "Altra"] }, { name: "Fatto" }],
  });
  created.push(kanban.id);
  const kanbanColumns = JSON.parse(body(await first.read(kanban.id)).content);
  ok(
    "a kanban note reads back with its columns and cards",
    kanban.type === "kanban" && kanbanColumns.length === 2 && kanbanColumns[0].items[0].text === word("kanban"),
    kanbanColumns
  );

  // --- Locked: out of reach, as if it didn't exist ---

  const toLock = await first.create({
    type: "text",
    title: `E2E ${word("locktitle")}`,
    text: `<p>${word("lock")}</p>`,
  });
  created.push(toLock.id);
  ok(
    "before the lock, search finds it",
    found(await first.search(word("lock"))).some((note) => note.id === toLock.id)
  );
  const locking = await first.flags({ id: toLock.id, locked: true });
  ok("set_note_flags locks it", !locking.isError && body(locking).locked === true, locking);
  ok("a locked note created here: unknown afterwards", sameAnswer(await first.read(toLock.id), await first.read(madeUpId)));
  ok(
    "edit_note and set_note_flags on it: the answer of a made-up id, even for the session that made it",
    sameAnswer(
      await first.edit({ id: toLock.id, rev: toLock.rev, title: "x" }),
      await first.edit({ id: madeUpId, rev: madeUpRev, title: "x" })
    ) && sameAnswer(await first.flags({ id: toLock.id, important: true }), await first.flags({ id: madeUpId, important: true }))
  );
  ok(
    "and the lock can't be taken off by id",
    sameAnswer(await first.flags({ id: toLock.id, locked: false }), await first.read(madeUpId))
  );
  ok("its words match nothing in search", found(await first.search(word("lock"))).length === 0);
  ok("nor does its title", found(await first.search(word("locktitle"))).length === 0);
  ok(
    "a search with no query leaves it out",
    !found(await first.call("fastmemo_search_notes", { limit: 50 })).some((note) => note.id === toLock.id)
  );

  const lockedAtBirth = await first.call("fastmemo_create_note", {
    type: "text",
    title: `E2E ${word("borntitle")}`,
    text: `<p>${word("born")}</p>`,
    locked: true,
  });
  ok(
    "created as locked: the reply confirms it and carries no id",
    !lockedAtBirth.isError && lockedAtBirth.text === "Created.",
    lockedAtBirth
  );
  ok(
    "its words match nothing in search",
    found(await first.search(word("born"))).length === 0 && found(await first.search(word("borntitle"))).length === 0
  );

  // --- Flags ---

  const flagged = await first.create({ type: "text", title: `E2E flags ${stamp}`, text: "<p>flags</p>" });
  created.push(flagged.id);
  const looseLock = await first.flags({ id: flagged.id, locked: false });
  const looseReadOnly = await first.flags({ id: flagged.id, readOnly: false });
  ok("flags can't be loosened", looseLock.isError === true && looseReadOnly.isError === true, { looseLock, looseReadOnly });
  const important = await first.flags({ id: flagged.id, important: true });
  const notImportant = await first.flags({ id: flagged.id, important: false });
  ok("important goes both ways", body(important).important === true && body(notImportant).important === false, {
    important,
    notImportant,
  });
  await first.flags({ id: flagged.id, readOnly: true });
  const stillReadOnly = await first.flags({ id: flagged.id, readOnly: false });
  ok(
    "read-only stays on once set",
    stillReadOnly.isError === true && body(await first.read(flagged.id)).readOnly === true,
    stillReadOnly
  );

  // --- The session right, with the edit_note switch off ---

  const own = await first.create({ type: "text", title: `E2E own ${stamp}`, text: "<p>own</p>" });
  created.push(own.id);
  const edited = await first.edit({ id: own.id, rev: own.rev, appendHtml: `<p>${word("append")}</p>` });
  const ownRead = await first.read(own.id);
  ok(
    "edit_note off, own note: works",
    !edited.isError && body(edited).rev !== own.rev && body(ownRead).content.includes(word("append")),
    { edited, ownRead }
  );
  const stale = await first.edit({ id: own.id, rev: own.rev, appendHtml: "<p>stale</p>" });
  ok(
    "an old rev is refused, and nothing changes",
    stale.isError === true && !body(await first.read(own.id)).content.includes("stale"),
    stale
  );

  const ownReadOnly = await first.create({ type: "text", title: `E2E own read-only ${stamp}`, text: "<p>own</p>" });
  created.push(ownReadOnly.id);
  const madeReadOnly = await first.flags({ id: ownReadOnly.id, readOnly: true });
  const readOnlyEdit = await first.edit({ id: ownReadOnly.id, rev: body(madeReadOnly).rev, appendHtml: "<p>no</p>" });
  ok("edit_note off, own note after the note is read-only: refused", readOnlyEdit.isError === true, readOnlyEdit);

  const second = new Bridge();
  await second.initialize();
  const ownRev = body(await second.read(own.id)).rev;
  const secondEdit = await second.edit({ id: own.id, rev: ownRev, appendHtml: "<p>second</p>" });
  ok("a second bridge can't edit the first one's note", secondEdit.isError === true, secondEdit);
  ok("though the first still can", !(await first.edit({ id: own.id, rev: ownRev, title: `E2E own again ${stamp}` })).isError);
  const theirs = await second.create({ type: "text", title: `E2E second ${stamp}`, text: "<p>second</p>" });
  created.push(theirs.id);
  const firstEdit = await first.edit({ id: theirs.id, rev: theirs.rev, appendHtml: "<p>first</p>" });
  ok("nor the first the second's", firstEdit.isError === true, firstEdit);
  await second.close();

  const afterEdits = body(await first.read(own.id));
  ok("what they tried isn't in the note", !afterEdits.content.includes("second"), afterEdits);
  await first.close();

  const third = new Bridge();
  await third.initialize();
  const thirdEdit = await third.edit({ id: own.id, rev: afterEdits.rev, appendHtml: "<p>third</p>" });
  ok("a new session can't edit it either", thirdEdit.isError === true, thirdEdit);

  // --- The rest ---

  const trash = await third.call("fastmemo_trash_note", { id: own.id });
  ok("trash_note off: refused", trash.isError === true && trash.text.includes("switched off"), trash);
  ok("and the note is still there", !(await third.read(own.id)).isError);

  const topics = await third.call("fastmemo_help");
  const topicList = topics.isError ? [] : body(topics).topics;
  const topicText = topicList.length ? await third.call("fastmemo_help", { topic: topicList[0].key }) : null;
  ok(
    "help lists topics and returns text",
    topicList.length > 0 &&
      topicList.every((topic) => topic.key && topic.title && topic.category) &&
      topicText?.isError === false &&
      body(topicText).text.trim().length > 0,
    { topics, topicText }
  );
  ok("a topic that doesn't exist is an error", (await third.call("fastmemo_help", { topic: "nope" })).isError === true);

  const update = await third.call("fastmemo_check_update");
  ok("check_update answers", /is installed|couldn't check for updates/.test(update.text), update);
  console.log(`      (${update.isError ? "tool error" : "answer"}: ${update.text})`);

  if (names.includes("fastmemo_trash_note")) {
    for (const id of created) await third.call("fastmemo_trash_note", { id });
  }

  if (restart) await restartChecks(third);
  await third.close();

  ok(
    "stdout carried JSON-RPC only, on every bridge",
    Bridge.started.every((bridge) => bridge.notJsonRpc.length === 0),
    Bridge.started.flatMap((bridge) => bridge.notJsonRpc)
  );
}

/** Asks until `done` says so, or the time is up. Returns the last answer. */
async function callUntil(ask, done, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    const reply = await ask();
    if (done(reply) || Date.now() > deadline) return reply;
    await sleep(500);
  }
}

/** macOS: the test app goes away under a bridge left running, and comes back. */
async function restartChecks(bridge) {
  const app = binary.replace(/\/Contents\/MacOS\/[^/]+$/, "");
  const ask = () => bridge.call("fastmemo_list_categories");
  const lastWrite = await bridge.create({
    type: "text",
    title: `E2E before the quit ${Date.now().toString(36)}`,
    text: "<p>saved</p>",
  });

  execFileSync("osascript", ["-e", 'tell application "Fast Memo Test" to quit']);
  const away = await callUntil(ask, (reply) => reply.text.includes("isn't reachable"), 20_000);
  ok(
    "app quit: a call on the bridge left running says it isn't reachable",
    away.isError === true && away.text.includes("isn't reachable"),
    away
  );
  console.log(`      (${away.text})`);
  const list = await bridge.request("tools/list");
  ok("and the tools are still listed, from what's compiled in", list.result?.tools?.length === 9, list);

  execFileSync("open", ["-a", app]);
  const back = await callUntil(ask, (reply) => !reply.isError, APP_WAIT_MS);
  ok("reopened: the same bridge works, with no client restart", back.isError === false, back);
  const kept = await bridge.read(lastWrite.id);
  ok("and a note written right before the quit is there: it was on disk when answered", kept.isError === false, kept);
}

/** The window-closed check: a bridge left idle, then calls after a long while, each timed. */
async function waitChecks() {
  const timed = async (name, call) => {
    const start = performance.now();
    const reply = await call();
    const ms = Math.round(performance.now() - start);
    ok(`${name}: answered in ${ms} ms`, !reply.isError && ms < CLOSED_WINDOW_LIMIT_MS, reply);
    console.log(`      (${reply.text.slice(0, 200)})`);
    return reply;
  };
  const stamp = Date.now().toString(36);

  const held = new Bridge();
  await held.initialize();
  const before = await waitForPage(held);
  if (before.isError) throw new Error(`the test app doesn't answer: is it open, with MCP on? ${before.text}`);
  console.log(`Started ${new Date().toISOString()}, waiting ${waitMinutes} minutes with no calls...`);
  await sleep(waitMinutes * 60_000);
  console.log(`Woke ${new Date().toISOString()}`);

  await timed("a call on the bridge held all along", () => held.call("fastmemo_search_notes", { limit: 1 }));
  const fresh = new Bridge();
  await fresh.initialize();
  await timed("a call on a new bridge", () => fresh.call("fastmemo_list_categories"));
  const write = await timed("a write, on disk before it's answered", () =>
    held.call("fastmemo_create_note", { type: "text", title: `E2E closed window ${stamp}`, text: "<p>closed window</p>" })
  );
  await timed("reading it back", () => fresh.call("fastmemo_read_note", { id: body(write).id }));
  await Promise.all([held.close(), fresh.close()]);
}

try {
  await (waitMinutes !== null ? waitChecks() : runChecks());
} catch (err) {
  ok("the run reached its end", false, err.message);
}
Bridge.started.forEach((bridge) => bridge.child.kill());

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed === 0 ? 0 : 1);
