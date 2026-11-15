// What may open the app from outside (spec D.1): the allow-list of links (parseLaunch), what each one does
// (planLaunch) and the one pending action (pending.ts). Pure modules, bundled with esbuild.
// Run: node scripts/launch.test.mjs

import { build } from "esbuild";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "launch.bundle.mjs");

await build({
  stdin: {
    contents: `
      export { parseLaunch, launchUrl } from "@/libs/launch/parse";
      export { planLaunch } from "@/libs/launch/plan";
      export { setPendingLaunch, takePendingLaunch, onPendingLaunch } from "@/libs/launch/pending";
      export { noteFromShare } from "@/libs/launch/share";
      export { deriveNoteTitle } from "@/utils/string";
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

const {
  parseLaunch,
  launchUrl,
  planLaunch,
  setPendingLaunch,
  takePendingLaunch,
  onPendingLaunch,
  noteFromShare,
  deriveNoteTitle,
} = await import(pathToFileURL(out).href);

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

console.log("\nthe links that open the app");
const S = ["fastmemoapptest"];
const p = (link) => parseLaunch(link, S);
ok(
  "a new note of each type",
  ["text", "todo", "kanban", "code"].every((t) => {
    const a = p(`fastmemoapptest://launch/new/${t}`);
    return a?.kind === "new" && a.type === t;
  })
);
ok("dictation", p("fastmemoapptest://launch/dictate")?.kind === "dictate");
ok(
  "a note by its id",
  (() => {
    const a = p("fastmemoapptest://launch/note/3f2a-9c_Z~12");
    return a?.kind === "note" && a.id === "3f2a-9c_Z~12";
  })()
);
ok("a share", p("fastmemoapptest://expo-sharing")?.kind === "share");
ok("a share as a path", p("/expo-sharing")?.kind === "share" && p("expo-sharing")?.kind === "share");
ok(
  "as a path, and with a trailing slash",
  p("/launch/new/todo")?.kind === "new" &&
    p("launch/dictate")?.kind === "dictate" &&
    p("fastmemoapptest://launch/dictate/")?.kind === "dictate"
);
ok(
  "a route of the app opens nothing",
  [
    "fastmemoapptest://settings/general",
    "fastmemoapptest://notes/abc",
    "fastmemoapptest://notes/new-text",
    "fastmemoapptest://secret-code",
    "fastmemoapptest://home",
    "fastmemoapptest://",
    "/settings/cloud-sync",
    "/notes/abc",
    "/",
    "",
  ].every((l) => p(l) === null)
);
ok(
  "near misses open nothing",
  [
    "fastmemoapptest://launch",
    "fastmemoapptest://launch/new",
    "fastmemoapptest://launch/new/board",
    "fastmemoapptest://launch/note/",
    "fastmemoapptest://launch/new/text/extra",
    "fastmemoapptest://launch/new/text?x=1",
    "fastmemoapptest://launch/new/text#x",
    "fastmemoapptest://expo-sharing/x",
  ].every((l) => p(l) === null)
);
ok(
  "three slashes after the scheme, or two at the end, open nothing",
  p("fastmemoapptest:///launch/dictate") === null && p("fastmemoapptest://launch/dictate//") === null
);
ok(
  "an id with characters an id never has",
  ["a/b", "a%2Fb", "..", "a b", "a?b", "<script>", "x".repeat(81)].every(
    (id) => p("fastmemoapptest://launch/note/" + id) === null
  )
);
ok("an id of 80 characters is one", p("fastmemoapptest://launch/note/" + "x".repeat(80))?.kind === "note");
ok(
  "another scheme, another case",
  [
    "FastMemoAppTest://launch/dictate",
    "FASTMEMOAPPTEST://launch/dictate",
    "fastmemoapp://launch/dictate",
    "https://launch/dictate",
    "exp+fastmemoapptest://launch/dictate",
    "intent://launch/dictate",
  ].every((l) => p(l) === null)
);
ok("the production scheme with its own list", parseLaunch("fastmemoapp://launch/new/code", ["fastmemoapp"])?.kind === "new");
ok(
  "nonsense doesn't throw",
  [null, undefined, 42, {}, "://", "%%%", "fastmemoapptest://launch/note/%E0%A4%A"].every((l) => p(l) === null)
);
ok(
  "the links the app writes are read back",
  launchUrl("fastmemoapptest", { kind: "note", id: "abc" }) === "fastmemoapptest://launch/note/abc" &&
    p(launchUrl("fastmemoapptest", { kind: "new", type: "todo" }))?.type === "todo" &&
    p(launchUrl("fastmemoapptest", { kind: "dictate" }))?.kind === "dictate"
);

