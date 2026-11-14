import { BORDER, COLOR, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { noteBlockCss } from "@/libs/noteHtml";
import { SCROLLBAR_CSS } from "@/styles/scrollbar";

/** The kinds of line of a text note. */
export type LineType = "p" | "h1" | "h2" | "quote" | "code" | "ul" | "ol" | "todo";
/** The page command that makes the caret's lines this kind, or text again if they already are. */
export const lineCommand = (type: LineType) => `window.__fm && window.__fm.toggle(${JSON.stringify(type)})`;
/** A hairline under the caret's line, the caret on a text line after it. */
export const RULE_COMMAND = "window.__fm && window.__fm.rule()";

/** What the formatting bar asks the page by name (`formatCommand`); anything else does nothing. */
export type FormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "subscript"
  | "superscript"
  | "justifyLeft"
  | "justifyCenter"
  | "code"
  | "undo"
  | "redo";
/** Where the caret is, for the bar: its line's kind and the styles on at the caret. */
export interface EditorState {
  line: LineType;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sub: boolean;
  sup: boolean;
  center: boolean;
  /** The caret is in inline code (not a code block). */
  code: boolean;
  /** The caret is in a web link (Task 13). */
  link: boolean;
}
/** The page's message with the caret's state: its data is an `EditorState`. */
export const STATE_MESSAGE = "FASTMEMO_STATE";
/** The page's message that the text was touched or clicked (the bar closes its menu). */
export const TOUCH_MESSAGE = "FASTMEMO_TOUCH";
export const formatCommand = (command: FormatCommand) => `window.__fm && window.__fm.run(${JSON.stringify(command)})`;

/** A link was tapped or clicked. `direct`: open it now (a read-only note, or Ctrl/Cmd + click). */
export const LINK_MESSAGE = "FASTMEMO_LINK";
export interface EditorLink {
  href: string;
  text: string;
  /** Where it was tapped, in the editor. */
  x: number;
  y: number;
  editable: boolean;
  direct: boolean;
}
/** Answer to `__fm.linkStart()`: what the dialog starts from. */
export const LINK_START_MESSAGE = "FASTMEMO_LINK_START";
export interface EditorLinkStart {
  text: string;
  /** The address of the link the caret is in, which is then what gets edited. */
  href: string | null;
}
/** Remembers the selection (the dialog takes the focus) and answers with LINK_START_MESSAGE. */
export const LINK_START_COMMAND = "window.__fm && window.__fm.linkStart()";
/** A link with this address and text on the remembered selection, or in place of the link being edited; literals only. */
export const linkCommand = (href: string, text: string) =>
  `window.__fm && window.__fm.link(${JSON.stringify(href)}, ${JSON.stringify(text)})`;
/** The dialog was closed with no link: the remembered selection is put back. */
export const LINK_CANCEL_COMMAND = "window.__fm && window.__fm.linkCancel()";
/** The caret's link taken away, its text kept. */
export const UNLINK_COMMAND = "window.__fm && window.__fm.unlink()";

/** `[[` was typed (or what follows it changed, or it went away): `data` is `EditorPicker`. */
export const PICKER_MESSAGE = "FASTMEMO_NOTE_PICKER";
export interface EditorPicker {
  open: boolean;
  query: string;
}
/** A key for the picker while it is open: `data` is `PickerKey`. */
export const PICKER_KEY_MESSAGE = "FASTMEMO_NOTE_PICKER_KEY";
export type PickerKey = "up" | "down" | "enter" | "escape";
/** A note link was tapped or clicked: `data` is the note's id. */
export const NOTE_LINK_MESSAGE = "FASTMEMO_NOTE_LINK";
/** A link to the note `noteId` labelled `label`: in place of `[[` and its query, or where the caret was (`pickStart`). */
export const noteLinkCommand = (noteId: string, label: string) =>
  `window.__fm && window.__fm.noteLink(${JSON.stringify(noteId)}, ${JSON.stringify(label)})`;
/** The picker closed by the app: the page stops reporting the `[[` being typed. */
export const PICKER_CLOSE_COMMAND = "window.__fm && window.__fm.closePicker()";
/** Whether the app shows rows for the picker: only then do the arrows, Enter and Esc go to it, not to the text. */
export const pickerShownCommand = (shown: boolean) => `window.__fm && window.__fm.pickerShown(${shown ? "true" : "false"})`;
/** The bar's "Link to a note": remembers the caret, since the picker's field takes the focus. */
export const PICK_START_COMMAND = "window.__fm && window.__fm.pickStart()";

/** The text editor page's look (RichEditor's `editorStyle`). */
export const RICH_TEXT_STYLE = {
  backgroundColor: "transparent",
  color: COLOR.softWhite,
  placeholderColor: COLOR.textMuted,
  cssText: `
    pre {
      background-color: ${COLOR.surfaceMuted};
      white-space: pre-wrap;
    }
    img {
      width: auto;
      border-radius: ${BORDER.normal}px;
      cursor: pointer;
    }
    /* Notes saved before RICH_TEXT_SCRIPT can hold a heading or code block in one of its kind, and lines that kept the
       look of where they came from when joined to a code block. */
    h1 h1 { font-size: inherit; margin: 0; }
    pre pre { margin: 0; padding: 0; background: none; }
    h1:empty, pre:empty { display: none; }
    pre span { font-family: inherit !important; background-color: transparent !important; white-space: inherit !important; }
    :not(pre) > code {
      font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em;
      padding: 1px 5px; border-radius: 5px; background-color: ${COLOR.surfaceMuted};
    }
    ${noteBlockCss({ text: COLOR.softWhite, muted: COLOR.textSecondary, accent: COLOR.accentMuted, line: GLASS.border, boxFill: "transparent", link: COLOR.accentSoft, pill: COLOR.accentMuted + "47", pillBorder: COLOR.accentMuted + "99", pillText: COLOR.textPrimary })}
    ${SCROLLBAR_CSS}
  `,
  // Horizontal inset lives here (not on containerStyle) so it matches the header
  // and toolbar margins on every platform: on web the webview is a plain <iframe>
  // that ignores containerStyle, so only this content padding aligns the text.
  // The gap from the toolbar is handled by editorWrapper's paddingBottom (a real
  // layout gap outside the iframe) — content padding-bottom can't do it because the
  // iframe's bottom edge is the scroll viewport edge, so the caret always lands on it.
  // The browser wraps a long word (a link, a key) only while the content is editable: a read-only note sets
  // contenteditable="false" and would scroll sideways, so the wrapping is set here for both.
  contentCSSText: `padding: ${PADDING_MARGIN.sm}px ${PADDING_MARGIN.lg}px ${PADDING_MARGIN.sm}px; overflow-wrap: break-word;`,
};

/** The page's message that an image was tapped: its data is an `EditorImage`. */
export const IMAGE_MESSAGE = "FASTMEMO_IMAGE";
/** The page's message that a change couldn't be made to an image. */
export const IMAGE_FAILED_MESSAGE = "FASTMEMO_IMAGE_FAILED";
/**
 * The page's count of the characters it shows (its `data`, a number: the text without line breaks), posted once when the
 * script installs and after every change of the content, whoever made it: the app doesn't parse the note at each pause.
 */
export const COUNT_MESSAGE = "FASTMEMO_COUNT";

/** A tapped image, as the page describes it. */
export interface EditorImage {
  /** Which image of the note, and its data when tapped: a change for an image that has changed since does nothing. */
  index: number;
  key: string;
  src: string;
  /** Its own size, in pixels. */
  width: number;
  height: number;
  /** Its width in the note ("50%"), or "" for its own. */
  size: string;
  /** Its line's CSS text-align. */
  align: string;
  /** Where it was tapped, in the editor. */
  x: number;
  y: number;
  /** The note can be changed (not read-only). */
  editable: boolean;
  /** Not in a code block, which stays a plain `<pre>` (ADR-023). */
  alignable: boolean;
  /** A JPEG, PNG or WebP of the note: a GIF would stop moving, a linked image can't be read. */
  rotatable: boolean;
}

export type ImageChange = "size" | "align" | "rotate" | "delete";

/** The page command for a change to a tapped image (RichEditor.command); every value is a literal, whatever it holds. */
export const imageCommand = (image: EditorImage, change: ImageChange, value?: string) =>
  `window.__fm && window.__fm.image(${[image.index, image.key, change, value ?? null].map((v) => JSON.stringify(v)).join(", ")})`;

/**
 * What the text editor's page runs besides pell (react-native-pell-rich-editor), injected once it is up
 * (`RichEditor.command`). Pell's own block buttons nest an element in one of its kind on every press (a heading inside a
 * heading, a code block inside a code block), mix them (a list inside a heading or a code block) and never turn them off.
 * Here a line is one of text, heading 1 or 2, quote, code, or a bullet, numbered or checkbox item, and pressing the button
 * of what it already is turns it back into text. Most changes go through `execCommand`, so the editor's undo keeps working
 * (only the repair of markup saved before this, which undo keeps, doesn't); a checkbox list's items, a rule and Enter in a
 * checkbox or quote line are the page's own changes, with an undo of its own (`pageChange`).
 * Tested by `scripts/richtext.test.mjs` on the real page.
 */
export const RICH_TEXT_SCRIPT = String.raw`
(function () {
  if (window.__fm) return;
  var $ = document;
  var content = function () { return $.querySelector(".pell-content"); };
  // The browser's own execCommand: document.execCommand's undo and redo go through the page's history first (below).
  var nativeExec = $.execCommand.bind($);
  // formatBlock stops at a contenteditable="false" element, which would split a line holding a note link: for it, the
  // links are plain inline elements (their attributes back in the same order after).
  var exec = function (command, value) {
    if (command !== "formatBlock") return nativeExec(command, false, value === undefined ? null : value);
    var pills = [].slice.call(content().querySelectorAll('a[href^="#fm-note-"][contenteditable="false"]'));
    pills.forEach(function (a) { a.removeAttribute("contenteditable"); });
    try { return nativeExec(command, false, value); } finally {
      // the moved lines are the browser's copies: theirs too
      pills.forEach(function (a) { a.setAttribute("contenteditable", "false"); });
      [].forEach.call(content().querySelectorAll('a[href^="#fm-note-"]:not([contenteditable])'), function (a) {
        a.setAttribute("contenteditable", "false");
      });
    }
  };
  var selection = function () { return $.getSelection(); };
  var element = function (node) { return node && (node.nodeType === 1 ? node : node.parentNode); };
  var closest = function (node, selector) {
    var c = content(), e = element(node);
    e = e && e.closest(selector);
    return e && e !== c && c.contains(e) ? e : null;
  };
  var isList = function (type) { return type === "ul" || type === "ol"; };
  // A checkbox list is the editor library's own: <ol class="x-todo">, each item starting with its box.
  var isTodo = function (list) { return list.nodeName === "OL" && list.classList.contains("x-todo"); };
  var isTodoItem = function (e) { return e.nodeName === "LI" && isTodo(e.parentNode); };
  var listKind = function (list) { return isTodo(list) ? "todo" : list.nodeName === "OL" ? "ol" : "ul"; };
  var typeAt = function (node) {
    if (closest(node, "pre")) return "code";
    if (closest(node, "h1")) return "h1";
    if (closest(node, "h2")) return "h2";
    var li = closest(node, "li");
    if (li) return listKind(li.parentNode);
    if (closest(node, "blockquote")) return "quote";
    return "p";
  };
  var BLOCK = { h1: "h1", h2: "h2", quote: "blockquote", code: "pre" };
  var touched = function (range, selector) {
    return [].filter.call(content().querySelectorAll(selector), function (e) { return range.intersectsNode(e); });
  };
  var select = function (range) {
    selection().removeAllRanges();
    selection().addRange(range);
  };
  var selectContents = function (e) {
    var r = $.createRange();
    r.selectNodeContents(e);
    select(r);
  };
  var refreshToolbar = function () { content().dispatchEvent(new Event("touchend")); };

  // The selection as character offsets, which survive the block changes (they move text, they don't change it). A code
  // block's "\n" line breaks become <br>s out of it, so they don't count.
  var textOffset = function (node, offset) {
    var r = $.createRange();
    r.selectNodeContents(content());
    r.setEnd(node, offset);
    return r.toString().replace(/\n/g, "").length;
  };
  // Where in text its count-th character that isn't a "\n" ends.
  var indexIn = function (text, count) {
    for (var i = 0; count > 0; i++) if (text[i] !== "\n") count--;
    return i;
  };
  var atNodeStart = function (node, offset) {
    return node.nodeType === 3 ? offset === 0 : offset < node.childNodes.length;
  };
  var pointAt = function (at, preferNext) {
    var w = $.createTreeWalker(content(), NodeFilter.SHOW_TEXT), n, seen = 0, last = null;
    while ((n = w.nextNode())) {
      var end = seen + n.data.replace(/\n/g, "").length;
      if (at < end || (at === end && !preferNext)) return [n, indexIn(n.data, at - seen)];
      if (at === end) last = [n, indexIn(n.data, at - seen)];
      seen = end;
    }
    return last;
  };
  var keepSelection = function (change) {
    var s = selection();
    // An empty line has no text to find the caret by: there the commands' own placement is right.
    if (!s.rangeCount || !(closest(s.focusNode, "li,h1,h2,blockquote,pre,div") || content()).textContent) return change();
    var a = [textOffset(s.anchorNode, s.anchorOffset), atNodeStart(s.anchorNode, s.anchorOffset)];
    var f = [textOffset(s.focusNode, s.focusOffset), atNodeStart(s.focusNode, s.focusOffset)];
    change();
    var pa = pointAt(a[0], a[1]), pf = pointAt(f[0], f[1]);
    if (pa && pf) s.setBaseAndExtent(pa[0], pa[1], pf[0], pf[1]);
  };

  var unwrap = function (e) {
    while (e.firstChild) e.parentNode.insertBefore(e.firstChild, e);
    e.remove();
  };
  // A code block saved by pell has one <code> per line: make them lines of the block.
  var flattenCode = function (pre) {
    [].filter.call(pre.childNodes, function (n) { return n.nodeName === "CODE"; }).forEach(function (code, i) {
      if (i > 0 && code.previousSibling && code.previousSibling.nodeName !== "BR") pre.insertBefore($.createElement("br"), code);
      unwrap(code);
    });
  };

  // The content changed by the page itself: the app is told as the library tells it (CONTENT_CHANGE, 50 ms after the
  // last change), without the library's own input handling, which reformats the line the caret is in.
  var changeTimer = null;
  var contentChanged = function () {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(function () {
      changeTimer = null;
      if (content().isContentEditable) post("CONTENT_CHANGE", content().innerHTML);
    }, 50);
  };

  // What execCommand can't write as the library writes it (a checkbox list's items and boxes, a rule, Enter in a checkbox
  // or quote line) is changed in the document directly and recorded: undo puts the very same nodes back, so the browser's
  // own history of the edits before and after it still applies. Undo and redo (the bar, the keys, execCommand) take the
  // page's change when the content is still what it left, with the very nodes it put there (the browser can rebuild the
  // same markup with nodes of its own), else the browser's. A tick isn't an edit to undo: the boxes' ticks don't count.
  var history = { undo: [], redo: [] };
  var HISTORY_LIMIT = 100;
  var snapshot = function () { return content().innerHTML.replace(/ checked=""/g, ""); };
  var caretNow = function () {
    var s = selection();
    if (!s.rangeCount || !content().contains(s.anchorNode)) return null;
    return [textOffset(s.anchorNode, s.anchorOffset), atNodeStart(s.anchorNode, s.anchorOffset),
      textOffset(s.focusNode, s.focusOffset), atNodeStart(s.focusNode, s.focusOffset)];
  };
  var putCaret = function (at) {
    if (!at) return;
    var a = pointAt(at[0], at[1]), f = pointAt(at[2], at[3]);
    if (a && f) selection().setBaseAndExtent(a[0], a[1], f[0], f[1]);
  };
  var recorded = function (change) {
    var observer = new MutationObserver(function () {});
    observer.observe(content(), { childList: true, subtree: true, attributes: true, attributeOldValue: true,
      characterData: true, characterDataOldValue: true });
    var records;
    try { change(); } finally {
      records = observer.takeRecords();
      observer.disconnect();
    }
    return records;
  };
  // The changes the records describe, taken back, the last first.
  var putBack = function (records) {
    for (var i = records.length - 1; i >= 0; i--) {
      var m = records[i];
      if (m.type === "attributes") {
        if (m.oldValue === null) m.target.removeAttribute(m.attributeName);
        else m.target.setAttribute(m.attributeName, m.oldValue);
      } else if (m.type === "characterData") m.target.data = m.oldValue;
      else {
        [].forEach.call(m.addedNodes, function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        [].forEach.call(m.removedNodes, function (n) { m.target.insertBefore(n, m.nextSibling); });
      }
    }
  };
  // A change of the page's own. keepCaret: the selection goes back where it was by its characters (a box holds none).
  var entry = function (records, caret) {
    var nodes = [];
    records.forEach(function (m) {
      [].forEach.call(m.addedNodes, function (n) { if (n.isConnected && nodes.indexOf(n) < 0) nodes.push(n); });
    });
    return { records: records, after: snapshot(), nodes: nodes, caret: caret };
  };
  var isTop = function (top) {
    return !!top && top.after === snapshot() && top.nodes.every(function (n) { return n.isConnected; });
  };
  var pageChange = function (change, keepCaret) {
    var before = caretNow();
    var records = recorded(change);
    if (keepCaret) putCaret(before);
    if (!records.length) return;
    history.undo.push(entry(records, before));
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
    contentChanged();
  };
  var step = function (from, to) {
    var top = from[from.length - 1];
    if (!isTop(top)) return false;
    from.pop();
    var at = caretNow();
    var records = recorded(function () { putBack(top.records); });
    putCaret(top.caret);
    to.push(entry(records, at));
    contentChanged();
    refreshToolbar();
    return true;
  };
  var undo = function () {
    if (!content().isContentEditable) return false;
    return step(history.undo, history.redo) || exec("undo");
  };
  var redo = function () {
    if (!content().isContentEditable) return false;
    return step(history.redo, history.undo) || exec("redo");
  };
  var pageHasTop = function (stack) { return isTop(stack[stack.length - 1]); };

  // Lines and checkbox items. A line is a list item, or a block of the note that holds no other line.
  var LINE = "li,div,p,h1,h2,blockquote,pre";
  var linesIn = function (range) {
    return [].filter.call(content().querySelectorAll(LINE), function (e) {
      if (!range.intersectsNode(e)) return false;
      if (e.nodeName === "LI") return true;
      return !closest(e.parentNode, "li") && !e.querySelector(LINE);
    });
  };
  var BOX_HTML = '<span contenteditable="false" class="x-todo-box"><input type="checkbox"></span>';
  var newBox = function () {
    var t = $.createElement("template");
    t.innerHTML = BOX_HTML;
    return t.content.firstChild;
  };
  var boxOf = function (li) {
    var f = li.firstChild;
    return f && f.nodeType === 1 && f.classList.contains("x-todo-box") ? f : null;
  };
  // No text and no picture: an empty line (a box holds neither).
  var blank = function (e) { return !e.textContent.replace(/​/g, "") && !e.querySelector("img"); };
  // An empty line needs a <br> to be a line the caret can be in.
  var fill = function (e) { if (blank(e) && !e.querySelector("br")) e.appendChild($.createElement("br")); };
  var sameList = function (a, b) {
    return !!a && a.nodeType === 1 && (a.nodeName === "UL" || a.nodeName === "OL") && listKind(a) === listKind(b);
  };
  // A list joins the lists of its kind right before and after it.
  var join = function (list) {
    var prev = list.previousSibling, next;
    if (sameList(prev, list)) {
      while (list.firstChild) prev.appendChild(list.firstChild);
      list.remove();
      list = prev;
    }
    next = list.nextSibling;
    if (sameList(next, list)) {
      while (next.firstChild) list.appendChild(next.firstChild);
      next.remove();
    }
  };
  // Every line given becomes kind: text ("p"), or an item of a list of that kind ("ul", "ol", "todo"). An item leaves its
  // list, which is split around it; a checkbox item starts with its box, and no other line has one; lists of one kind that
  // end up side by side are one list.
  var convert = function (lines, kind) {
    var lists = [], made = [];
    lines.forEach(function (line) {
      var item = line.nodeName === "LI" ? line : null;
      if (item ? listKind(item.parentNode) === kind : kind === "p" && (line.nodeName === "DIV" || line.nodeName === "P")) return;
      if (item) {
        var list = item.parentNode, rest = list.cloneNode(false);
        while (item.nextSibling) rest.appendChild(item.nextSibling);
        list.parentNode.insertBefore(rest, list.nextSibling);
        list.parentNode.insertBefore(item, rest);
        lists.push(list, rest);
        var box = boxOf(item);
        if (box && kind !== "todo") box.remove();
      }
      var holder = kind === "p" ? $.createElement("div") : item || $.createElement("li");
      if (holder !== line) {
        if (line.nodeName === "PRE") flattenCode(line);
        while (line.firstChild) holder.appendChild(line.firstChild);
        line.parentNode.replaceChild(holder, line);
      }
      if (kind === "todo" && !boxOf(holder)) holder.insertBefore(newBox(), holder.firstChild);
      fill(holder);
      made.push(holder);
      if (kind !== "p") {
        var target = $.createElement(kind === "ul" ? "ul" : "ol");
        if (kind === "todo") target.className = "x-todo";
        holder.parentNode.replaceChild(target, holder);
        target.appendChild(holder);
        lists.push(target);
      }
    });
    lists.forEach(function (list) {
      if (!list.isConnected) return;
      if (!list.firstChild) return list.remove();
      join(list);
    });
    return made;
  };
  // A change to or from a checkbox line, which is the page's own.
  var relist = function (current, type) {
    var range = function () { return selection().getRangeAt(0); };
    var items = function () { return linesIn(range()).filter(isTodoItem); };
    if (current === type) return pageChange(function () { convert(items(), "p"); }, true);
    if (type === "todo") {
      // A heading, a quote or a code block becomes text first, by the browser.
      if (!isList(current) && current !== "p") off(current);
      // A line of the note's own (text right in it) becomes a block first.
      if (!linesIn(range()).length) exec("formatBlock", "<div>");
      var made = [];
      pageChange(function () { made = convert(linesIn(range()), "todo"); }, true);
      // An empty line has no character to put the caret back by: it goes after the new box.
      if (made.length === 1 && blank(made[0]) && made[0].isConnected) caretAt(made[0], 1);
      return;
    }
    if (isList(type)) return pageChange(function () { convert(linesIn(range()), type); }, true);
    pageChange(function () { convert(items(), "p"); }, true);
    if (typeAt(range().startContainer) !== type) on(type);
  };

  var off = function (type) {
    if (isList(type)) {
      var items = linesIn(selection().getRangeAt(0)).filter(function (e) {
        return e.nodeName === "LI" && listKind(e.parentNode) === type;
      });
      return listChange(items, "p");
    }
    var range = selection().getRangeAt(0);
    touched(range, BLOCK[type]).forEach(function (block) {
      if (!block.isConnected) return;
      // Notes saved before these fixes can hold a heading around a list, or a block nested in one of its kind.
      if (block.querySelector("ul,ol,pre,h1,h2,blockquote,div")) return unwrap(block);
      if (type === "code") flattenCode(block);
      selectContents(block);
      exec("formatBlock", "<div>");
    });
  };
  // A text line holding line breaks (a code block made text, Shift + Enter): a line per part, as the browser's list does.
  var splitAtBreaks = function (line) {
    if (line.nodeName !== "DIV" && line.nodeName !== "P") return [line];
    var parts = [line], part = line;
    [].slice.call(line.childNodes).forEach(function (n) {
      if (n.nodeName !== "BR" || !n.nextSibling) return;
      var next = line.cloneNode(false);
      while (n.nextSibling) next.appendChild(n.nextSibling);
      n.remove();
      part.parentNode.insertBefore(next, part.nextSibling);
      parts.push((part = next));
    });
    return parts;
  };
  // Lines to text or to bullet / numbered items, as the page's change. split: a line with breaks is a line per part.
  var listChange = function (lines, kind, split) {
    var made = [];
    pageChange(function () {
      if (split) lines = [].concat.apply([], lines.map(splitAtBreaks));
      made = convert(lines, kind);
    }, true);
    // An empty line has no character to put the caret back by: it stays in that line.
    if (made.length === 1 && blank(made[0]) && made[0].isConnected) caretAt(made[0], 0);
  };
  // A bullet or numbered list is the page's own change, as a checkbox list is: the browser's list commands put the list
  // inside the line's block (WebKit always, Chrome on an empty line), and moving it out after them broke WebKit's undo.
  var on = function (type) {
    if (isList(type)) {
      // A line of the note's own (text right in it) becomes a block first.
      if (!linesIn(selection().getRangeAt(0)).length) exec("formatBlock", "<div>");
      return listChange(linesIn(selection().getRangeAt(0)), type, true);
    }
    exec("formatBlock", "<" + BLOCK[type] + ">");
  };

  // A line is text, a heading (1 or 2), a quote, code, or a bullet, numbered or checkbox item. Pressing the button of what
  // it is makes it text; a list item becomes another kind of item in place.
  var toggle = function (type) {
    var s = selection();
    // A read-only note (RichEditor's disabled): the repair of old markup would change it.
    if (!s.rangeCount || !content().isContentEditable || !(type === "p" || BLOCK[type] || isList(type) || type === "todo")) return;
    keepSelection(function () {
      var current = typeAt(s.getRangeAt(0).startContainer);
      if (current === "todo" || type === "todo") return relist(current, type);
      if (type === "p") return current !== "p" && off(current);
      if (current === type) return off(type);
      if (current !== "p" && !(isList(current) && isList(type))) off(current);
      if (typeAt(s.getRangeAt(0).startContainer) !== type) on(type);
    });
    refreshToolbar();
  };

  // The image goes at the caret, and the caret on a new line under it.
  var insertImage = function (src) {
    var img = $.createElement("img");
    img.src = src;
    exec("insertHTML", img.outerHTML);
    exec("insertParagraph");
    refreshToolbar();
  };

  // A rule under the caret's line, and the caret on a new text line after it; never inside a line, a list or a code block.
  var rule = function () {
    var s = selection();
    if (!s.rangeCount || !content().isContentEditable) return;
    var node = s.focusNode;
    if (closest(node, "pre") || closest(node, "li")) return;
    var line = element(node);
    while (line && line !== content() && line.parentNode !== content()) line = line.parentNode;
    if (line === content()) line = null;
    pageChange(function () {
      var hr = $.createElement("hr"), next = $.createElement("div");
      next.appendChild($.createElement("br"));
      content().insertBefore(hr, line ? line.nextSibling : null);
      content().insertBefore(next, hr.nextSibling);
      caretAt(next, 0);
    });
    refreshToolbar();
  };

  // A box ticks with a click or a tap in a note that can be changed, and the app gets the content; in a read-only note
  // nothing changes. Before the library's own handling, whose input handler would reformat the caret's line.
  var isBox = function (e) { return e.nodeName === "INPUT" && !!closest(e, ".x-todo-box"); };
  $.addEventListener("click", function (e) {
    if (!isBox(e.target)) return;
    e.stopPropagation();
    if (!content().isContentEditable) return e.preventDefault();
    if (e.target.checked) e.target.setAttribute("checked", "");
    else e.target.removeAttribute("checked");
    contentChanged();
  }, true);
  $.addEventListener("input", function (e) { if (isBox(e.target)) e.stopPropagation(); }, true);

  // The last node of root, at any depth, that take() accepts: a line's text can be inside a <b> or a <span>.
  var lastOf = function (root, take) {
    var w = $.createTreeWalker(root, NodeFilter.SHOW_ALL), n, last = null;
    while ((n = w.nextNode())) if (take(n)) last = n;
    return last;
  };
  var isContent = function (n) { return n.nodeType === 3 ? !!n.data.replace(/\n/g, "") : n.nodeName === "IMG"; };
  // A code block's text as its lines read: a line ends with a "\n", a <br>, or where one of pell's <code> lines starts.
  var linesOf = function (root) {
    var w = $.createTreeWalker(root, NodeFilter.SHOW_ALL), n, text = "";
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) text += n.data;
      else if (n.nodeName === "BR") text += "\n";
      else if (n.nodeName === "IMG") text += "\uFFFC";
      else if (n.nodeName === "CODE" && text) text += "\n";
    }
    return text;
  };
  // Enter on an empty last line of a code block leaves the block, onto a new line under it.
  var leaveCode = function (pre) {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed) return false;
    var after = $.createRange();
    after.selectNodeContents(pre);
    after.setStart(s.focusNode, s.focusOffset);
    if (linesOf(after.cloneContents()).replace(/\n/g, "")) return false;
    // The page's change, one undo: WebKit's undo took the browser's insertHTML back together with the Enters and the
    // code block before it.
    var line = $.createElement("div");
    line.appendChild($.createElement("br"));
    if (!lastOf(pre, isContent)) {
      pageChange(function () {
        pre.parentNode.replaceChild(line, pre);
        caretAt(line, 0);
      });
      return true;
    }
    var before = $.createRange();
    before.selectNodeContents(pre);
    before.setEnd(s.focusNode, s.focusOffset);
    if (linesOf(before.cloneContents()).slice(-1) !== "\n") return false;
    pageChange(function () {
      flattenCode(pre);
      var keep = lastOf(pre, isContent), r = $.createRange();
      if (keep.nodeType === 3) r.setStart(keep, keep.data.replace(/\n+$/, "").length);
      else r.setStartAfter(keep);
      r.setEnd(pre, pre.childNodes.length);
      r.deleteContents();
      pre.parentNode.insertBefore(line, pre.nextSibling);
      caretAt(line, 0);
    });
    return true;
  };

  var caretAt = function (node, offset) {
    var r = $.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    select(r);
  };
  // What follows the caret in a line, taken out of it (the caret is collapsed).
  var restOf = function (line) {
    var s = selection(), r = $.createRange();
    r.setStart(s.focusNode, s.focusOffset);
    r.setEnd(line, line.childNodes.length);
    var box = line.nodeName === "LI" && boxOf(line);
    // never the box: a caret before it is a caret at the start of the text
    if (box && r.comparePoint(box, 0) >= 0) r.setStartAfter(box);
    return r.extractContents();
  };
  // Enter in a checkbox line: a new line under it with an empty box, taking what follows the caret; on an empty checkbox
  // line, the line leaves the list and becomes text.
  var enterInItem = function (item) {
    if (blank(item)) return pageChange(function () { convert([item], "p"); }, true);
    pageChange(function () {
      var rest = restOf(item), next = $.createElement("li");
      next.appendChild(newBox());
      next.appendChild(rest);
      fill(next);
      fill(item);
      item.parentNode.insertBefore(next, item.nextSibling);
      caretAt(next, 1);
    });
  };
  // Enter in a quote line: the quote goes on in a new line; on an empty quote line, the line becomes text.
  var enterInQuote = function (quote) {
    pageChange(function () {
      if (blank(quote)) {
        var line = $.createElement("div");
        while (quote.firstChild) line.appendChild(quote.firstChild);
        fill(line);
        quote.parentNode.replaceChild(line, quote);
        return caretAt(line, 0);
      }
      var next = $.createElement("blockquote");
      next.appendChild(restOf(quote));
      fill(next);
      fill(quote);
      quote.parentNode.insertBefore(next, quote.nextSibling);
      caretAt(next, 0);
    });
  };
  // The page's own Enter, in a checkbox or quote line: true when it took it.
  var enter = function () {
    var s = selection();
    if (!s.rangeCount || !content().isContentEditable) return false;
    var item = closest(s.focusNode, "li"), quote = closest(s.focusNode, "blockquote");
    if (item && !isTodoItem(item)) return false;
    if (!item && !quote) return false;
    if (!s.isCollapsed) exec("delete");
    if (item) enterInItem(item);
    else enterInQuote(quote);
    refreshToolbar();
    return true;
  };

  // Before pell's own Enter handling, which loses the caret in a code block that isn't pell's, makes a quote's new line
  // text, and adds a checkbox list's boxes its own way.
  $.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing) return;
    var s = selection(), node = s.rangeCount && s.focusNode, pre = node && closest(node, "pre");
    if (pre) {
      e.stopPropagation();
      if (leaveCode(pre)) e.preventDefault();
      return;
    }
    var item = node && closest(node, "li");
    if (!(item && isTodoItem(item)) && !(node && !item && closest(node, "blockquote"))) return;
    e.stopPropagation();
    // Shift+Enter: a line break inside the line, the browser's
    if (e.shiftKey) return;
    if (enter()) e.preventDefault();
  }, true);

  // Backspace at the start of a list item takes its bullet off, like the list button: the item becomes text (a checkbox
  // line without its box), the items around it stay lists of their kind. From the key itself too: WebKit sends no
  // beforeinput when there is nothing before the caret to delete (the note's first item).
  var unbulletAt = function (node, offset) {
    var li = closest(node, "li");
    if (!li) return false;
    var r = $.createRange();
    r.selectNodeContents(li);
    r.setEnd(node, offset);
    if (r.toString().length || r.cloneContents().querySelector("img")) return false;
    listChange([li], "p");
    refreshToolbar();
    return true;
  };
  $.addEventListener("keydown", function (e) {
    if (e.key !== "Backspace" || e.isComposing || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed || !content().isContentEditable || !content().contains(s.focusNode)) return;
    if (unbulletAt(s.focusNode, s.focusOffset)) e.preventDefault();
  }, true);

  // Cmd+B, Cmd+I and Cmd+U on a Mac, Ctrl elsewhere: bold, italic and underline, as the toolbar's buttons. WebKit on macOS
  // leaves them to an app's Format menu, which the desktop app doesn't have; Chromium does them itself. So the page does
  // them everywhere, once. Ctrl on a Mac moves the caret (Ctrl+B: one character back). The letter, or the physical key on
  // a non-Latin layout.
  var MAC = /Mac/.test(navigator.platform);
  var STYLE_KEYS = { KeyB: "bold", KeyI: "italic", KeyU: "underline" };
  $.addEventListener("keydown", function (e) {
    var mod = MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!mod || e.altKey || e.shiftKey || e.isComposing) return;
    var command = STYLE_KEYS[/^[a-z]$/i.test(e.key) ? "Key" + e.key.toUpperCase() : e.code];
    if (!command || content().contentEditable !== "true") return;
    e.preventDefault();
    exec(command);
    refreshToolbar();
  }, true);

  content().addEventListener("beforeinput", function (e) {
    // From the system's menu (the desktop's Edit menu): the page's history first.
    if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
      var stack = e.inputType === "historyUndo" ? history.undo : history.redo;
      if (!pageHasTop(stack)) return;
      e.preventDefault();
      if (stack === history.undo) undo();
      else redo();
      return;
    }
    // An edit of the browser's: what the page undid can't be redone after it.
    history.redo = [];
    if (e.inputType === "insertParagraph" && enter()) return e.preventDefault();
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed) return;
    var node = s.focusNode, offset = s.focusOffset;
    if (e.inputType === "deleteContentBackward") {
      if (unbulletAt(node, offset) || dropNoteLink(noteLinkBefore(node, offset))) e.preventDefault();
      return;
    }
    if (e.inputType === "deleteContentForward") {
      if (dropNoteLink(noteLinkAfter(node, offset))) e.preventDefault();
      return;
    }
    // Enter, also from a keyboard that sends it as text: a new line of the code block, or out of it on an empty last line.
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      var pre = closest(node, "pre");
      if (!pre) return;
      if (leaveCode(pre)) return e.preventDefault();
      // A new paragraph in a code block splits it in two on Android's WebView 134: a line break keeps it one.
      if (e.inputType === "insertParagraph") {
        e.preventDefault();
        exec("insertLineBreak");
      }
    }
  });

  // Shortcuts while typing (spec B.5): on a text line, a marker at its very start (#, ##, -, *, 1., [], >) followed by a
  // space typed as finished text makes the line that kind; "---" alone on a line, then Enter, makes it a rule. The space
  // goes in first, then the marker and the space are deleted and the line changes (the page's change): undo gives the typed
  // characters back.
  // Never in another kind of line, from a paste, or inside a composition. SHORTCUTS_ON_TOUCH false: only without touch.
  var SHORTCUTS_ON_TOUCH = true;
  var SHORTCUTS = { "#": "h1", "##": "h2", "-": "ul", "*": "ul", "1.": "ol", "[]": "todo", ">": "quote" };
  var shortcutsHere = function () { return SHORTCUTS_ON_TOUCH || !navigator.maxTouchPoints; };
  // The text of the caret's line before the caret, or null when the caret isn't on a text line.
  var lineBefore = function () {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed || !content().isContentEditable || !content().contains(s.anchorNode)) return null;
    if (typeAt(s.anchorNode) !== "p") return null;
    var r = $.createRange();
    r.selectNodeContents(closest(s.anchorNode, "div,p") || content());
    r.setEnd(s.anchorNode, s.anchorOffset);
    return r;
  };
  var pendingShortcut = null;
  content().addEventListener("beforeinput", function (e) {
    pendingShortcut = null;
    if (e.inputType !== "insertText" || e.data !== " " || e.isComposing || composing || !shortcutsHere()) return;
    var r = lineBefore(), kind = r && SHORTCUTS[r.toString()];
    if (kind) pendingShortcut = { kind: kind, marker: r.toString() };
  });
  // The input events of the page's own commands, kept from the library's handling (it would put a new list back in a
  // <div>): the change is told to the app after (contentChanged).
  var quiet = 0;
  $.addEventListener("input", function (e) { if (quiet) e.stopImmediatePropagation(); }, true);
  var quietly = function (change) {
    quiet++;
    try { change(); } finally { quiet--; }
  };
  // The typed space's own input event too: the app is told after the change.
  $.addEventListener("input", function (e) {
    var p = pendingShortcut;
    pendingShortcut = null;
    if (!p || e.inputType !== "insertText" || !content().contains(e.target)) return;
    var r = lineBefore();
    if (!r || r.toString().replace(/\u00a0/g, " ") !== p.marker + " ") return;
    e.stopImmediatePropagation();
    quietly(function () {
      // A line of the note's own (text right in it) becomes a block first, by the browser.
      if (!closest(r.endContainer, "div,p")) {
        exec("formatBlock", "<div>");
        r = lineBefore();
        if (!r) return;
      }
      var line = closest(r.endContainer, "div,p"), kind = p.kind;
      // The marker goes and the line changes in one change of the page's: one undo gives the marker back, and the
      // browser's commands (WebKit's left a stray line break and an undo that skipped the marker) aren't in it.
      pageChange(function () {
        r.deleteContents();
        var made;
        if (isList(kind) || kind === "todo") made = convert([line], kind)[0];
        else {
          made = $.createElement(BLOCK[kind]);
          while (line.firstChild) made.appendChild(line.firstChild);
          line.parentNode.replaceChild(made, line);
          fill(made);
        }
        caretAt(made, kind === "todo" ? 1 : 0);
      });
    });
    refreshToolbar();
  }, true);
  // "---" then Enter, before the other Enter handling.
  content().addEventListener("beforeinput", function (e) {
    if (e.inputType !== "insertParagraph" || !shortcutsHere()) return;
    var r = lineBefore();
    if (!r || r.toString() !== "---") return;
    var line = closest(r.endContainer, "div,p");
    var after = $.createRange();
    after.selectNodeContents(line || content());
    after.setStart(r.endContainer, r.endOffset);
    if (after.toString() || (!line && content().childNodes.length > 1)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pageChange(function () {
      var hr = $.createElement("hr"), next = $.createElement("div");
      next.appendChild($.createElement("br"));
      if (line) {
        line.parentNode.insertBefore(hr, line);
        line.parentNode.replaceChild(next, line);
      } else {
        while (content().firstChild) content().removeChild(content().firstChild);
        content().appendChild(hr);
        content().appendChild(next);
      }
      caretAt(next, 0);
    });
  }, true);

  // Images. A tap on one (a touch that didn't move, or a click) asks the app for its menu (IMAGE_MESSAGE); the app's choice
  // comes back as __fm.image(index, key, change, value). The key is the image's data: a choice made on an image that has
  // changed since (another device's edit) does nothing.
  var post = function (type, data) {
    (window.ReactNativeWebView || window.parent).postMessage(JSON.stringify({ type: type, data: data }));
  };
  var imageKey = function (img) { return img.src.length + ":" + img.src.slice(-32); };
  var lineOf = function (img) { return closest(img, "div,p,li,h1,pre") || content(); };
  // A code block stays a plain <pre>: an alignment would put a <div> in it.
  var alignable = function (img) { return !closest(img, "pre"); };
  // A turn draws the image in a canvas: a GIF would stop moving, and a linked image can't be read.
  var rotatable = function (img) { return /^data:image\/(jpeg|png|webp);base64,/.test(img.src); };
  var openImage = function (img, x, y) {
    post("${IMAGE_MESSAGE}", {
      index: [].indexOf.call(content().querySelectorAll("img"), img),
      key: imageKey(img),
      src: img.src,
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: img.style.width,
      align: getComputedStyle(lineOf(img)).textAlign,
      x: x,
      y: y,
      editable: content().isContentEditable,
      alignable: alignable(img),
      rotatable: rotatable(img),
    });
  };
  // A long press is the browser's (it selects the image): a tap is much shorter.
  var LONG_PRESS = 400;
  var touch = null, touchedAt = -Infinity;
  content().addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    touch = e.touches.length === 1 && e.target.nodeName === "IMG"
      ? { img: e.target, x: t.clientX, y: t.clientY, at: e.timeStamp }
      : null;
  }, { passive: true });
  content().addEventListener("touchend", function (e) {
    var start = touch;
    touch = null;
    // refreshToolbar's touchend has no touches
    if (!start || !e.changedTouches) return;
    touchedAt = e.timeStamp;
    if (e.timeStamp - start.at > LONG_PRESS) return;
    var t = e.changedTouches[0];
    if (e.target !== start.img || Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) return;
    // No caret and no keyboard: the menu is the app's.
    e.preventDefault();
    openImage(start.img, t.clientX, t.clientY);
  });
  content().addEventListener("mousedown", function (e) {
    if (e.target.nodeName === "IMG") e.preventDefault();
  });
  content().addEventListener("click", function (e) {
    // The click a touch makes (after a long press) was the touch's.
    if (e.target.nodeName !== "IMG" || e.timeStamp - touchedAt < 1000) return;
    e.preventDefault();
    openImage(e.target, e.clientX, e.clientY);
  });

  // The picker stores JPEG at 0.3, and a turn at 0.7 made a photo up to twice as big (a note has a size limit). A JPEG or a
  // WebP gets the best of these qualities that keeps it about its size; a PNG stays a PNG (its transparency).
  var QUALITIES = [0.8, 0.5, 0.3];
  var rotated = function (img) {
    var canvas = $.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    var g = canvas.getContext("2d");
    g.translate(canvas.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(img, 0, 0);
    var type = /^data:(image\/\w+)/.exec(img.src)[1], src;
    if (type === "image/png") return canvas.toDataURL(type);
    for (var i = 0; i < QUALITIES.length; i++) {
      src = canvas.toDataURL(type, QUALITIES[i]);
      if (src.length <= img.src.length * 1.15) break;
    }
    return src;
  };
  var selectNode = function (node) {
    var r = $.createRange();
    r.selectNode(node);
    select(r);
  };
  var childIndex = function (node) { return [].indexOf.call(node.parentNode.childNodes, node); };
  // What a new size or a turn replaces with a changed copy: the image, or the link it is in, which an insertHTML of the image
  // alone would drop.
  var replacedBy = function (img) { return closest(img, "a") || img; };
  // The page's change, so undo brings the image back as it was, one change at a time (WebKit's undo took two insertHTML of
  // images back at once).
  var replaceImage = function (img, change) {
    var node = replacedBy(img), copy = node.cloneNode(true);
    change(node === img ? copy : copy.querySelectorAll("img")[[].indexOf.call(node.querySelectorAll("img"), img)]);
    pageChange(function () { node.parentNode.replaceChild(copy, node); });
  };
  // A change works on the image selected; then the selection goes back where it was (LL-065), not next to the image, or on
  // it where a key would replace it. A range follows the nodes around it. A note that had none is left without one.
  var keepSelectionAround = function (img, replacing, change) {
    var s = selection(), caret = s.rangeCount ? s.getRangeAt(0).cloneRange() : null, node = replacedBy(img);
    var put = caret
      ? function () { if (content().contains(caret.startContainer) && content().contains(caret.endContainer)) select(caret); }
      : function () { s.removeAllRanges(); };
    if (caret && caret.collapsed && replacing) {
      // Right after what is replaced the range ends up before the copy: after the copy, then.
      if (caret.startContainer === node.parentNode && caret.startOffset === childIndex(node) + 1) {
        put = function () {
          if (caret.startContainer.childNodes[caret.startOffset]) s.collapse(caret.startContainer, caret.startOffset + 1);
        };
      }
      // In a link that is replaced: by its place in the text, which the copy has too.
      else if (node.contains(caret.startContainer)) {
        var at = textOffset(caret.startContainer, caret.startOffset);
        put = function () {
          var p = pointAt(at, false);
          if (p) s.collapse(p[0], p[1]);
        };
      }
    }
    // WebKit's commands focus the note: one that wasn't being edited stays so (on a phone, no keyboard).
    var focused = $.activeElement === content();
    change();
    put();
    if (!focused && $.activeElement === content()) content().blur();
  };
  var JUSTIFY = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight" };
  var image = function (index, key, change, value) {
    var img = content().querySelectorAll("img")[index];
    if (!img || imageKey(img) !== key || !content().isContentEditable) return;
    if ((change === "align" && !alignable(img)) || (change === "rotate" && !rotatable(img))) return;
    try {
      keepSelectionAround(img, change === "size" || change === "rotate", function () {
        if (change === "size") replaceImage(img, function (copy) { copy.style.width = value; });
        else if (change === "rotate") {
          var src = rotated(img);
          replaceImage(img, function (copy) { copy.src = src; });
        } else if (change === "align") {
          selectNode(img);
          exec(JUSTIFY[value]);
        } else if (change === "delete") {
          selectNode(img);
          exec("delete");
        }
      });
    } catch (error) {
      // An image the canvas can't read (a file of an old version): the app says so.
      post("${IMAGE_FAILED_MESSAGE}", String(error));
    }
    refreshToolbar();
  };

  // The character count (COUNT_MESSAGE): the text on screen without line breaks, once now and after every change of the
  // content, whoever made it (typing, the app setting it, an undo): one count per 150 ms pause, not one per keystroke.
  var countTimer = null;
  var postCount = function () {
    countTimer = null;
    post("${COUNT_MESSAGE}", content().innerText.replace(/[\n\r\u200B]/g, "").length);
  };
  new MutationObserver(function () {
    if (countTimer) clearTimeout(countTimer);
    countTimer = setTimeout(postCount, 150);
  }).observe(content(), { childList: true, characterData: true, subtree: true });
  postCount();

  // Undo and redo, from the keys: Cmd+Z and Shift+Cmd+Z on a Mac, Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y elsewhere.
  $.addEventListener("keydown", function (e) {
    var mod = MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!mod || e.altKey || e.isComposing || content().contentEditable !== "true") return;
    var letter = /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : e.code === "KeyZ" ? "z" : e.code === "KeyY" ? "y" : "";
    var isRedo = (letter === "z" && e.shiftKey) || (!MAC && letter === "y" && !e.shiftKey);
    if (!isRedo && !(letter === "z" && !e.shiftKey)) return;
    e.preventDefault();
    if (isRedo) redo();
    else undo();
  }, true);
  // A line typed right in the note (the first characters of an empty note) is put in a line of its own by the library,
  // from a setTimeout(0) its input and compositionend handlers start. On a page just started (a phone after a cold
  // start) that timer can fire after the next keys, once a shortcut has made the line a heading, a list or a quote: the
  // late wrap would turn it back into text. Counted here, after the library's handlers, until a timer queued after its
  // own; while one is pending, its formatBlock to a plain line is dropped when the caret is already on a line.
  var wrapsPending = 0;
  var bareLine = function () {
    var s = selection();
    return !!s.rangeCount && content().contains(s.anchorNode) && !closest(s.anchorNode, LINE);
  };
  var wrapAhead = function () {
    if (!bareLine()) return;
    wrapsPending++;
    setTimeout(function () { wrapsPending--; }, 0);
  };
  content().addEventListener("input", wrapAhead);
  content().addEventListener("compositionend", wrapAhead);
  // The library's bar sends undo and redo as execCommand: through the page's history too.
  $.execCommand = function (command, ui, value) {
    if (command === "undo") return undo();
    if (command === "redo") return redo();
    if (command === "formatBlock" && wrapsPending && /^<?(div|p)>?$/i.test(String(value)) && !bareLine()) return false;
    return nativeExec(command, ui, value);
  };

  // Links (LINK_START_MESSAGE, LINK_MESSAGE). The dialog takes the focus, so linkStart() remembers the selection, and
  // link() puts it back before writing; a link is never made in a code block. A note link (#fm-note-) is another thing.
  var isNoteLink = function (a) { return (a.getAttribute("href") || "").indexOf("#fm-note-") === 0; };
  var webLinkAt = function (node) {
    var a = closest(node, "a[href]");
    return a && !isNoteLink(a) ? a : null;
  };
  var linkRange = null, linkEdited = null;
  var linkStart = function () {
    var s = selection();
    if (!s.rangeCount || !content().isContentEditable) return;
    var range = s.getRangeAt(0);
    if (closest(range.startContainer, "pre")) return;
    var a = webLinkAt(range.startContainer);
    linkEdited = a;
    linkRange = range.cloneRange();
    post("${LINK_START_MESSAGE}", a ? { text: a.textContent, href: a.getAttribute("href") } : { text: s.toString(), href: null });
  };
  // The selected text made a link is the browser's (createLink); a link with other text, or one edited, is the page's own
  // change (insertHTML and unlink leave a font-size span and turn spaces into &nbsp;).
  var caretAfter = function (node) {
    var r = $.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    select(r);
  };
  var link = function (href, text) {
    if (!linkRange || !content().isContentEditable) return;
    var range = linkRange, edited = linkEdited;
    linkRange = linkEdited = null;
    if (!content().contains(range.startContainer) || closest(range.startContainer, "pre")) return;
    content().focus();
    if (edited && edited.isConnected) {
      return pageChange(function () {
        edited.setAttribute("href", href);
        if (edited.textContent !== text) {
          while (edited.firstChild) edited.removeChild(edited.firstChild);
          edited.appendChild($.createTextNode(text));
        }
        caretAfter(edited);
      });
    }
    select(range);
    if (!range.collapsed && range.toString() === text) return exec("createLink", href);
    pageChange(function () {
      var a = $.createElement("a");
      a.setAttribute("href", href);
      a.textContent = text;
      range.deleteContents();
      range.insertNode(a);
      caretAfter(a);
    });
  };
  var linkCancel = function () {
    var range = linkRange;
    linkRange = linkEdited = null;
    if (!range || !content().contains(range.startContainer)) return;
    content().focus();
    select(range);
  };
  var unlink = function () {
    var s = selection(), a = s.rangeCount && webLinkAt(s.getRangeAt(0).startContainer);
    if (!a || !content().isContentEditable) return;
    pageChange(function () {
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      a.remove();
    }, true);
  };
  // A click or tap on a link never navigates: the app opens it, or shows its menu. A note link is handled apart.
  $.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !content().contains(a)) return;
    e.preventDefault();
    e.stopPropagation();
    if (isNoteLink(a)) {
      var id = NOTE_ID.exec(a.getAttribute("href"));
      if (id) post("${NOTE_LINK_MESSAGE}", id[1]);
      return;
    }
    var editable = content().isContentEditable;
    post("${LINK_MESSAGE}", {
      href: a.getAttribute("href"),
      text: a.textContent,
      x: e.clientX,
      y: e.clientY,
      editable: editable,
      direct: !editable || (MAC ? e.metaKey : e.ctrlKey),
    });
  }, true);

  // Links to another note (spec B.4): <a href="#fm-note-<id>" contenteditable="false">label</a>, one character for the
  // caret. While the text before the caret ends with [[ and up to 40 characters with no [, no ] and no line break, the
  // app's picker is open (PICKER_MESSAGE) and, while the app shows rows for it (pickerShown), gets the arrows, Enter and
  // Esc (PICKER_KEY_MESSAGE); never in a code block or a read-only note, and nothing changes while a word is being
  // composed. Esc keeps that [[ closed until it goes. From the bar's menu (pickStart) the caret is remembered.
  var NOTE_ID = /^#fm-note-([A-Za-z0-9~_-]{1,80})$/;
  var TRIGGER = /\[\[([^\[\]\n]{0,40})$/;
  var composing = false, picker = null, dismissed = null, pickRange = null, pickerRows = false;
  var CLOSED = JSON.stringify({ open: false, query: "" }), pickerPosted = CLOSED;
  var triggerAt = function () {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed || !content().isContentEditable) return null;
    var node = s.anchorNode;
    if (!node || node.nodeType !== 3 || !content().contains(node) || closest(node, "pre")) return null;
    var m = TRIGGER.exec(node.data.slice(0, s.anchorOffset));
    return m ? { node: node, start: m.index, end: s.anchorOffset, query: m[1] } : null;
  };
  var checkPicker = function () {
    if (composing) return;
    var t = triggerAt();
    if (!t) dismissed = null;
    else if (dismissed && dismissed.node === t.node && dismissed.start === t.start) t = null;
    picker = t;
    var now = t ? JSON.stringify({ open: true, query: t.query }) : CLOSED;
    if (now === pickerPosted) return;
    pickerPosted = now;
    if (!t) pickerRows = false;
    post("${PICKER_MESSAGE}", JSON.parse(now));
  };
  var closePicker = function () {
    if (picker) dismissed = picker;
    var range = pickRange;
    pickRange = null;
    if (range && content().contains(range.startContainer)) {
      content().focus();
      select(range);
    }
    checkPicker();
  };
  content().addEventListener("compositionstart", function () { composing = true; });
  content().addEventListener("compositionend", function () { composing = false; checkPicker(); });
  content().addEventListener("input", function () { checkPicker(); });
  var PICKER_KEYS = { ArrowUp: "up", ArrowDown: "down", Enter: "enter", Escape: "escape" };
  window.addEventListener("keydown", function (e) {
    var name = PICKER_KEYS[e.key];
    if (!name || e.isComposing || composing || pickerPosted === CLOSED || !pickerRows) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    post("${PICKER_KEY_MESSAGE}", name);
    if (name === "escape") closePicker();
  }, true);
  // The caret never stays inside a note link (an engine that lets it in): it goes after it.
  var keepOutOfNoteLinks = function () {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed) return;
    var a = closest(s.anchorNode, 'a[contenteditable="false"]');
    if (a && isNoteLink(a)) caretAfter(a);
  };
  // Inline code (spec: the bar's "Inline code", and code typed or pasted): a <code> outside a code block. What follows
  // an inline element made here is typed outside it: the next text node takes the caret, and at the end of a line a
  // zero-width space is that node (the plain-text readers drop it).
  var afterInline = function (el) {
    var next = el.nextSibling;
    if (!next || next.nodeType !== 3 || !next.length) {
      next = $.createTextNode("​");
      el.parentNode.insertBefore(next, el.nextSibling);
      return caretAt(next, 1);
    }
    caretAt(next, 0);
  };
  // With a selection on one line: it becomes code. With the caret in code: at its end, the caret leaves it; elsewhere
  // the code goes back to text. With the caret elsewhere: an empty code to type in.
  var toggleCode = function () {
    var s = selection();
    if (!s.rangeCount || !content().contains(s.anchorNode)) return;
    var range = s.getRangeAt(0);
    if (closest(range.startContainer, "pre") || closest(range.endContainer, "pre")) return;
    var code = closest(range.startContainer, "code");
    if (code) {
      var tail = $.createRange();
      tail.selectNodeContents(code);
      tail.setStart(range.endContainer, range.endOffset);
      if (range.collapsed && !tail.toString().replace(/​/g, "")) return afterInline(code);
      return pageChange(function () {
        while (code.firstChild) code.parentNode.insertBefore(code.firstChild, code);
        code.remove();
      }, true);
    }
    if (closest(range.startContainer, LINE) !== closest(range.endContainer, LINE)) return;
    pageChange(function () {
      var el = $.createElement("code");
      if (range.collapsed) el.appendChild($.createTextNode("​"));
      else el.appendChild(range.extractContents());
      range.insertNode(el);
      if (range.collapsed && el.firstChild.data === "​") caretAt(el.firstChild, 1);
      else afterInline(el);
    });
  };

  // Inline Markdown typed: **bold**, *italic* or _italic_, ~~struck~~, code. The closing marker, typed as finished text
  // in the same run of text as its opening one (which starts a word), makes the text between that style, as a page change:
  // one undo gives the markers back. Never in a code block, inline code or a link, nor inside a composition.
  var INLINE = [
    { re: /(^|[^\w*])\*\*([^\s*](?:[^*]*[^\s*])?)\*\*$/, tag: "b" },
    { re: /(^|[^\w*])\*([^\s*](?:[^*]*[^\s*])?)\*$/, tag: "i" },
    { re: /(^|[^\w_])_([^\s_](?:[^_]*[^\s_])?)_$/, tag: "i" },
    { re: /(^|[^\w~])~~([^\s~](?:[^~]*[^\s~])?)~~$/, tag: "strike" },
    { re: /(^|[^\x60])\x60([^\x60]+)\x60$/, tag: "code" },
  ];
  var inlineMark = function () {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed || !content().isContentEditable) return false;
    var node = s.anchorNode, offset = s.anchorOffset;
    if (!node || node.nodeType !== 3 || !content().contains(node) || closest(node, "pre,code,a")) return false;
    var before = node.data.slice(0, offset).replace(/ /g, " ");
    var found = null;
    for (var i = 0; i < INLINE.length && !found; i++) {
      var m = INLINE[i].re.exec(before);
      if (m) found = { start: m.index + m[1].length, inner: m[2], tag: INLINE[i].tag };
    }
    if (!found) return false;
    pageChange(function () {
      var r = $.createRange(), el = $.createElement(found.tag);
      r.setStart(node, found.start);
      r.setEnd(node, offset);
      r.deleteContents();
      el.textContent = found.inner;
      r.insertNode(el);
      afterInline(el);
    });
    return true;
  };
  $.addEventListener("input", function (e) {
    if (e.inputType !== "insertText" || !e.data || !/[*_~\x60]$/.test(e.data) || e.isComposing || composing) return;
    if (!content().contains(e.target) && e.target !== content()) return;
    if (inlineMark()) refreshToolbar();
  }, true);

  // Markdown pasted into a text note (spec: paste): when a line starts with a Markdown marker, or the text holds a
  // Markdown mark or a web address, its lines become the note's lines (headings, lists, checkboxes, quotes, rules, code
  // blocks) and its marks bold, italic, struck, code and links, as one page change. Nothing else changes a paste: plain
  // text, a code block, a read-only note keep the library's plain paste.
  var MD_LINE = /^(#{1,6}\s+\S|\s*[-*+]\s+\S|\s*\d+[.)]\s+\S|\s*(?:[-*+]\s+)?\[[ xX]?\]\s+\S|>\s?\S|(?:-{3,}|\*{3,}|_{3,})\s*$|\x60\x60\x60)/m;
  var MD_MARK = /\*\*[^*\s][^*\n]*\*\*|~~[^~\s][^~\n]*~~|\x60[^\x60\n]+\x60|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s/?#.]/;
  var INLINE_MD = /\x60([^\x60\n]+)\x60|\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*|~~([^~\s](?:[^~\n]*[^~\s])?)~~|(^|[^\w*])\*([^*\s](?:[^*\n]*[^*\s])?)\*|(^|[^\w_])_([^_\s](?:[^_\n]*[^_\s])?)_|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"]+)/;
  var inlineMd = function (text, into) {
    var m;
    while (text && (m = INLINE_MD.exec(text))) {
      var lead = m[4] !== undefined ? m[4] : m[6] !== undefined ? m[6] : "";
      var at = m.index + lead.length, whole = m[0].length - lead.length, el = null;
      if (at) into.appendChild($.createTextNode(text.slice(0, at)));
      if (m[1] !== undefined) (el = $.createElement("code")).textContent = m[1];
      else if (m[2] !== undefined) inlineMd(m[2], (el = $.createElement("b")));
      else if (m[3] !== undefined) inlineMd(m[3], (el = $.createElement("strike")));
      else if (m[5] !== undefined) inlineMd(m[5], (el = $.createElement("i")));
      else if (m[7] !== undefined) inlineMd(m[7], (el = $.createElement("i")));
      else if (m[8] !== undefined) {
        el = $.createElement("a");
        el.setAttribute("href", m[9]);
        inlineMd(m[8], el);
      } else {
        var href = m[10].replace(/[.,;:!?)\]}'"»]+$/, "");
        whole = href.length;
        el = $.createElement("a");
        el.setAttribute("href", href);
        el.textContent = href;
      }
      into.appendChild(el);
      text = text.slice(at + whole);
    }
    if (text) into.appendChild($.createTextNode(text));
    return into;
  };
  var mdBlocks = function (text) {
    var lines = text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "").split("\n");
    var out = [], list = null, code = null, m;
    var line = function (tag, inner) {
      var e = inlineMd(inner, $.createElement(tag));
      fill(e);
      return e;
    };
    var item = function (kind, inner, checked) {
      var tag = kind === "ul" ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        list = { kind: kind, el: $.createElement(tag) };
        if (kind === "todo") list.el.className = "x-todo";
        out.push(list.el);
      }
      var li = $.createElement("li");
      if (kind === "todo") {
        var box = newBox();
        if (checked) box.querySelector("input").setAttribute("checked", "");
        li.appendChild(box);
      }
      inlineMd(inner, li);
      fill(li);
      list.el.appendChild(li);
    };
    lines.forEach(function (l) {
      if (code) {
        if (/^\x60\x60\x60/.test(l)) code = null;
        else {
          if (code.childNodes.length) code.appendChild($.createElement("br"));
          if (l) code.appendChild($.createTextNode(l));
        }
        return;
      }
      if (/^\x60\x60\x60/.test(l)) {
        list = null;
        out.push((code = $.createElement("pre")));
        return;
      }
      if ((m = /^\s*(?:[-*+]\s+)?\[([ xX]?)\]\s+(.*)$/.exec(l))) return item("todo", m[2], /x/i.test(m[1]));
      if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l)) {
        list = null;
        return out.push($.createElement("hr"));
      }
      if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) return item("ul", m[1]);
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) return item("ol", m[1]);
      list = null;
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) return out.push(line(m[1].length === 1 ? "h1" : "h2", m[2]));
      if ((m = /^>\s?(.*)$/.exec(l))) return out.push(line("blockquote", m[1]));
      out.push(line("div", l));
    });
    out.forEach(function (e) { if (e.nodeName === "PRE") fill(e); });
    return out;
  };
  // The note's own block that holds the caret: a line of text right in the note is made one first.
  var topBlock = function (node) {
    var c = content(), n = node;
    while (n && n.parentNode !== c) n = n.parentNode;
    if (!n || n.nodeType === 1 && /^(DIV|P|UL|OL|H1|H2|BLOCKQUOTE|PRE|HR)$/.test(n.nodeName)) return n;
    var first = n, last = n;
    var inline = function (e) { return e && (e.nodeType === 3 || !/^(DIV|P|UL|OL|H1|H2|BLOCKQUOTE|PRE|HR)$/.test(e.nodeName)); };
    while (inline(first.previousSibling)) first = first.previousSibling;
    while (inline(last.nextSibling)) last = last.nextSibling;
    var div = $.createElement("div"), stop = last.nextSibling;
    c.insertBefore(div, first);
    while (div.nextSibling !== stop) div.appendChild(div.nextSibling);
    return div;
  };
  var pasteMarkdown = function (text) {
    var s = selection();
    if (!s.rangeCount || !content().isContentEditable || !content().contains(s.anchorNode)) return false;
    var range = s.getRangeAt(0);
    if (closest(range.startContainer, "pre") || closest(range.endContainer, "pre")) return false;
    if (!MD_LINE.test(text) && !MD_MARK.test(text)) return false;
    var blocks = mdBlocks(text);
    if (!blocks.length) return false;
    pageChange(function () {
      if (!range.collapsed) range.deleteContents();
      // One line of text: its content goes in at the caret.
      if (blocks.length === 1 && blocks[0].nodeName === "DIV") {
        var frag = $.createDocumentFragment(), last = null;
        while (blocks[0].firstChild) frag.appendChild((last = blocks[0].firstChild));
        if (last && last.nodeName === "BR") frag.removeChild(last), (last = frag.lastChild);
        range.insertNode(frag);
        if (last) last.nodeType === 1 ? afterInline(last) : caretAt(last, last.length);
        return;
      }
      var top = topBlock(range.startContainer), line = top;
      var plainLine = top && (top.nodeName === "DIV" || top.nodeName === "P");
      var tail = null;
      if (plainLine) {
        var r = $.createRange();
        r.setStart(range.startContainer, range.startOffset);
        r.setEnd(top, top.childNodes.length);
        tail = r.extractContents();
        if (blocks[0].nodeName === "DIV" && !blank(blocks[0])) {
          while (blocks[0].firstChild) top.appendChild(blocks[0].firstChild);
          blocks.shift();
        }
      }
      var after = top ? top.nextSibling : null;
      blocks.forEach(function (b) { content().insertBefore(b, after); });
      var lastBlock = blocks.length ? blocks[blocks.length - 1] : top;
      var end = $.createRange();
      end.selectNodeContents(lastBlock.nodeName === "UL" || lastBlock.nodeName === "OL" ? lastBlock.lastChild : lastBlock);
      end.collapse(false);
      if (tail && (tail.textContent || tail.querySelector && tail.querySelector("img,a,input"))) {
        if (lastBlock.nodeName === "DIV") {
          var br = lastBlock.lastChild;
          if (br && br.nodeName === "BR") lastBlock.removeChild(br);
          end.selectNodeContents(lastBlock);
          end.collapse(false);
          lastBlock.appendChild(tail);
        } else {
          var rest = $.createElement("div");
          rest.appendChild(tail);
          content().insertBefore(rest, lastBlock.nextSibling);
        }
      }
      if (plainLine && blank(top)) top.remove();
      else if (top) fill(top);
      select(end);
    });
    refreshToolbar();
    return true;
  };
  $.addEventListener("paste", function (e) {
    var data = e.clipboardData || window.clipboardData;
    var text = data && data.getData("text/plain");
    if (!text || !content().contains(e.target) && e.target !== content()) return;
    if (!pasteMarkdown(text)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // A web address typed, then a space or Enter: a link to itself (spec: links in text notes). Only http and https, on a
  // text line outside a link and a code block, never inside a composition; punctuation at its end stays text. The space
  // goes in after the link (a no-break one at the end of a line, which the browser keeps); one undo gives the text back.
  var ADDRESS_BEFORE = /(^|[\s\u00a0])(https?:\/\/[^\s\u00a0<>"]+)$/;
  var autoLink = function (space) {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed || !content().isContentEditable) return false;
    var node = s.anchorNode, offset = s.anchorOffset;
    if (!node || node.nodeType !== 3 || !content().contains(node) || closest(node, "pre,a")) return false;
    var m = ADDRESS_BEFORE.exec(node.data.slice(0, offset));
    if (!m) return false;
    var href = m[2].replace(/[.,;:!?)\]}'"\u00bb]+$/, "");
    if (!/^https?:\/\/[^\/?#.]/.test(href)) return false;
    var start = offset - m[2].length;
    pageChange(function () {
      var r = $.createRange(), a = $.createElement("a");
      r.setStart(node, start);
      r.setEnd(node, start + href.length);
      a.setAttribute("href", href);
      r.surroundContents(a);
      var rest = a.nextSibling, at = offset - start - href.length;
      if (!space) {
        if (rest && rest.nodeType === 3) caretAt(rest, at);
        else caretAfter(a);
        return;
      }
      if (!rest || rest.nodeType !== 3) {
        rest = $.createTextNode("");
        a.parentNode.insertBefore(rest, a.nextSibling);
      }
      rest.insertData(at, at === rest.length ? "\u00a0" : " ");
      caretAt(rest, at + 1);
    });
    return true;
  };
  $.addEventListener("beforeinput", function (e) {
    if (e.isComposing || composing || !content().contains(e.target)) return;
    var space = e.inputType === "insertText" && (e.data === " " || e.data === "\u00a0");
    if (!space && e.inputType !== "insertParagraph" && e.inputType !== "insertLineBreak") return;
    if (autoLink(space) && space) e.preventDefault();
  }, true);

  // A note link is one character: Backspace right after it (or after it and the space its pick put after it, while
  // nothing follows that space) and Delete right before it take it whole, as a page change. WebKit wouldn't delete it.
  var isPill = function (n) { return !!n && n.nodeType === 1 && n.nodeName === "A" && isNoteLink(n); };
  var isSpace = function (n) { return !!n && n.nodeType === 3 && n.length === 1 && /[ \u00a0]/.test(n.data); };
  var noteLinkBefore = function (node, offset) {
    var prev = null, space = null;
    if (node.nodeType === 3) {
      if (offset === 0) prev = node.previousSibling;
      else if (offset === 1 && isSpace(node)) { space = node; prev = node.previousSibling; }
    } else if (offset > 0) {
      prev = node.childNodes[offset - 1];
      if (isSpace(prev)) { space = prev; prev = prev.previousSibling; }
    }
    return isPill(prev) ? { from: prev, to: space || prev } : null;
  };
  var noteLinkAfter = function (node, offset) {
    var next = node.nodeType === 3 ? (offset === node.length ? node.nextSibling : null) : node.childNodes[offset];
    return isPill(next) ? { from: next, to: next } : null;
  };
  var dropNoteLink = function (span) {
    if (!span || !content().isContentEditable) return false;
    pageChange(function () {
      var r = $.createRange();
      r.setStartBefore(span.from);
      r.setEndAfter(span.to);
      r.deleteContents();
      var line = closest(r.startContainer, LINE);
      if (line) fill(line);
      select(r);
    });
    checkPicker();
    return true;
  };
  var pickerShown = function (shown) { pickerRows = !!shown && pickerPosted !== CLOSED; };
  var pickStart = function () {
    var s = selection();
    pickRange = s.rangeCount && content().contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  };
  var noteLink = function (id, label) {
    if (!content().isContentEditable || !/^[A-Za-z0-9~_-]{1,80}$/.test(id)) return;
    // The [[ last seen (the app's row may have taken the focus), else the one at the caret.
    var t = picker && picker.node.isConnected && picker.node.data.substr(picker.start, 2) === "[[" ? picker : triggerAt();
    var range = null;
    if (t && t.node.isConnected) {
      range = $.createRange();
      range.setStart(t.node, t.start);
      range.setEnd(t.node, Math.min(t.end, t.node.length));
    } else if (pickRange && content().contains(pickRange.startContainer)) range = pickRange;
    else {
      var s = selection();
      if (s.rangeCount && content().contains(s.anchorNode)) range = s.getRangeAt(0);
    }
    pickRange = null;
    if (!range || closest(range.startContainer, "pre")) return;
    content().focus();
    pageChange(function () {
      // A no-break space: a plain one at the end of a line is dropped by the browser when typing after it.
      var a = $.createElement("a"), space = $.createTextNode("\u00a0");
      a.setAttribute("href", "#fm-note-" + id);
      a.setAttribute("contenteditable", "false");
      a.textContent = label;
      range.deleteContents();
      range.insertNode(space);
      range.insertNode(a);
      var r = $.createRange();
      r.setStart(space, 1);
      r.collapse(true);
      select(r);
    });
    checkPicker();
  };

  // The bar's commands by name (FormatCommand): nothing else, and nothing in a read-only note.
  var COMMANDS = ["bold", "italic", "underline", "strikeThrough", "subscript", "superscript", "justifyLeft", "justifyCenter", "code", "undo", "redo"];
  var run = function (command) {
    if (COMMANDS.indexOf(command) < 0 || !content().isContentEditable) return;
    if (command === "undo") undo();
    else if (command === "redo") redo();
    else if (command === "code") toggleCode();
    else exec(command);
    refreshToolbar();
  };

  // The caret's state for the bar (STATE_MESSAGE): posted when the selection moves (once a frame at most) and after every
  // command, only when it differs from the last one posted, and never from a read-only note.
  var queryState = function (command) { try { return $.queryCommandState(command); } catch (error) { return false; } };
  var state = function () {
    var s = selection(), node = s.rangeCount ? s.getRangeAt(0).startContainer : content();
    var line = closest(node, "li,div,p,h1,h2,blockquote,pre") || content();
    var link = closest(node, "a[href]");
    return {
      line: typeAt(node),
      bold: queryState("bold"),
      italic: queryState("italic"),
      // A link is drawn underlined, which the browser takes for underline: in a link only a u element counts.
      underline: link ? !!closest(node, "u") : queryState("underline"),
      strike: queryState("strikeThrough"),
      sub: queryState("subscript"),
      sup: queryState("superscript"),
      center: getComputedStyle(line).textAlign === "center",
      code: !!closest(node, "code") && !closest(node, "pre"),
      link: !!link && link.getAttribute("href").indexOf("#fm-note-") !== 0,
    };
  };
  var lastState = null, stateFrame = 0;
  var postState = function () {
    stateFrame = 0;
    var s = selection();
    if (!content().isContentEditable || !s.rangeCount || !content().contains(s.anchorNode)) return;
    var now = JSON.stringify(state());
    if (now === lastState) return;
    lastState = now;
    post("${STATE_MESSAGE}", JSON.parse(now));
  };
  var onSelection = function () {
    keepOutOfNoteLinks();
    checkPicker();
    postState();
  };
  $.addEventListener("selectionchange", function () {
    if (!stateFrame) stateFrame = requestAnimationFrame(onSelection);
  });
  // A touch or a click on the text: the bar closes its menu.
  content().addEventListener("pointerdown", function () { post("${TOUCH_MESSAGE}", null); });
  // Every command of the page posts the state it leaves.
  var thenState = function (command) {
    return function () {
      var result = command.apply(null, arguments);
      postState();
      return result;
    };
  };

  window.__fm = {
    toggle: thenState(toggle),
    rule: thenState(rule),
    insertImage: thenState(insertImage),
    image: thenState(image),
    run: thenState(run),
    linkStart: linkStart,
    link: thenState(link),
    linkCancel: linkCancel,
    unlink: thenState(unlink),
    noteLink: thenState(noteLink),
    pickStart: pickStart,
    pickerShown: pickerShown,
    closePicker: closePicker,
    state: state,
  };
})();
`;
