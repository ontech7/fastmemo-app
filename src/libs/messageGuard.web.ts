/**
 * The editors' iframes talk to the app with `postMessage`, and the web WebView hands every `message` event of the window
 * to them: a page that opened or framed the app could post a `CONTENT_CHANGE` and rewrite the open note (LL-060). Only
 * this page and its own iframes are heard. Installed before any WebView listens (`app/_layout.tsx`): at the window a
 * capturing listener runs in the order it was added, so this one goes first.
 */
export function installMessageGuard(): void {
  window.addEventListener(
    "message",
    (event) => {
      const source = event.source;
      // No source: a port or an event made by this page's own code.
      if (!source || source === window) return;
      for (const frame of document.querySelectorAll("iframe")) {
        if (frame.contentWindow === source) return;
      }
      event.stopImmediatePropagation();
    },
    true
  );
}
