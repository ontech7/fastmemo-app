import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { go } from "@codemirror/lang-go";
import { yaml } from "@codemirror/lang-yaml";

const LANG_MAP = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  html: () => html(),
  css: () => css(),
  scss: () => css(),
  json: () => json(),
  xml: () => xml(),
  markdown: () => markdown(),
  sql: () => sql(),
  java: () => java(),
  c: () => cpp(),
  cpp: () => cpp(),
  csharp: () => cpp(),
  objectivec: () => cpp(),
  rust: () => rust(),
  php: () => php(),
  go: () => go(),
  yaml: () => yaml(),
  swift: () => cpp(),
  kotlin: () => java(),
  dart: () => cpp(),
  scala: () => java(),
};

function getLangExtension(lang) {
  const factory = LANG_MAP[lang];
  const ext = factory ? factory() : null;
  return ext ? [ext] : [];
}

function getBaseExtensions(readOnly) {
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
    EditorView.lineWrapping ? undefined : undefined,
    EditorState.readOnly.of(readOnly),
  ].filter(Boolean);
}

// Read initial config from a global set before this script runs
const config = window.__EDITOR_CONFIG__ || {};
let currentLang = config.language || "javascript";
let currentReadOnly = config.readOnly || false;
let view;
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

view = new EditorView({
  doc: config.code || "",
  extensions: [...getBaseExtensions(currentReadOnly), changeListener, ...getLangExtension(currentLang)],
  parent: document.getElementById("editor"),
});

window.handleMessage = function (msgStr) {
  try {
    const msg = JSON.parse(msgStr);
    if (msg.type === "setCode") {
      suppressChange = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: msg.code } });
      suppressChange = false;
    } else if (msg.type === "setLanguage" && msg.language !== currentLang) {
      currentLang = msg.language;
      const doc = view.state.doc.toString();
      const sel = view.state.selection;
      view.destroy();
      view = new EditorView({
        doc,
        selection: sel,
        extensions: [...getBaseExtensions(currentReadOnly), changeListener, ...getLangExtension(currentLang)],
        parent: document.getElementById("editor"),
      });
    } else if (msg.type === "setReadOnly") {
      currentReadOnly = msg.readOnly;
      const doc = view.state.doc.toString();
      const sel = view.state.selection;
      view.destroy();
      view = new EditorView({
        doc,
        selection: sel,
        extensions: [...getBaseExtensions(currentReadOnly), changeListener, ...getLangExtension(currentLang)],
        parent: document.getElementById("editor"),
      });
    }
  } catch (e) {}
};

sendToReact(JSON.stringify({ type: "ready" }));
