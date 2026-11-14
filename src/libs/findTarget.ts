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

export interface ClearOptions {
  /** Esc closed the bar: the caret goes back into the note, where it was before the search. */
  backToNote?: boolean;
}

export interface FindTarget {
  search(query: string, options?: SearchOptions): void;
  step(direction: "next" | "prev"): void;
  replace(query: string, replacement: string): void;
  replaceAll(query: string, replacement: string): void;
  /** The marks go. Nothing is done when nothing was searched since the last clear: the note's caret stays. */
  clear(options?: ClearOptions): void;
  /** Called after each of the above with what is now true. Returns the function that stops it. */
  subscribe(listener: (count: FindCount) => void): () => void;
  /** The bar opened or closed: while it is open, Esc in the note's page is the bar's. */
  setOpen(open: boolean): void;
  /** Called when Esc is pressed in the note's page while the bar is open. Returns the function that stops it. */
  onEscape(listener: () => void): () => void;
}

export type FindRequest =
  | { type: "find"; query: string }
  | { type: "findStep"; direction: "next" | "prev" }
  | { type: "findReplace"; query: string; replacement: string }
  | { type: "findReplaceAll"; query: string; replacement: string }
  | { type: "findClear"; restore?: boolean }
  | { type: "findOpen"; open: boolean };

export interface FindReply {
  type: "found";
  total: number;
  current: number;
}

/** Esc in the code page while the bar is open. */
export interface FindEscape {
  type: "findEscape";
}

/**
 * The text page's find functions, on `window` (`@/libs/richTextEditor`): `open(open)` says whether the bar is open (the
 * page keeps where its caret was), `back()` puts the caret back there, in the note.
 */
export const FIND_PAGE = "__fmFind";

function escapeListeners() {
  const set = new Set<() => void>();
  return {
    escaped: () => set.forEach((listener) => listener()),
    onEscape: (listener: () => void) => {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
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
 * note's text changed (the bar counted again when its text did). Back to the note, `focusNote` gives the page the focus
 * (the keyboard on a phone), then the page puts the caret where it was when the bar opened: pell's own saved caret is lost
 * once the search cleared the selection. `escaped` is the page's Esc, from the editor.
 */
export function createTextFindTarget(
  run: (script: string) => void,
  plainText: () => string,
  focusNote: () => void = () => {}
): FindTarget & { refresh(): void; escaped(): void } {
  const { tell, subscribe } = listeners();
  const { escaped, onEscape } = escapeListeners();
  let query = "";
  let searched = false;
  let count: FindCount = NONE;
  const set = (next: FindCount) => {
    count = next;
    tell(count);
  };

  return {
    subscribe,
    onEscape,
    escaped,
    setOpen(open) {
      run(`window.${FIND_PAGE} && window.${FIND_PAGE}.open(${open}); true;`);
    },
    search(text, options) {
      query = text;
      searched = true;
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
    clear(options) {
      if (searched) {
        searched = false;
        query = "";
        set(NONE);
        run(CLEAR_SCRIPT);
      }
      if (!options?.backToNote) return;
      focusNote();
      run(`window.${FIND_PAGE} && window.${FIND_PAGE}.back(); true;`);
    },
    refresh() {
      if (!query) return;
      const total = countMatches(query, plainText());
      set({ total, current: total === 0 ? 0 : Math.min(count.current, total) });
    },
  };
}

/** The code page: requests go out with `post`; the editor hands the page's `found` replies to `handle`. */
export function createCodeFindTarget(
  post: (request: FindRequest) => void
): FindTarget & { handle(reply: FindReply | FindEscape): void } {
  const { tell, subscribe } = listeners();
  const { escaped, onEscape } = escapeListeners();
  let searched = false;
  const searching = (request: FindRequest) => {
    searched = true;
    post(request);
  };
  return {
    subscribe,
    onEscape,
    // The code page never takes the focus for a search: there is no keyboard to keep down.
    search: (query) => searching({ type: "find", query }),
    step: (direction) => searching({ type: "findStep", direction }),
    replace: (query, replacement) => searching({ type: "findReplace", query, replacement }),
    replaceAll: (query, replacement) => searching({ type: "findReplaceAll", query, replacement }),
    // Back to the note: the page puts the caret back where it was before the search, and takes the focus.
    clear(options) {
      if (!searched && !options?.backToNote) return;
      searched = false;
      post(options?.backToNote ? { type: "findClear", restore: true } : { type: "findClear" });
    },
    setOpen: (open) => post({ type: "findOpen", open }),
    handle: (reply) => (reply.type === "findEscape" ? escaped() : tell({ total: reply.total, current: reply.current })),
  };
}
