/*
 * What the find and replace bar searches (spec B.8): it knows only this interface, and each editor gives it a target. A
 * text note's target runs the scripts the bar ran in the note's page before; a code note's sends requests to its page,
 * which answers each with a `found`.
 */

export interface FindCount {
  total: number;
  /** From 1; 0 when there is no match. */
  current: number;
}

export interface SearchOptions {
  /** Opened by a search result: the match is shown, and the page doesn't keep the focus (no keyboard on a phone). */
  keepKeyboardDown?: boolean;
}

export interface FindTarget {
  search(query: string, options?: SearchOptions): void;
  step(direction: "next" | "prev"): void;
  replace(query: string, replacement: string): void;
  replaceAll(query: string, replacement: string): void;
  clear(): void;
  /** Called after each of the above with what is now true. Returns the function that stops it. */
  subscribe(listener: (count: FindCount) => void): () => void;
}

export type FindRequest =
  | { type: "find"; query: string }
  | { type: "findStep"; direction: "next" | "prev" }
  | { type: "findReplace"; query: string; replacement: string }
  | { type: "findReplaceAll"; query: string; replacement: string }
  | { type: "findClear" };

export interface FindReply {
  type: "found";
  total: number;
  current: number;
}

const NONE: FindCount = { total: 0, current: 0 };

function listeners() {
  const set = new Set<(count: FindCount) => void>();
  return {
    tell: (count: FindCount) => set.forEach((listener) => listener(count)),
    subscribe: (listener: (count: FindCount) => void) => {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}

/** How many times `query` is in `text`, case ignored, side by side (as the browser's find steps through them). */
export function countMatches(query: string, text: string): number {
  if (!query) return 0;
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  let count = 0;
  let at = 0;
  while ((at = haystack.indexOf(needle, at)) !== -1) {
    count++;
    at += needle.length;
  }
  return count;
}

const CLEAR_SCRIPT = `window.getSelection && window.getSelection().removeAllRanges(); true;`;

/** The browser's find from the selection; at the end it starts again from the other end. */
function findScript(query: string, backwards: boolean) {
  const quoted = JSON.stringify(query);
  return `
    (function(){
      var found = window.find(${quoted}, false, ${backwards}, true, false, false, false);
      if (!found) {
        var editor = document.querySelector('[contenteditable]');
        if (editor) {
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(${backwards});
          sel.removeAllRanges();
          sel.addRange(range);
          window.find(${quoted}, false, ${backwards}, true, false, false, false);
        }
      }
    })();
    true;
  `;
}

/**
 * The text page: the scripts and the counting the bar had, moved here as they are. `refresh` counts again after the
 * note's text changed (the bar counted again when its text did).
 */
export function createTextFindTarget(run: (script: string) => void, plainText: () => string): FindTarget & { refresh(): void } {
  const { tell, subscribe } = listeners();
  let query = "";
  let count: FindCount = NONE;
  const set = (next: FindCount) => {
    count = next;
    tell(count);
  };

  return {
    subscribe,
    search(text, options) {
      query = text;
      const total = countMatches(text, plainText());
      if (!text || total === 0) {
        set({ total, current: 0 });
        run(CLEAR_SCRIPT);
        return;
      }
      set({ total, current: 1 });
      const quoted = JSON.stringify(text);
      run(`
        (function(){
          var editor = document.querySelector('[contenteditable]');
          if (editor) {
            var sel = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            window.find(${quoted}, false, false, true, false, false, false);
            ${options?.keepKeyboardDown ? "if (document.activeElement && document.activeElement.blur) document.activeElement.blur();" : ""}
          }
        })();
        true;
      `);
    },
    step(direction) {
      if (count.total === 0) return;
      let current = direction === "next" ? count.current + 1 : count.current - 1;
      if (current > count.total) current = 1;
      if (current < 1) current = count.total;
      set({ total: count.total, current });
      run(findScript(query, direction === "prev"));
    },
    replace(text, replacement) {
      if (count.total === 0 || !text) return;
      run(`
        (function(){
          var sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.toString().length > 0) {
            document.execCommand('insertText', false, ${JSON.stringify(replacement)});
          }
        })();
        true;
      `);
      const before = count.total;
      setTimeout(() => {
        set({ total: Math.max(0, before - 1), current: Math.min(count.current, Math.max(0, before - 1)) });
        if (before - 1 > 0) run(findScript(text, false));
      }, 150);
    },
    replaceAll(text, replacement) {
      if (count.total === 0 || !text) return;
      run(`
        (function(){
          var editor = document.querySelector('[contenteditable]');
          if (!editor) return;
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          var n = 0;
          while (window.find(${JSON.stringify(text)}, false, false, false, false, false, false)) {
            document.execCommand('insertText', false, ${JSON.stringify(replacement)});
            n++;
            if (n > 1000) break;
          }
        })();
        true;
      `);
      set(NONE);
    },
    clear() {
      query = "";
      set(NONE);
      run(CLEAR_SCRIPT);
    },
    refresh() {
      if (!query) return;
      const total = countMatches(query, plainText());
      set({ total, current: total === 0 ? 0 : Math.min(count.current, total) });
    },
  };
}

/** The code page: requests go out with `post`; the editor hands the page's `found` replies to `handle`. */
export function createCodeFindTarget(post: (request: FindRequest) => void): FindTarget & { handle(reply: FindReply): void } {
  const { tell, subscribe } = listeners();
  return {
    subscribe,
    // The code page never takes the focus for a search: there is no keyboard to keep down.
    search: (query) => post({ type: "find", query }),
    step: (direction) => post({ type: "findStep", direction }),
    replace: (query, replacement) => post({ type: "findReplace", query, replacement }),
    replaceAll: (query, replacement) => post({ type: "findReplaceAll", query, replacement }),
    clear: () => post({ type: "findClear" }),
    handle: (reply) => tell({ total: reply.total, current: reply.current }),
  };
}
