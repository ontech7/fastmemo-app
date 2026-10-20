/*
 * Voice dictation post-processing.
 *
 * Speech engines return a raw stream of words ("oggi piove virgola forse domani punto").
 * These helpers turn that into usable prose by:
 *  - replacing spoken punctuation / line-break commands with real symbols, per language;
 *  - fixing the spacing around punctuation;
 *  - auto-capitalizing the start of each sentence (Latin-script languages only).
 */

/** [spoken phrase, inserted token] — ordered longest-phrase-first so multi-word commands win. */
type CommandList = [string, string][];

const COMMANDS: Record<string, CommandList> = {
  it: [
    ["punto e virgola", ";"],
    ["punto interrogativo", "?"],
    ["punto esclamativo", "!"],
    ["punto di domanda", "?"],
    ["due punti", ":"],
    ["nuovo paragrafo", "\n\n"],
    ["vai a capo", "\n"],
    ["a capo", "\n"],
    ["nuova riga", "\n"],
    ["punto", "."],
    ["virgola", ","],
  ],
  en: [
    ["exclamation mark", "!"],
    ["exclamation point", "!"],
    ["question mark", "?"],
    ["new paragraph", "\n\n"],
    ["new line", "\n"],
    ["newline", "\n"],
    ["semicolon", ";"],
    ["full stop", "."],
    ["colon", ":"],
    ["period", "."],
    ["comma", ","],
  ],
  de: [
    ["neuer absatz", "\n\n"],
    ["neue zeile", "\n"],
    ["zeilenumbruch", "\n"],
    ["fragezeichen", "?"],
    ["ausrufezeichen", "!"],
    ["doppelpunkt", ":"],
    ["semikolon", ";"],
    ["strichpunkt", ";"],
    ["punkt", "."],
    ["komma", ","],
  ],
  es: [
    ["signo de interrogación", "?"],
    ["signo de exclamación", "!"],
    ["nuevo párrafo", "\n\n"],
    ["salto de línea", "\n"],
    ["nueva línea", "\n"],
    ["punto y coma", ";"],
    ["dos puntos", ":"],
    ["interrogación", "?"],
    ["exclamación", "!"],
    ["punto", "."],
    ["coma", ","],
  ],
  fr: [
    ["point d'interrogation", "?"],
    ["point d'exclamation", "!"],
    ["nouveau paragraphe", "\n\n"],
    ["retour à la ligne", "\n"],
    ["nouvelle ligne", "\n"],
    ["à la ligne", "\n"],
    ["point-virgule", ";"],
    ["point virgule", ";"],
    ["deux points", ":"],
    ["virgule", ","],
    ["point", "."],
  ],
};

/** Languages whose scripts have no upper/lower case — skip capitalization for these. */
const NON_CASED = new Set(["zh", "ja", "ko"]);

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const languagePrefix = (language: string): string => (language || "").split("-")[0].toLowerCase();

/** Replace spoken punctuation/line-break commands with their symbols. */
function applyCommands(text: string, prefix: string): string {
  const list = COMMANDS[prefix];
  if (!list) return text;

  let out = text;
  for (const [phrase, token] of list) {
    // keep the leading boundary (start or whitespace); require a trailing boundary too
    const re = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$|[.,;:!?])`, "giu");
    out = out.replace(re, (_match, lead: string) => `${lead}${token}`);
  }
  return out;
}

/** Tidy spacing introduced by command replacement. */
function normalizeSpacing(text: string): string {
  return text
    .replace(/[ \t]+([.,;:!?])/g, "$1") // no space before punctuation
    .replace(/([.,;:!?])(?=[^\s.,;:!?])/g, "$1 ") // one space after punctuation before a word
    .replace(/[ \t]*\n[ \t]*/g, "\n") // trim around line breaks
    .replace(/\n{3,}/g, "\n\n") // at most one blank line
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces
    .trim();
}

/** Uppercase the first letter of the text and the first letter after . ! ? or a newline. */
function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n+)([a-zà-ÿ])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

interface FormatOptions {
  capitalize?: boolean;
}

/**
 * Turn a raw dictation transcript into formatted text (plain text, `\n` for line breaks).
 */
export function formatVoiceTranscript(raw: string, language: string, options: FormatOptions = {}): string {
  const text = (raw || "").trim();
  if (!text) return "";

  const prefix = languagePrefix(language);
  const capitalize = (options.capitalize ?? true) && !NON_CASED.has(prefix);

  let result = normalizeSpacing(applyCommands(text, prefix));
  if (capitalize) result = capitalizeSentences(result);

  return result;
}

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A list line as the AI cleanup writes it ("- milk"), or a bullet ("• milk"). */
const LIST_LINE = /^\s*[-•*]\s+(.*)$/;

/**
 * Convert formatted dictation text into HTML suitable for `RichEditor.insertHTML`,
 * turning `\n` into line breaks and, with `lists` (text the AI wrote), runs of "- "
 * lines into a bulleted list. A leading space keeps it detached from the word before
 * the caret.
 */
export function voiceTextToHtml(
  text: string,
  { leadingSpace = true, lists = false }: { leadingSpace?: boolean; lists?: boolean } = {}
): string {
  if (!text) return "";
  const lines = text.split("\n");
  if (!lists || !lines.some((line) => LIST_LINE.test(line))) {
    return (leadingSpace ? " " : "") + escapeHtml(text).replace(/\n/g, "<br>");
  }

  // text lines joined by <br>; a list is a block of its own, so no <br> (and no blank line) next to it
  let html = "";
  let items: string[] = [];
  let previous: "start" | "text" | "list" = "start";
  const flushList = () => {
    if (!items.length) return;
    html += `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    items = [];
    previous = "list";
  };
  lines.forEach((line, i) => {
    const item = LIST_LINE.exec(line);
    if (item) {
      items.push(item[1].trim());
      return;
    }
    flushList();
    const nextIsList = i + 1 < lines.length && LIST_LINE.test(lines[i + 1]);
    if (!line.trim() && (previous === "list" || nextIsList)) return;
    if (previous === "text") html += "<br>";
    html += escapeHtml(line);
    previous = "text";
  });
  flushList();
  return (leadingSpace && !html.startsWith("<ul>") ? " " : "") + html;
}

/** Split formatted dictation into individual lines (used by list-based editors), without list markers. */
export function voiceTextToLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => (LIST_LINE.exec(line)?.[1] ?? line).trim())
    .filter(Boolean);
}
