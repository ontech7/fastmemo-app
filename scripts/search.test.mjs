// What a search reads of a note and how it finds it (spec A.1, A.2; ADR-040): folding, a note's lines, tags, the query,
// the groups and the line shown under a result.
// Run: node scripts/search.test.mjs

import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "src");
const out = join(os.tmpdir(), "search.bundle.mjs");

await build({
  stdin: {
    contents: `export * from "@/libs/search/fold"; export * from "@/libs/search/tags"; export * from "@/libs/search/lines"; export * from "@/libs/search/search";`,
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
const { fold, tagsIn, tagCounts, htmlLines, noteDoc, parseQuery, searchNotes, cutLine, LINE_MAX } = await import(
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
    console.error(`  ✗ ${name}${detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  }
};

console.log("\n=== What a search reads and finds ===");
const base = {
  title: "",
  category: { icon: "work", name: "Lavoro", index: false, order: 1, selected: false },
  important: false,
  locked: false,
  readOnly: false,
  hidden: false,
  deleteDate: null,
  createdAt: 1,
  updatedAt: 1,
  date: "",
};
const text = (id, title, html, extra = {}) => ({ ...base, id, type: "text", title, text: html, ...extra });
const todo = (id, title, items, extra = {}) => ({
  ...base,
  id,
  type: "todo",
  title,
  list: items.map((t, i) => ({ id: "i" + i, text: t, checked: i % 2 === 1 })),
  ...extra,
});
const board = (id, title, cols, extra = {}) => ({
  ...base,
  id,
  type: "kanban",
  title,
  ...extra,
  columns: cols.map(([name, ...cards], i) => ({
    id: "c" + i,
    name,
    color: "",
    items: cards.map((t, j) => ({ id: "k" + i + j, text: t })),
  })),
});
const code = (id, title, tabs, extra = {}) => ({
  ...base,
  id,
  type: "code",
  title,
  activeTabId: "t0",
  ...extra,
  tabs: tabs.map(([t, c], i) => ({ id: "t" + i, title: t, code: c, language: "python" })),
});
const all = { categoryIcon: null, showHidden: false };
const find = (notes, q, scope = all) => searchNotes(notes, noteDoc, q, scope);
const ids = (hits) => hits.map((h) => h.note.id).join();

// fold
ok("case and accents", fold("Città ÉCOLE Straße") === "citta ecole straße");
ok(
  "same length, other scripts untouched",
  ["が한😀İ", "ǅ", "ﬁ", "é"].every((s) => fold(s).length === s.length) && fold("が") === "が" && fold("한") === "한"
);
// lines
ok(
  "a text note's lines",
  htmlLines(
    "<div>com<b>pra</b>re il <i>panettone</i></div><div><br></div><h1>Lista &amp; idee</h1><ul><li>uno</li><li>due&nbsp;tre</li></ul>"
  ).join("|") === "comprare il panettone|Lista & idee|uno|due tre"
);
ok(
  "a picture is skipped",
  htmlLines('<div>prima<img src="data:image/jpeg;base64,' + "A".repeat(300000) + '">dopo</div>').join("|") === "primadopo"
);
ok("markup is not text", htmlLines('<div class="segreto" title="a>b">x</div>').join("|") === "x");
ok("code block lines", htmlLines("<pre>a = 1\nb = 2</pre>").join("|") === "a = 1|b = 2");
ok("entities", htmlLines("<div>&#233;t&#xE9; &lt;b&gt;</div>")[0] === "été <b>");
ok(
  "a checkbox line gives its text",
  htmlLines(
    '<ol class="x-todo"><li><span class="x-todo-box" contenteditable="false"><input type="checkbox" checked=""></span>Latte</li></ol>'
  ).join("|") === "Latte"
);
ok(
  "list",
  noteDoc(todo("l", "Spesa", ["Torrone", "Pane\nintegrale"]))
    .lines.map((l) => l.text)
    .join("|") === "Torrone|Pane|integrale"
);
const b = noteDoc(board("b", "Progetto", [["Da fare", "Regalo Anna"], ["Fatto"]]));
ok(
  "board: column names, cards with their column",
  b.lines.map((l) => (l.label ?? "-") + ":" + l.text).join("|") === "-:Da fare|Da fare:Regalo Anna|-:Fatto"
);
const c = noteDoc(code("c", "Script #util", [["main.c", "#include <stdio.h>\nint x;"]]));
ok(
  "code: tab title, mono lines, the tab's id",
  c.lines.map((l) => (l.mono ? "m" : "-") + l.tabId + ":" + l.text).join("|") === "-t0:main.c|mt0:#include <stdio.h>|mt0:int x;"
);
ok("no tag from code", c.tags.map((t) => t.key).join() === "util");
const prot = text("p", "Banca #conti", "<div>pin 1234 #segreto</div>", { locked: true });
ok(
  "a protected note has no content anywhere",
  noteDoc(prot).lines.length === 0 &&
    noteDoc(prot).folded.length === 0 &&
    !JSON.stringify(noteDoc(prot)).includes("1234") &&
    noteDoc(prot)
      .tags.map((t) => t.key)
      .join() === "conti"
);
ok(
  "unknown type and missing parts",
  noteDoc({ ...base, id: "u", type: "board", title: "Lavagna" }).lines.length === 0 &&
    noteDoc({ ...base, id: "k", type: "kanban" }).lines.length === 0 &&
    noteDoc({ id: "y", type: "code" }).title === ""
);
// tags
ok(
  "what is a tag",
  tagsIn("#lavoro e #Casa-2 ma non a#b, #1no, #fff, #A1B2C3, #12345678 #décor #lavoro")
    .map((t) => t.key + "/" + t.label)
    .join() === "lavoro/lavoro,casa-2/casa-2,decor/décor"
);
ok("40 characters at most", tagsIn("#" + "z".repeat(40)).length === 1 && tagsIn("#" + "z".repeat(41)).length === 0);
ok("a new line counts as a start", tagsIn("x\n#due").length === 1);
ok("other scripts", tagsIn("今日は #買い物 です")[0].key === "買い物");
const tagged = [
  text("1", "A", "<div>#lavoro #casa</div>"),
  todo("2", "B #lavoro", ["x"]),
  board("3", "C", [["#lazio", "#lavoro"]]),
  prot,
];
ok(
  "counts, most used first",
  tagCounts(tagged.map(noteDoc), "")
    .map((t) => t.key + t.count)
    .join() === "lavoro3,casa1,conti1,lazio1"
);
ok(
  "prefix",
  tagCounts(tagged.map(noteDoc), "la")
    .map((t) => t.key)
    .join() === "lavoro,lazio"
);
// search
ok("nothing typed", find(tagged, "  ") === null);
ok("case and accents in a search", ids(find([text("1", "Viaggio", "<div>La Città vecchia</div>")], "citta").here) === "1");
const natale = text("1", "Spesa di Natale", "<div>comprare il panettone</div>");
ok(
  "several words, any order, title and content",
  ids(find([natale], "panettone  NATALE").here) === "1" && find([natale], "natale pandoro").here.length === 0
);
ok(
  "every type",
  ids(
    find(
      [
        todo("1", "", ["Torrone"]),
        board("2", "", [["Da Fare", "Regalo Anna"]]),
        code("3", "", [["Lista.py", "print('ciao')"]]),
      ],
      "o"
    ).here
  ) === "1,2,3" &&
    ids(find([board("2", "", [["Da Fare"]])], "da fare").here) === "2" &&
    ids(find([code("3", "", [["Lista.py", "x"]])], "lista.py").here) === "3"
);
ok("protected: by title only", find([prot], "1234").here.length === 0 && find([prot], "banca").here[0].line === undefined);
const hid = text("h", "Nascosta", "<div>x</div>", { hidden: true });
ok(
  "hidden only while shown",
  find([hid], "nascosta").here.length === 0 &&
    ids(find([hid], "nascosta", { categoryIcon: null, showHidden: true }).here) === "h"
);
const home = { icon: "home", name: "Casa", index: false, order: 2, selected: false };
const mixed = [
  text("1", "uno", "<div>latte</div>"),
  text("2", "due", "<div>latte</div>", { category: home }),
  text("3", "tre latte", ""),
];
const grouped = find(mixed, "latte", { categoryIcon: "work", showHidden: false });
ok(
  "two groups, order kept",
  ids(grouped.here) === "1,3" && ids(grouped.elsewhere) === "2" && ids(find(mixed, "latte").here) === "1,2,3"
);
const long = "a".repeat(200) + " consegna " + "b".repeat(200);
for (const [name, html] of [
  ["start", "<div>consegna " + "b".repeat(300) + "</div>"],
  ["middle", "<div>" + long + "</div>"],
  ["end", "<div>" + "a".repeat(300) + " consegna</div>"],
]) {
  const line = find([text("1", "t", html)], "consegna").here[0].line;
  ok(
    "the line, match at the " + name,
    line.text.length <= LINE_MAX + 2 &&
      line.ranges.length === 1 &&
      line.text.slice(line.ranges[0].start, line.ranges[0].end) === "consegna"
  );
}
const two = find(
  [text("1", "Ordini", "<div>altro</div><div>Sollecitare la consegna di venerdì</div><div>consegna a mano, venerdì</div>")],
  "venerdi consegna"
).here[0];
ok(
  "several words in the line, +N",
  two.line.text === "Sollecitare la consegna di venerdì" &&
    two.line.ranges.length === 2 &&
    two.line.more === 1 &&
    two.line.word === "consegna"
);
const t1 = find([text("1", "Spesa di Natale", "<div>x</div>")], "natale").here[0];
ok(
  "title only: no line, the title's range",
  t1.line === undefined &&
    t1.titleRanges.length === 1 &&
    t1.title.slice(t1.titleRanges[0].start, t1.titleRanges[0].end) === "Natale"
);
ok("the word keeps its accents", find([text("1", "t", "<div>La Città vecchia</div>")], "citta").here[0].line.word === "Città");
ok(
  "a board's line carries its column",
  find([board("2", "", [["Da fare", "Regalo Anna"]])], "anna").here[0].line.label === "Da fare"
);
ok(
  "a code line is mono and names its tab",
  (() => {
    const l = find(
      [
        code("3", "", [
          ["a.py", "x"],
          ["b.py", "print('ciao')"],
        ]),
      ],
      "ciao"
    ).here[0].line;
    return l.mono === true && l.tabId === "t1";
  })()
);
ok(
  "entities are text",
  find([text("1", "t", "<div>Tom &amp; Jerry</div>")], "&").here[0].line.text === "Tom & Jerry" &&
    find([text("1", "t", "<div>Tom &amp; Jerry</div>")], "amp").here.length === 0
);
ok("a word in the markup is not found", find([text("1", "t", '<div class="rosso">x</div>')], "rosso").here.length === 0);
ok(
  "Chinese and Japanese",
  ids(find([text("1", "买菜", "<div>今天去超市买牛奶</div>")], "牛奶").here) === "1" &&
    ids(find([text("2", "メモ", "<div>明日は買い物に行く</div>")], "買い物").here) === "2"
);
ok("( + * are plain characters", ids(find([text("1", "t", "<div>f(x) + g*h</div>")], "f(x) g*h +").here) === "1");
ok(
  "# alone lists tags and no note",
  (() => {
    const r = find(tagged, "#");
    return r.here.length === 0 && r.tags.length === 4;
  })()
);
ok(
  "#la: its tags, and the notes that hold one",
  (() => {
    const r = find(tagged, "#la");
    return r.tags.map((t) => t.key).join() === "lavoro,lazio" && ids(r.here) === "1,2,3";
  })()
);
ok(
  "the word without # finds the tag too, and lists no tags",
  (() => {
    const r = find(tagged, "lavoro");
    return ids(r.here) === "1,2,3" && r.tags.length === 0;
  })()
);
ok(
  "a protected note's tags come from its title only",
  find(tagged, "#segreto").here.length === 0 && ids(find(tagged, "#conti").here) === "p"
);
// speed
const many = Array.from({ length: 2000 }, (_, i) =>
  text("n" + i, "Prova " + i, "<div>" + "parola ".repeat(120) + "numero " + i + "</div>")
);
const docs = new Map(many.map((n) => [n, noteDoc(n)]));
const t0 = performance.now();
const r = searchNotes(many, (n) => docs.get(n), "prova 17 numero", all);
const ms = performance.now() - t0;
ok("2,000 notes in under 50 ms (" + ms.toFixed(1) + " ms)", ms < 50 && r.here.length > 0);

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);
