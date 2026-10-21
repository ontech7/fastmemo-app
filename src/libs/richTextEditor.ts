import { BORDER, COLOR, PADDING_MARGIN } from "@/constants/styles";

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
    }
    /* Notes saved before RICH_TEXT_SCRIPT can hold a heading or code block in one of its kind, and lines that kept the
       look of where they came from when joined to a code block. */
    h1 h1 { font-size: inherit; margin: 0; }
    pre pre { margin: 0; padding: 0; background: none; }
    h1:empty, pre:empty { display: none; }
    pre span { font-family: inherit !important; background-color: transparent !important; white-space: inherit !important; }
  `,
  // Horizontal inset lives here (not on containerStyle) so it matches the header
  // and toolbar margins on every platform: on web the webview is a plain <iframe>
  // that ignores containerStyle, so only this content padding aligns the text.
  // The gap from the toolbar is handled by editorWrapper's paddingBottom (a real
  // layout gap outside the iframe) — content padding-bottom can't do it because the
  // iframe's bottom edge is the scroll viewport edge, so the caret always lands on it.
  contentCSSText: `padding: ${PADDING_MARGIN.sm}px ${PADDING_MARGIN.lg}px ${PADDING_MARGIN.sm}px;`,
};

/**
 * What the text editor's page runs besides pell (react-native-pell-rich-editor), injected once it is up
 * (`RichEditor.command`). Pell's own block buttons nest an element in one of its kind on every press (a heading inside a
 * heading, a code block inside a code block), mix them (a list inside a heading or a code block) and never turn them off.
 * Here a line is one of text, heading, code, bullet or numbered item, and pressing the button of what it already is turns it
 * back into text. The changes go through `execCommand`, so the editor's undo keeps working (only the repair of markup saved
 * before this, which undo keeps, doesn't).
 * Tested by `scripts/richtext.test.mjs` on the real page.
 */
export const RICH_TEXT_SCRIPT = String.raw`
(function () {
  if (window.__fm) return;
  var $ = document;
  var content = function () { return $.querySelector(".pell-content"); };
  var exec = function (command, value) { return $.execCommand(command, false, value === undefined ? null : value); };
  var selection = function () { return $.getSelection(); };
  var element = function (node) { return node && (node.nodeType === 1 ? node : node.parentNode); };
  var closest = function (node, selector) {
    var c = content(), e = element(node);
    e = e && e.closest(selector);
    return e && e !== c && c.contains(e) ? e : null;
  };
  var isList = function (type) { return type === "ul" || type === "ol"; };
  var typeAt = function (node) {
    if (closest(node, "pre")) return "code";
    if (closest(node, "h1")) return "h1";
    var li = closest(node, "li");
    if (li) return li.parentNode.nodeName === "OL" ? "ol" : "ul";
    return "p";
  };
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

  // The selection as character offsets, which survive the block changes (they move text, they don't change it).
  var textOffset = function (node, offset) {
    var r = $.createRange();
    r.selectNodeContents(content());
    r.setEnd(node, offset);
    return r.toString().length;
  };
  var atNodeStart = function (node, offset) {
    return node.nodeType === 3 ? offset === 0 : offset < node.childNodes.length;
  };
  var pointAt = function (at, preferNext) {
    var w = $.createTreeWalker(content(), NodeFilter.SHOW_TEXT), n, seen = 0, last = null;
    while ((n = w.nextNode())) {
      var end = seen + n.data.length;
      if (at < end || (at === end && !preferNext)) return [n, at - seen];
      if (at === end) last = [n, at - seen];
      seen = end;
    }
    return last;
  };
  var keepSelection = function (change) {
    var s = selection();
    // An empty line has no text to find the caret by: there the commands' own placement is right.
    if (!s.rangeCount || !(closest(s.focusNode, "li,h1,pre,div") || content()).textContent) return change();
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

  var listCommand = function (type) { return type === "ol" ? "insertOrderedList" : "insertUnorderedList"; };
  var off = function (type) {
    if (isList(type)) return exec(listCommand(type));
    var range = selection().getRangeAt(0);
    touched(range, type === "h1" ? "h1" : "pre").forEach(function (block) {
      if (!block.isConnected) return;
      // Notes saved before these fixes can hold a heading around a list, or a block nested in one of its kind.
      if (block.querySelector("ul,ol,pre,h1,div")) return unwrap(block);
      if (type === "code") flattenCode(block);
      selectContents(block);
      exec("formatBlock", "<div>");
    });
  };
  var on = function (type) {
    if (isList(type)) return exec(listCommand(type));
    exec("formatBlock", type === "h1" ? "<h1>" : "<pre>");
  };

  // A line is text, a heading, code, or a bullet or numbered item. Pressing the button of what it is makes it text.
  var toggle = function (type) {
    var s = selection();
    // A read-only note (RichEditor's disabled): the repair of old markup would change it.
    if (!s.rangeCount || !content().isContentEditable) return;
    keepSelection(function () {
      var current = typeAt(s.getRangeAt(0).startContainer);
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

  // The last node of root, at any depth, that take() accepts: a line's text can be inside a <b> or a <span>.
  var lastOf = function (root, take) {
    var w = $.createTreeWalker(root, NodeFilter.SHOW_ALL), n, last = null;
    while ((n = w.nextNode())) if (take(n)) last = n;
    return last;
  };
  var isContent = function (n) { return n.nodeType === 3 ? !!n.data.replace(/\n/g, "") : n.nodeName === "IMG"; };
  // A line break, or an empty line of pell's code block.
  var isLineEnd = function (n) { return n.nodeName === "BR" || (n.nodeName === "CODE" && !n.textContent); };
  // Enter on an empty last line of a code block leaves the block, onto a new line under it.
  var leaveCode = function (pre) {
    var s = selection();
    if (!s.rangeCount || !s.isCollapsed) return false;
    var after = $.createRange();
    after.selectNodeContents(pre);
    after.setStart(s.focusNode, s.focusOffset);
    if (after.toString() || after.cloneContents().querySelector("img")) return false;
    if (!lastOf(pre, isContent)) {
      selectContents(pre);
      exec("formatBlock", "<div>");
      return true;
    }
    var before = $.createRange();
    before.selectNodeContents(pre);
    before.setEnd(s.focusNode, s.focusOffset);
    var line = lastOf(before.cloneContents(), function (n) { return isContent(n) || isLineEnd(n); });
    if (!line || !isLineEnd(line)) return false;
    flattenCode(pre);
    var r = $.createRange();
    r.setStartAfter(lastOf(pre, isContent));
    r.setEnd(pre, pre.childNodes.length);
    select(r);
    exec("insertHTML", "<div><br></div>");
    return true;
  };

  // Before pell's own Enter handling, which loses the caret in a code block that isn't pell's.
  $.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing) return;
    var s = selection(), pre = s.rangeCount && closest(s.focusNode, "pre");
    if (!pre) return;
    e.stopPropagation();
    if (leaveCode(pre)) e.preventDefault();
  }, true);

  content().addEventListener("beforeinput", function (e) {
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
      exec(listCommand(li.parentNode.nodeName === "OL" ? "ol" : "ul"));
      refreshToolbar();
      return;
    }
    // A keyboard that sends a new line as text, not as an Enter key.
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      var pre = closest(node, "pre");
      if (pre && leaveCode(pre)) e.preventDefault();
    }
  });

  window.__fm = { toggle: toggle, insertImage: insertImage };
})();
`;
