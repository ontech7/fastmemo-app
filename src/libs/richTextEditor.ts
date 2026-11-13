import { BORDER, COLOR, GLASS, PADDING_MARGIN } from "@/constants/styles";
import { noteBlockCss } from "@/libs/noteHtml";
import { SCROLLBAR_CSS } from "@/styles/scrollbar";

/** The kinds of line of a text note. */
export type LineType = "p" | "h1" | "h2" | "quote" | "code" | "ul" | "ol" | "todo";
/** The page command that makes the caret's lines this kind, or text again if they already are. */
export const lineCommand = (type: LineType) => `window.__fm && window.__fm.toggle(${JSON.stringify(type)})`;
/** A hairline under the caret's line, the caret on a text line after it. */
export const RULE_COMMAND = "window.__fm && window.__fm.rule()";

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
    ${noteBlockCss({ text: COLOR.softWhite, muted: COLOR.textSecondary, accent: COLOR.accentMuted, line: GLASS.border, boxFill: "transparent" })}
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
  var exec = function (command, value) { return nativeExec(command, false, value === undefined ? null : value); };
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
    var lists = [];
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
      return pageChange(function () { convert(linesIn(range()), "todo"); }, true);
    }
    if (isList(type)) return pageChange(function () { convert(linesIn(range()), type); }, true);
    pageChange(function () { convert(items(), "p"); }, true);
    if (typeAt(range().startContainer) !== type) on(type);
  };

  var listCommand = function (type) { return type === "ol" ? "insertOrderedList" : "insertUnorderedList"; };
  var off = function (type) {
    if (isList(type)) return exec(listCommand(type));
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
  var on = function (type) {
    if (isList(type)) return exec(listCommand(type));
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
    if (!lastOf(pre, isContent)) {
      selectContents(pre);
      exec("formatBlock", "<div>");
      return true;
    }
    var before = $.createRange();
    before.selectNodeContents(pre);
    before.setEnd(s.focusNode, s.focusOffset);
    if (linesOf(before.cloneContents()).slice(-1) !== "\n") return false;
    flattenCode(pre);
    var keep = lastOf(pre, isContent), r = $.createRange();
    if (keep.nodeType === 3) r.setStart(keep, keep.data.replace(/\n+$/, "").length);
    else r.setStartAfter(keep);
    r.setEnd(pre, pre.childNodes.length);
    select(r);
    exec("insertHTML", "<div><br></div>");
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
    // Backspace at the start of a list item takes its bullet off, like the list button.
    if (e.inputType === "deleteContentBackward") {
      var li = closest(node, "li");
      if (!li) return;
      var r = $.createRange();
      r.selectNodeContents(li);
      r.setEnd(node, offset);
      if (r.toString().length || r.cloneContents().querySelector("img")) return;
      e.preventDefault();
      // a checkbox line: its box goes and it becomes text; the items around it stay checkbox lists
      if (isTodoItem(li)) pageChange(function () { convert([li], "p"); }, true);
      else exec(listCommand(li.parentNode.nodeName === "OL" ? "ol" : "ul"));
      refreshToolbar();
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
  // Through insertHTML, so undo brings the image back as it was.
  var replaceImage = function (img, change) {
    var node = replacedBy(img), copy = node.cloneNode(true);
    change(node === img ? copy : copy.querySelectorAll("img")[[].indexOf.call(node.querySelectorAll("img"), img)]);
    selectNode(node);
    exec("insertHTML", copy.outerHTML);
  };
  // A change works on the image selected; then the selection goes back where it was (LL-065), not next to the image, or on
  // it where a key would replace it. A range follows the nodes around it. A note that had none is left without one.
  var keepSelectionAround = function (img, replacing, change) {
    var s = selection(), caret = s.rangeCount ? s.getRangeAt(0).cloneRange() : null, node = replacedBy(img);
    var put = caret
      ? function () { if (content().contains(caret.startContainer) && content().contains(caret.endContainer)) select(caret); }
      : function () { s.removeAllRanges(); };
    if (caret && caret.collapsed && replacing) {
      // Right after what is replaced the range ends up before the copy (and insertHTML leaves the caret in a link's copy):
      // after the copy, then.
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
    change();
    put();
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
  // The library's bar sends undo and redo as execCommand: through the page's history too.
  $.execCommand = function (command, ui, value) {
    if (command === "undo") return undo();
    if (command === "redo") return redo();
    return nativeExec(command, ui, value);
  };

  window.__fm = { toggle: toggle, rule: rule, insertImage: insertImage, image: image };
})();
`;
