import { Decoration, EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { Compartment, EditorSelection, EditorState, StateEffect, StateField, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, SearchCursor } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

// Grammars load on demand: esbuild bundles each dynamically imported language as a module that is
// only initialized when first imported, so opening a code note no longer builds the parse tables of
// every supported language.
const LANG_LOADERS = {
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  tsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  scss: () => import("@codemirror/lang-css").then((m) => m.css()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  csharp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  objectivec: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  php: () => import("@codemirror/lang-php").then((m) => m.php()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  swift: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  kotlin: () => import("@codemirror/lang-java").then((m) => m.java()),
  dart: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  scala: () => import("@codemirror/lang-java").then((m) => m.java()),
};

const loadedLanguages = {};

function loadLanguage(lang) {
  const load = LANG_LOADERS[lang];
  if (!load) return Promise.resolve([]);
  return load().then((ext) => (loadedLanguages[lang] = [ext]));
}

// Language and read-only mode are reconfigured in place, which keeps the undo history (rebuilding
// the view to switch them used to drop it).
const languageConf = new Compartment();
const readOnlyConf = new Compartment();

function getBaseExtensions() {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    oneDark,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  ];
}

// Read initial config from a global set before this script runs
const config = window.__EDITOR_CONFIG__ || {};
let currentLang = config.language || "javascript";
let currentReadOnly = config.readOnly || false;
let suppressChange = false;
// The last document React sent (see CodeEditorWebView's docRef): changes report it.
let currentDoc = 0;

// Helper: send messages back to React on both native and web/Tauri
function sendToReact(data) {
  if (typeof window.ReactNativeWebView !== "undefined" && typeof window.ReactNativeWebView.postMessage === "function") {
    window.ReactNativeWebView.postMessage(data);
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage(data, "*");
  }
}

// Listen for messages from parent window (web/Tauri uses postMessage instead of injectJavaScript)
window.addEventListener("message", function (event) {
  if (event.source !== window.parent) return;
  if (typeof event.data === "string" && typeof window.handleMessage === "function") {
    window.handleMessage(event.data);
  }
});

// The text goes to the app when typing pauses, not on every key: each message carries the whole document, which costs
// a copy and a parse per key on a long tab. It goes out CHANGE_DEBOUNCE_MS after the last change and at the latest
// CHANGE_MAX_WAIT_MS after the first one not yet sent (a held key doesn't hold the text back), and at once when the
// editor is left, the page is hidden, or the app asks for it (`flush`: the app is going to the background). The message
// carries the document and `currentDoc` as they are when it is sent (ADR-013).
const CHANGE_DEBOUNCE_MS = 50;
const CHANGE_MAX_WAIT_MS = 250;
let changeTimer = null;
let firstPendingAt = 0;

function cancelPendingChange() {
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = null;
  firstPendingAt = 0;
}

/**
 * The `change` message of the text not yet sent, or null: it is then no longer pending. On the web the page is a
 * same-origin frame and the app calls this synchronously when it is hidden or closing, since a message posted while a
 * tab closes never arrives.
 */
window.takePendingChange = function () {
  if (!firstPendingAt) return null;
  cancelPendingChange();
  return JSON.stringify({ type: "change", code: view.state.doc.toString(), doc: currentDoc });
};

function sendChangeNow() {
  const change = window.takePendingChange();
  if (change) sendToReact(change);
}

// The editor is left, the page is hidden or goes away: the text is posted, and stays pending. A closing tab takes the
// focus away and unloads this frame before the app's page, and a message posted then never arrives, so the app must
// still be able to take it (`takePendingChange`). If the page lives on, the armed timer sends it once more: the app
// ignores a change it already has.
function postPendingChange() {
  if (firstPendingAt) sendToReact(JSON.stringify({ type: "change", code: view.state.doc.toString(), doc: currentDoc }));
}

function scheduleChange() {
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  if (changeTimer) clearTimeout(changeTimer);
  const wait = Math.max(0, Math.min(CHANGE_DEBOUNCE_MS, firstPendingAt + CHANGE_MAX_WAIT_MS - now));
  changeTimer = setTimeout(sendChangeNow, wait);
}

const changeListener = EditorView.updateListener.of((update) => {
  if (update.docChanged && !suppressChange) scheduleChange();
});

// Find and replace (spec B.8): the app's bar sends find, findStep, findReplace, findReplaceAll and findClear, and every
// request is answered with one `found` ({ total, current }, current from 1, 0 when the selection isn't a match). The
// text typed is taken literally and compared without case. The matches are marked (the theme's search colours, the
// selected one brighter), which shows without the editor's focus: on a phone the keyboard stays down.
const setFindQuery = StateEffect.define();

function matchesOf(state, query) {
  if (!query) return [];
  const found = [];
  const cursor = new SearchCursor(state.doc, query.toLowerCase(), 0, state.doc.length, (x) => x.toLowerCase());
  while (!cursor.next().done) found.push({ from: cursor.value.from, to: cursor.value.to });
  return found;
}

const MATCH = Decoration.mark({ class: "cm-searchMatch" });
const MATCH_SELECTED = Decoration.mark({ class: "cm-searchMatch cm-searchMatch-selected" });

const findField = StateField.define({
  create: () => ({ query: "", matches: [], marks: Decoration.none }),
  update(value, tr) {
    let query = value.query;
    for (const effect of tr.effects) if (effect.is(setFindQuery)) query = effect.value;
    if (query === value.query && !tr.docChanged && !tr.selection) return value;
    const matches = query === value.query && !tr.docChanged ? value.matches : matchesOf(tr.state, query);
    const main = tr.state.selection.main;
    const marks = Decoration.set(
      matches.map((m) => (m.from === main.from && m.to === main.to ? MATCH_SELECTED : MATCH).range(m.from, m.to))
    );
    return { query, matches, marks };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.marks),
});

function findReply() {
  const { matches } = view.state.field(findField);
  const main = view.state.selection.main;
  const at = matches.findIndex((m) => m.from === main.from && m.to === main.to);
  sendToReact(JSON.stringify({ type: "found", total: matches.length, current: at + 1 }));
}

// The match `direction` of the selection, around the ends of the document; from the top when there is no selection.
function nextMatch(matches, direction) {
  const main = view.state.selection.main;
  if (direction === "prev") {
    for (let i = matches.length - 1; i >= 0; i--)
      if (matches[i].to <= main.from && matches[i].from < main.from) return matches[i];
    return matches[matches.length - 1];
  }
  return matches.find((m) => m.from >= main.to && m.to > main.from) || matches[0];
}

function selectMatch(match, extra) {
  view.dispatch({
    ...extra,
    selection: match ? EditorSelection.single(match.from, match.to) : EditorSelection.cursor(view.state.selection.main.head),
    scrollIntoView: !!match,
  });
}

function find(msg) {
  if (msg.type === "findClear") {
    view.dispatch({ effects: setFindQuery.of(""), selection: EditorSelection.cursor(view.state.selection.main.head) });
    return findReply();
  }
  // a step goes on with the query searched last
  if (msg.type !== "findStep") view.dispatch({ effects: setFindQuery.of(msg.query || "") });
  const matches = view.state.field(findField).matches;
  if (msg.type === "find") selectMatch(matches[0]);
  else if (msg.type === "findStep") {
    if (matches.length) selectMatch(nextMatch(matches, msg.direction));
  } else if (!currentReadOnly && matches.length) {
    if (msg.type === "findReplaceAll") {
      view.dispatch({
        changes: matches.map((m) => ({ from: m.from, to: m.to, insert: msg.replacement })),
        userEvent: "input.replace.all",
      });
    } else {
      const main = view.state.selection.main;
      const selected = matches.find((m) => m.from === main.from && m.to === main.to);
      if (selected) {
        const end = selected.from + msg.replacement.length;
        view.dispatch({
          changes: { from: selected.from, to: selected.to, insert: msg.replacement },
          selection: EditorSelection.cursor(end),
          userEvent: "input.replace",
        });
      }
      selectMatch(nextMatch(view.state.field(findField).matches, "next"));
    }
  }
  findReply();
}

// A fresh state per document (initial content, tab switch), so undo never crosses into another tab.
function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      ...getBaseExtensions(),
      readOnlyConf.of(EditorState.readOnly.of(currentReadOnly)),
      languageConf.of(loadedLanguages[currentLang] || []),
      changeListener,
      findField,
    ],
  });
}

