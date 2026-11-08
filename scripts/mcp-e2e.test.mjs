// End-to-end test of the local MCP server: a fake AI client against a real build, through the bridge a client would start.
// Run with the test app open, MCP on and the default switches (`{"enabled": true}` in its mcp.json):
//   node scripts/mcp-e2e.test.mjs "<test app>/Contents/MacOS/Fast Memo Test"
// Options:
//   --restart           macOS: also quits the test app, makes a call on a bridge left running, and opens it again.
//   --wait-minutes <n>  instead of the checks: one call, <n> minutes of nothing, then timed calls. Close the window first.
// Only on a store with nothing in it that this script didn't make, or it refuses: a test build's store may hold real notes, a
// failing check prints what it got, and whoever reads that may be an AI agent. On a Mac that means a build with a throwaway
// identifier: a copy of src-tauri/tauri.test.conf.json with its own `identifier`, passed to `tauri build -c` (ADR-032).
// Any binary but the test one is refused. Titles are unique per run. The notes stay in that store (trashed if `trash_note`
// happens to be on): remove its data afterwards. Hidden notes can't be made here: see scripts/mcp.test.mjs.

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
/** Every note this script makes has a title starting with this. */
const TITLE_PREFIX = "E2E ";
/** `NOT_FOUND` in `src/libs/mcp/policy.ts`: the answer of an id out of reach, and of one that doesn't exist. */
const UNKNOWN_NOTE = "No note with this id.";
/** The refusals the checks expect, each with its own reason (`handlers.ts`). The write cap's isn't any of them. */
const ONLY_TRUE = /can only be set to true/;
const STALE_REV = /changed since it was read/;
const READ_ONLY = /read-only/;
const OUT_OF_SCOPE = /only notes created in this session can be edited/;
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
const refusedFor = (reply, reason) => reply.isError === true && reason.test(reply.text);
/** Both are the answer an id that doesn't exist gets. */
const sameAnswer = (a, b) => a.isError === true && b.isError === true && a.text === UNKNOWN_NOTE && b.text === UNKNOWN_NOTE;

/** A search's notes. One that failed ends the run: "matches nothing" is what guards locked notes, and an error isn't that. */
const found = (reply) => {
  const notes = reply.isError ? null : body(reply).notes;
  if (!Array.isArray(notes)) throw new Error(`a search didn't answer: ${reply.text}`);
  return notes;
};

/** Asks until the page answers: the bridge answers from the first moment, the page once the store has rehydrated. */
async function waitForPage(bridge) {
  const deadline = Date.now() + APP_WAIT_MS;
  for (;;) {
    const reply = await bridge.call("fastmemo_list_categories");
    if (!reply.isError || Date.now() > deadline) return reply;
    await sleep(1000);
  }
}

/** Ends the run on a store holding a note this script didn't make. It says nothing about the note. */
async function refuseOtherNotes(bridge) {
  let offset = 0;
  while (offset !== undefined) {
    const page = await bridge.call("fastmemo_search_notes", { limit: 50, offset });
    if (found(page).some((note) => !note.title?.startsWith(TITLE_PREFIX))) {
      throw new Error(
        "Refused: this store holds notes this script didn't make. Use a throwaway identifier (see the top of this file)."
      );
    }
    offset = body(page).nextOffset;
  }
}

