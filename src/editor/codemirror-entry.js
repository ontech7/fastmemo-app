import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";
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

const changeListener = EditorView.updateListener.of((update) => {
  if (update.docChanged && !suppressChange) {
    sendToReact(JSON.stringify({ type: "change", code: update.state.doc.toString() }));
  }
});

// A fresh state per document (initial content, tab switch), so undo never crosses into another tab.
function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      ...getBaseExtensions(),
      readOnlyConf.of(EditorState.readOnly.of(currentReadOnly)),
      languageConf.of(loadedLanguages[currentLang] || []),
      changeListener,
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

window.handleMessage = function (msgStr) {
  try {
    const msg = JSON.parse(msgStr);
    if (msg.type === "setCode") {
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
        view.setState(createState(msg.code));
      }
    } else if (msg.type === "focus") {
      view.focus();
    } else if (msg.type === "setLanguage" && msg.language !== currentLang) {
      setLanguage(msg.language);
    } else if (msg.type === "setReadOnly") {
      currentReadOnly = msg.readOnly;
      view.dispatch({ effects: readOnlyConf.reconfigure(EditorState.readOnly.of(currentReadOnly)) });
    }
  } catch (e) {}
};

sendToReact(JSON.stringify({ type: "ready" }));
