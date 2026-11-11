/** The message an editor's page sends the app when a script inside it fails (ADR-035). */
export const PAGE_ERROR_MESSAGE = "FASTMEMO_PAGE_ERROR";

/**
 * Plain JS for an editor's page (the rich text editor, CodeMirror): forwards its uncaught errors and rejections to the
 * app as `{ type: PAGE_ERROR_MESSAGE, data: { message, file, line } }`. Never anything of the document. Safe to run
 * twice (`window.__fmErrors`). Runs before the page's own code, so an error in it is caught too.
 */
export const PAGE_ERROR_SCRIPT = `(function(){
  if (window.__fmErrors) return;
  window.__fmErrors = true;
  var MAX = 300;
  function post(message, file, line) {
    var name = String(file || "").split(/[\\\\/]/).pop() || "";
    var payload = JSON.stringify({ type: ${JSON.stringify(PAGE_ERROR_MESSAGE)}, data: {
      message: String(message || "").slice(0, MAX), file: name, line: typeof line === "number" ? line : 0 } });
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(payload);
      else if (window.parent && window.parent !== window) window.parent.postMessage(payload, "*");
    } catch (e) {}
  }
  window.addEventListener("error", function (event) {
    if (!event || event.message === undefined) return;
    post(event.message, event.filename, event.lineno);
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    post(reason && reason.message !== undefined ? reason.message : reason, "", 0);
  });
})();`;