/** A session of its own for each section: a connection may make 30 writes a minute (`WRITES_PER_MINUTE`), and the run makes more. */
async function newSession() {
  const bridge = new Bridge();
  await bridge.initialize();
  return bridge;
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
  await refuseOtherNotes(first);
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

  const content = await newSession();
  const emoji = "🦊🧠";
  const roundTrip = await content.create({
    type: "text",
    title: `E2E emoji ${emoji} ${stamp}`,
    text: `<p>${word("round")} ${emoji} caffè</p>`,
  });
  created.push(roundTrip.id);
  const roundRead = await content.read(roundTrip.id);
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
    found(await content.search(word("round"))).some((note) => note.id === roundTrip.id)
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
  const rich = await content.create({ type: "text", title: `E2E testo ${stamp}`, text: richHtml });
  created.push(rich.id);
  const richContent = body(await content.read(rich.id)).content;
  const richTags = ["h1", "h2", "h3", "strong", "em", "code", "a", "ul", "ol", "li", "blockquote", "pre"];
  ok(
    "the tags create_note's description lists survive the real sanitizer",
    richTags.every((tag) => richContent.includes(`<${tag}`)),
    richContent
  );

  const hostile = await content.create({
    type: "text",
    title: `E2E hostile ${stamp}`,
    text: `<p onclick="alert(1)">${word("hostile")}</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>`,
  });
  created.push(hostile.id);
  const hostileContent = body(await content.read(hostile.id)).content;
  ok(
    "hostile HTML comes out sanitized by the real DOMPurify",
    hostileContent.includes(word("hostile")) && !/<script|onclick|javascript:/i.test(hostileContent),
    hostileContent
  );

  const todo = await content.create({
    type: "todo",
    title: `E2E todo ${stamp}`,
    items: [{ text: word("todo") }, { text: "Fatto", checked: true }],
  });
  created.push(todo.id);
  const todoList = JSON.parse(body(await content.read(todo.id)).content);
  ok(
    "a todo note reads back with its items",
    todo.type === "todo" && todoList.length === 2 && todoList[0].text === word("todo") && todoList[1].checked === true,
    todoList
  );

  const code = await content.create({
    type: "code",
    title: `E2E code ${stamp}`,
    tabs: [{ title: "main.py", language: "python", code: `print("${word("code")}")\n` }],
  });
  created.push(code.id);
  const codeTabs = JSON.parse(body(await content.read(code.id)).content);
  ok(
    "a code note reads back with its tab",
    code.type === "code" &&
      codeTabs.length === 1 &&
      codeTabs[0].language === "python" &&
      codeTabs[0].code.includes(word("code")),
    codeTabs
  );

  const kanban = await content.create({
    type: "kanban",
    title: `E2E kanban ${stamp}`,
    columns: [{ name: "Da fare", cards: [word("kanban"), "Altra"] }, { name: "Fatto" }],
  });
  created.push(kanban.id);
  const kanbanColumns = JSON.parse(body(await content.read(kanban.id)).content);
  ok(
    "a kanban note reads back with its columns and cards",
    kanban.type === "kanban" && kanbanColumns.length === 2 && kanbanColumns[0].items[0].text === word("kanban"),
    kanbanColumns
  );
  await content.close();

  // --- Locked: out of reach, as if it didn't exist ---

  const locks = await newSession();
  const toLock = await locks.create({
    type: "text",
    title: `E2E ${word("locktitle")}`,
    text: `<p>${word("lock")}</p>`,
  });
  created.push(toLock.id);
  ok(
    "before the lock, search finds it by its words and by its title",
    found(await locks.search(word("lock"))).some((note) => note.id === toLock.id) &&
      found(await locks.search(word("locktitle"))).some((note) => note.id === toLock.id)
  );
  const locking = await locks.flags({ id: toLock.id, locked: true });
  ok("set_note_flags locks it", !locking.isError && body(locking).locked === true, locking);
  ok("a locked note created here: unknown afterwards", sameAnswer(await locks.read(toLock.id), await locks.read(madeUpId)));
  ok(
    "edit_note and set_note_flags on it: the answer of a made-up id, even for the session that made it",
    sameAnswer(
      await locks.edit({ id: toLock.id, rev: toLock.rev, title: "x" }),
      await locks.edit({ id: madeUpId, rev: madeUpRev, title: "x" })
    ) && sameAnswer(await locks.flags({ id: toLock.id, important: true }), await locks.flags({ id: madeUpId, important: true }))
  );
  ok(
    "and the lock can't be taken off by id",
    sameAnswer(await locks.flags({ id: toLock.id, locked: false }), await locks.read(madeUpId))
  );
  ok("its words match nothing in search", found(await locks.search(word("lock"))).length === 0);
  ok("nor does its title", found(await locks.search(word("locktitle"))).length === 0);
  const listed = found(await locks.call("fastmemo_search_notes", { limit: 50 }));
  ok(
    "a search with no query leaves it out, and lists the notes around it",
    !listed.some((note) => note.id === toLock.id) && listed.some((note) => note.id === kanban.id)
  );

  const lockedAtBirth = await locks.call("fastmemo_create_note", {
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
    "its words match nothing in search, nor does its title",
    found(await locks.search(word("born"))).length === 0 && found(await locks.search(word("borntitle"))).length === 0
  );
  // The same note with `locked: false`: the search above could otherwise be blind to a note just created, or to these words.
  const bornOpen = await locks.create({
    type: "text",
    title: `E2E ${word("opentitle")}`,
    text: `<p>${word("open")}</p>`,
    locked: false,
  });
  created.push(bornOpen.id);
  ok(
    "the same note unlocked is found by the same two searches",
    found(await locks.search(word("open"))).some((note) => note.id === bornOpen.id) &&
      found(await locks.search(word("opentitle"))).some((note) => note.id === bornOpen.id)
  );
  await locks.close();

  // --- Flags ---

  const flagSession = await newSession();
  const flagged = await flagSession.create({ type: "text", title: `E2E flags ${stamp}`, text: "<p>flags</p>" });
  created.push(flagged.id);
  const looseLock = await flagSession.flags({ id: flagged.id, locked: false });
  const looseReadOnly = await flagSession.flags({ id: flagged.id, readOnly: false });
  ok("flags can't be loosened", refusedFor(looseLock, ONLY_TRUE) && refusedFor(looseReadOnly, ONLY_TRUE), {
    looseLock,
    looseReadOnly,
  });
  const important = await flagSession.flags({ id: flagged.id, important: true });
  const notImportant = await flagSession.flags({ id: flagged.id, important: false });
  ok("important goes both ways", body(important).important === true && body(notImportant).important === false, {
    important,
    notImportant,
  });
  await flagSession.flags({ id: flagged.id, readOnly: true });
  const stillReadOnly = await flagSession.flags({ id: flagged.id, readOnly: false });
  ok(
    "read-only stays on once set",
    refusedFor(stillReadOnly, ONLY_TRUE) && body(await flagSession.read(flagged.id)).readOnly === true,
    stillReadOnly
  );
  await flagSession.close();

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
    refusedFor(stale, STALE_REV) && !body(await first.read(own.id)).content.includes("stale"),
    stale
  );

  const ownReadOnly = await first.create({ type: "text", title: `E2E own read-only ${stamp}`, text: "<p>own</p>" });
  created.push(ownReadOnly.id);
  const madeReadOnly = await first.flags({ id: ownReadOnly.id, readOnly: true });
  const readOnlyEdit = await first.edit({ id: ownReadOnly.id, rev: body(madeReadOnly).rev, appendHtml: "<p>no</p>" });
  ok("edit_note off, own note after the note is read-only: refused", refusedFor(readOnlyEdit, READ_ONLY), readOnlyEdit);

  const second = await newSession();
  const ownRev = body(await second.read(own.id)).rev;
  const secondEdit = await second.edit({ id: own.id, rev: ownRev, appendHtml: "<p>second</p>" });
  ok("a second bridge can't edit the first one's note", refusedFor(secondEdit, OUT_OF_SCOPE), secondEdit);
  ok("though the first still can", !(await first.edit({ id: own.id, rev: ownRev, title: `E2E own again ${stamp}` })).isError);
  const theirs = await second.create({ type: "text", title: `E2E second ${stamp}`, text: "<p>second</p>" });
  created.push(theirs.id);
  const firstEdit = await first.edit({ id: theirs.id, rev: theirs.rev, appendHtml: "<p>first</p>" });
  ok("nor the first the second's", refusedFor(firstEdit, OUT_OF_SCOPE), firstEdit);
  await second.close();

  const afterEdits = body(await first.read(own.id));
  ok("what they tried isn't in the note", !afterEdits.content.includes("second"), afterEdits);
  await first.close();

  const third = await newSession();
  const thirdEdit = await third.edit({ id: own.id, rev: afterEdits.rev, appendHtml: "<p>third</p>" });
  ok("a new session can't edit it either", refusedFor(thirdEdit, OUT_OF_SCOPE), thirdEdit);

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
    // Only a tool error is printed: what a call returned can be a note.
    ok(`${name}: answered in ${ms} ms`, !reply.isError && ms < CLOSED_WINDOW_LIMIT_MS, reply.isError ? reply : undefined);
    return reply;
  };
  const stamp = Date.now().toString(36);

  const held = await newSession();
  const before = await waitForPage(held);
  if (before.isError) throw new Error(`the test app doesn't answer: is it open, with MCP on? ${before.text}`);
  await refuseOtherNotes(held);
  console.log(`Started ${new Date().toISOString()}, waiting ${waitMinutes} minutes with no calls...`);
  await sleep(waitMinutes * 60_000);
  console.log(`Woke ${new Date().toISOString()}`);

  await timed("a call on the bridge held all along", () => held.call("fastmemo_search_notes", { limit: 1 }));
  const fresh = await newSession();
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
