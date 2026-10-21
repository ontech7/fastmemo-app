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
      cursor: pointer;
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

/** The page's message that an image was tapped: its data is an `EditorImage`. */
export const IMAGE_MESSAGE = "FASTMEMO_IMAGE";
/** The page's message that a change couldn't be made to an image. */
export const IMAGE_FAILED_MESSAGE = "FASTMEMO_IMAGE_FAILED";

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
}

export type ImageChange = "size" | "align" | "rotate" | "delete";

/** The page command for a change to a tapped image (RichEditor.command). */
export const imageCommand = (image: EditorImage, change: ImageChange, value?: string) =>
  `window.__fm && window.__fm.image(${image.index}, ${JSON.stringify(image.key)}, ${JSON.stringify(change)}, ${JSON.stringify(value ?? null)})`;

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
    });
  };
  var touch = null;
  content().addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    touch = e.touches.length === 1 && e.target.nodeName === "IMG" ? { img: e.target, x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  content().addEventListener("touchend", function (e) {
    var start = touch;
    touch = null;
    // refreshToolbar's touchend has no touches
    if (!start || !e.changedTouches) return;
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
    if (e.target.nodeName !== "IMG") return;
    e.preventDefault();
    openImage(e.target, e.clientX, e.clientY);
  });

  // The app's own images are JPEG at 0.3: a turn makes one about a third bigger, once (turning it again keeps the size), and
  // doesn't blur it more at each turn.
  var ROTATE_QUALITY = 0.7;
  var rotated = function (img) {
    var canvas = $.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    var g = canvas.getContext("2d");
    g.translate(canvas.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(img, 0, 0);
    // A PNG keeps its transparency.
    return canvas.toDataURL(/^data:image\/png/.test(img.src) ? "image/png" : "image/jpeg", ROTATE_QUALITY);
  };
  var selectImage = function (img) {
    var r = $.createRange();
    r.selectNode(img);
    select(r);
  };
  // Through insertHTML, so undo brings the image back as it was.
  var replaceImage = function (img, change) {
    var copy = img.cloneNode();
    change(copy);
    selectImage(img);
    exec("insertHTML", copy.outerHTML);
  };
  var JUSTIFY = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight" };
  var image = function (index, key, change, value) {
    var img = content().querySelectorAll("img")[index];
    if (!img || imageKey(img) !== key || !content().isContentEditable) return;
    // A change works on the image selected: then the caret goes back where it was (a range follows the nodes around it),
    // not next to the image, or on it where a key would replace it. A note that had no caret is left without one.
    var s = selection(), caret = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    // A caret right after an image that is replaced would end up before its copy: insertHTML leaves it after.
    var after = caret && caret.collapsed && caret.startContainer === img.parentNode &&
      caret.startOffset === [].indexOf.call(img.parentNode.childNodes, img) + 1;
    var restore = !(after && (change === "size" || change === "rotate"));
    try {
      if (change === "size") replaceImage(img, function (copy) { copy.style.width = value; });
      else if (change === "rotate") {
        var src = rotated(img);
        replaceImage(img, function (copy) { copy.src = src; });
      } else if (change === "align") {
        selectImage(img);
        exec(JUSTIFY[value]);
      } else if (change === "delete") {
        selectImage(img);
        exec("delete");
      }
    } catch (error) {
      // An image the canvas can't read (a file of an old version): the app says so.
      post("${IMAGE_FAILED_MESSAGE}", String(error));
    }
    if (!caret) s.removeAllRanges();
    else if (restore && content().contains(caret.startContainer) && content().contains(caret.endContainer)) select(caret);
    refreshToolbar();
  };

  window.__fm = { toggle: toggle, insertImage: insertImage, image: image };
})();
`;
