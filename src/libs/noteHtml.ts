/** The colours the kinds of line added in 4.1.0 are drawn with: the editor's dark ones, or a printed page's. */
export interface BlockColors {
  /** The note's text. */
  text: string;
  /** A quote's text, an empty box's border, a ticked line's text. */
  muted: string;
  /** A quote's bar and a ticked box. */
  accent: string;
  /** A rule. */
  line: string;
  /** An empty box. */
  boxFill: string;
  /** A link's text. */
  link: string;
  /** A link to another note: its fill, its border and its text. */
  pill: string;
  pillBorder: string;
  pillText: string;
}

/** The tick of a ticked box: white, on the accent. */
const TICK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' " +
  "stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7'/%3E%3C/svg%3E\")";

/** The arrow after a note link's label, as a mask: it takes the text's colour. */
const ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' " +
  "stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 16L16 8M9 8h7v7'/%3E%3C/svg%3E\")";

/**
 * The CSS of the kinds of line added in 4.1.0 (heading 2, quote, checkbox list, rule, links, links to another note), for the
 * editor and for print. A checkbox list is the editor library's own markup (`ol.x-todo`, each item starting with
 * `span.x-todo-box` around an `input`): its rules, which push the box out of the line, are overridden here. A ticked line
 * is told by its box alone (`li:has(input:checked)`): an engine without `:has` shows the tick and no dimming.
 */
export function noteBlockCss(colors: BlockColors): string {
  return `
    h2 { font-size: 1.375em; line-height: 1.3; margin: 0.5em 0 0.25em; }
    blockquote { margin: 0; padding: 2px 0 2px 10px; border-left: 3px solid ${colors.accent}; color: ${colors.muted}; }
    :not(blockquote) + blockquote { margin-top: 6px; }
    blockquote + :not(blockquote) { margin-top: 6px; }
    hr { height: 0; border: 0; border-top: 1px solid ${colors.line}; margin: 12px 0; }
    ol.x-todo { padding-left: 0; }
    .x-todo li { list-style: none; }
    .x-todo-box { position: static; left: auto; display: inline-block; vertical-align: -3px; margin-right: 8px; }
    .x-todo-box input {
      position: static; -webkit-appearance: none; appearance: none; box-sizing: border-box; display: block;
      width: 18px; height: 18px; margin: 0; border: 1.5px solid ${colors.muted}; border-radius: 5px;
      background: ${colors.boxFill}; cursor: pointer;
    }
    .x-todo-box input:checked { background: ${colors.accent} ${TICK} center / 12px no-repeat; border-color: ${colors.accent}; }
    .x-todo li:has(input:checked) { color: ${colors.muted}; text-decoration-line: line-through; }
    a[href] { color: ${colors.link}; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
    a[href^="#fm-note-"] {
      display: inline-block; padding: 0 6px 0 7px; border: 1px solid ${colors.pillBorder}; border-radius: 8px;
      background: ${colors.pill}; color: ${colors.pillText}; text-decoration: none; line-height: 1.35; font-weight: 500;
      -webkit-user-select: none; user-select: none; white-space: nowrap; max-width: 100%; overflow: hidden;
      text-overflow: ellipsis; vertical-align: bottom;
    }
    a[href^="#fm-note-"]::after {
      content: ""; display: inline-block; width: 0.7em; height: 0.7em; margin-left: 4px; vertical-align: 0;
      background-color: currentColor; -webkit-mask: ${ARROW} center / contain no-repeat; mask: ${ARROW} center / contain no-repeat;
    }
  `;
}