console.log("\nwhat a link does");
const notes = { live: { hidden: false }, hid: { hidden: true } };
const ctx = (extra = {}) => ({ introFinished: true, showHidden: false, findNote: (id) => notes[id], ...extra });
ok(
  "before the intro is finished, nothing",
  [{ kind: "new", type: "text" }, { kind: "dictate" }, { kind: "note", id: "live" }, { kind: "share" }].every(
    (a) => planLaunch(a, ctx({ introFinished: false })).do === "nothing"
  )
);
ok(
  "a new list",
  JSON.stringify(planLaunch({ kind: "new", type: "todo" }, ctx())) ===
    JSON.stringify({ do: "open", route: "/notes/new-todo", askCode: false, dictate: false })
);
ok(
  "dictation is a new text note",
  JSON.stringify(planLaunch({ kind: "dictate" }, ctx())) ===
    JSON.stringify({ do: "open", route: "/notes/new-text", askCode: false, dictate: true })
);
ok(
  "a live note",
  planLaunch({ kind: "note", id: "live" }, ctx()).route === "/notes/live" &&
    planLaunch({ kind: "note", id: "live" }, ctx()).askCode === false
);
ok(
  "a hidden note asks the code unless hidden notes are shown",
  planLaunch({ kind: "note", id: "hid" }, ctx()).askCode === true &&
    planLaunch({ kind: "note", id: "hid" }, ctx({ showHidden: true })).askCode === false
);
ok("an id that isn't a live note", planLaunch({ kind: "note", id: "gone" }, ctx()).do === "notFound");
ok("a share", planLaunch({ kind: "share" }, ctx()).do === "share");

console.log("\nwhat a share becomes");
const sh = (...p) => noteFromShare(p);
ok(
  "text becomes paragraphs, escaped",
  sh({ value: "Prima riga <b>\n\nTerza & ultima", shareType: "text" }).html ===
    "<div>Prima riga &lt;b&gt;</div><div><br></div><div>Terza &amp; ultima</div>"
);
ok(
  "the title is the first line",
  sh({ value: "Prima riga\nseconda", shareType: "text" }).title === deriveNoteTitle("Prima riga")
);
ok(
  "an address becomes a link",
  sh({ value: "https://example.com/a?b=1", shareType: "url" }).html ===
    '<div><a href="https://example.com/a?b=1">https://example.com/a?b=1</a></div>'
);
ok(
  "an address the app wouldn't link stays text",
  sh({ value: "javascript:alert(1)", shareType: "url" }).html === "<div>javascript:alert(1)</div>"
);
ok(
  "images, in order",
  sh({ value: "content://a", shareType: "image" }, { value: "content://b", shareType: "image" }).images.join() ===
    "content://a,content://b"
);
ok(
  "text and images together",
  (() => {
    const n = sh({ value: "Guarda", shareType: "text" }, { value: "content://a", shareType: "image", mimeType: "image/png" });
    return n.html === "<div>Guarda</div>" && n.images.length === 1;
  })()
);
ok(
  "only images: no text, no title",
  (() => {
    const n = sh({ value: "content://a", shareType: "image" });
    return n.html === "" && n.title === "";
  })()
);
ok(
  "what the app can't keep",
  sh({ value: "content://v", shareType: "video" }, { value: "content://f", shareType: "file" }) === null &&
    sh() === null &&
    sh({ value: "   ", shareType: "text" }) === null
);
ok(
  "blank lines at the ends are dropped",
  sh({ value: "\n\n  \nUno\n\nDue\n \n", shareType: "text" }).html === "<div>Uno</div><div><br></div><div>Due</div>"
);
ok(
  "a link's text is the address as shared, its href the normalised one; the title from the address",
  (() => {
    const n = sh({ value: "example.com/x", shareType: "url" });
    return (
      n.html === '<div><a href="https://example.com/x">example.com/x</a></div>' && n.title === deriveNoteTitle("example.com/x")
    );
  })()
);
ok(
  "a quote in an address is escaped in the href",
  sh({ value: 'https://e.com/"a', shareType: "url" }).html === '<div><a href="https://e.com/&quot;a">https://e.com/"a</a></div>'
);

console.log("\nthe pending action");
let heard = 0;
const off = onPendingLaunch(() => heard++);
setPendingLaunch({ kind: "dictate" });
setPendingLaunch({ kind: "new", type: "code" });
off();
setPendingLaunch({ kind: "new", type: "code" });
ok("the newest pending action wins, and is taken once", takePendingLaunch()?.kind === "new" && takePendingLaunch() === null);
ok("listeners hear each new action while they listen", heard === 2, heard);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