function setLanguage(lang) {
  currentLang = lang;
  loadLanguage(lang).then((ext) => {
    if (currentLang === lang) view.dispatch({ effects: languageConf.reconfigure(ext) });
  });
}

const view = new EditorView({
  state: createState(config.code || ""),
  parent: document.getElementById("editor"),
});
setLanguage(currentLang);

view.contentDOM.addEventListener("blur", postPendingChange);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") postPendingChange();
});
window.addEventListener("pagehide", postPendingChange);

window.handleMessage = function (msgStr) {
  try {
    const msg = JSON.parse(msgStr);
    if (msg.type === "setCode") {
      const previousDoc = currentDoc;
      currentDoc = msg.doc ?? currentDoc;
      if (msg.remote) {
        // Another device's edit of this document: only the span that differs is replaced, so the cursor and selection
        // map through it, and it stays out of the undo history (undo reverts this device's own edits).
        const doc = view.state.doc.toString();
        const code = msg.code;
        let from = 0;
        while (from < doc.length && from < code.length && doc[from] === code[from]) from++;
        let tail = 0;
        while (
          tail < doc.length - from &&
          tail < code.length - from &&
          doc[doc.length - 1 - tail] === code[code.length - 1 - tail]
        ) {
          tail++;
        }
        suppressChange = true;
        view.dispatch({
          changes: { from, to: doc.length - tail, insert: code.slice(from, code.length - tail) },
          annotations: Transaction.addToHistory.of(false),
        });
        suppressChange = false;
      } else if (msg.undoable) {
        // An edit of the current document (e.g. AI-commented code): one undo step.
        suppressChange = true;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: msg.code } });
        suppressChange = false;
      } else {
        // A new document (a tab switch): the text not yet sent belonged to the one replaced. It goes now, with that
        // document's number and marked as its last (`final`): the app stores it in the tab it belongs to (any other
        // change of an old document it refuses). A remote or undoable edit leaves the timer alone: its send carries the
        // merge.
        if (firstPendingAt) {
          sendToReact(JSON.stringify({ type: "change", code: view.state.doc.toString(), doc: previousDoc, final: true }));
        }
        cancelPendingChange();
        view.setState(createState(msg.code));
      }
    } else if (msg.type === "flush") {
      sendChangeNow();
    } else if (msg.type === "focus") {
      view.focus();
    } else if (msg.type === "setLanguage" && msg.language !== currentLang) {
      setLanguage(msg.language);
    } else if (/^find(Step|Replace|ReplaceAll|Clear)?$/.test(msg.type)) {
      find(msg);
    } else if (msg.type === "setReadOnly") {
      currentReadOnly = msg.readOnly;
      view.dispatch({ effects: readOnlyConf.reconfigure(EditorState.readOnly.of(currentReadOnly)) });
    }
  } catch (e) {}
};

sendToReact(JSON.stringify({ type: "ready" }));
