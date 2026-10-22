import {
  blocksText,
  chunkTexts,
  estimateTokens,
  isSummaryLabel,
  joinNoteBlocks,
  type NoteSegment,
  sameText,
  splitNoteBlocks,
  splitText,
  withoutSummary,
} from "./blocks";
import { LONG_NOTE_MAX_SECONDS, REWRITE_PIECE_TOKENS, SHORTEN_MIN_TOKENS, SUMMARY_PART_TOKENS } from "./constants";
import { currentGeneration, generateEditorContent, getModelSpeed, resolveLanguage, selectedModelId } from "./context";
import { visibleStreamText } from "./helpers";
import type { AIModelId, EditorAction, LongNoteProgress } from "./types";

/*
 * Text notes of any length (ADR-004, long notes). A rewrite (grammar, shortening, translation) runs one
 * line at a time (a paragraph, a heading, a list item; a very long paragraph a few sentences at a time) and puts each back
 * in its place, so the note keeps its structure. A summary reads the note in parts, summarizes each, then merges them; it
 * goes on top of the note, which stays below it. Each step is one completion: the progress shows, a cancel stops every step
 * left, and nothing is applied until the end.
 */

export type LongNoteAction = "summarize" | "fix_grammar" | "shorten" | "translate";

export const LONG_NOTE_ACTIONS: ReadonlySet<EditorAction> = new Set<EditorAction>([
  "summarize",
  "fix_grammar",
  "shorten",
  "translate",
]);

export interface LongNoteHandlers {
  onProgress?: (progress: LongNoteProgress) => void;
  /** What the AI has written so far (the steps done, then the one under way). */
  onText?: (text: string) => void;
}

export interface LongNoteOptions {
  lang?: string;
  modelId?: AIModelId;
}

export interface LongNoteResult {
  success: boolean;
  /** A rewrite: the note's new HTML. */
  html?: string;
  /** A rewrite: the note's new text, line by line. A summary: the summary. */
  text?: string;
  error?: string;
}

type Unit = Extract<NoteSegment, { kind: "unit" }>;

/** Shortening leaves headings and list items alone, and paragraphs too short to shorten. */
const SHORTEN_TAGS = new Set(["", "div", "p", "blockquote"]);

/** The units `action` rewrites, by index in `segments`. */
function targetsOf(action: LongNoteAction, segments: NoteSegment[]): number[] {
  const targets: number[] = [];
  segments.forEach((segment, i) => {
    if (segment.kind !== "unit" || isSummaryLabel(segment)) return;
    if (action === "shorten" && (!SHORTEN_TAGS.has(segment.tag) || estimateTokens(segment.text) < SHORTEN_MIN_TOKENS)) return;
    targets.push(i);
  });
  return targets;
}

/*
 * The steps done, by action, language, model and input text: a run again after a cancel, or over paragraphs that didn't
 * change, takes them at once. Memory only, never stored or synced. A step the guard threw away isn't kept (a run again
 * tries it again), and the whole cache goes when the user turns a result down (`clearLongNoteCache`).
 */
const CACHE_MAX = 300;
const _cache = new Map<string, string>();

function remember(key: string, value: string) {
  _cache.delete(key);
  _cache.set(key, value);
  if (_cache.size > CACHE_MAX) _cache.delete(_cache.keys().next().value as string);
}

/** Forgets the steps done: the user turned a result down (a run again asks the model again), or the AI evaluation times a run. */
export function clearLongNoteCache() {
  _cache.clear();
}

const cacheKey = (action: EditorAction, lang: string, modelId: AIModelId, text: string) =>
  [action, lang, modelId, text].join("\u0000");

/** A rewrite answered with the text as it was: the guard threw it away, or it didn't fit (that line stays, the rest goes on). */
const KEEPS_LINE = new Set(["implausible_output", "too_long"]);

/** Runs `action` on each line of the note `html` it applies to (a long paragraph a few sentences at a time). */
export async function rewriteNote(
  action: Exclude<LongNoteAction, "summarize">,
  html: string,
  handlers: LongNoteHandlers = {},
  options: LongNoteOptions = {}
): Promise<LongNoteResult> {
  const generation = currentGeneration();
  const modelId = options.modelId ?? selectedModelId();
  const lang = options.lang ?? resolveLanguage();
  const segments = splitNoteBlocks(html);
  const steps = targetsOf(action, segments).flatMap((index) =>
    splitText((segments[index] as Unit).text, REWRITE_PIECE_TOKENS).map((piece) => ({ index, piece }))
  );
  // nothing it applies to (shortening a note of short lines): as if the AI found nothing to improve
  if (steps.length === 0) return { success: false, error: "implausible_output" };

  const rewrites = new Map<number, string>();
  let tooLong = 0;
  // the lines rewritten, then the one under way (its pieces so far)
  const done: string[] = [];
  const show = (current: string) => handlers.onText?.([...done, current].filter((t) => t.trim()).join("\n\n"));
  for (let step = 0; step < steps.length; step++) {
    if (generation !== currentGeneration()) return { success: false, error: "cancelled" };
    handlers.onProgress?.({ done: step, total: steps.length });
    const { index, piece } = steps[step];
    const sofar = rewrites.get(index) ?? "";
    const input = piece.trim();
    const key = cacheKey(action, lang, modelId, input);
    // (a piece of nothing but spaces stays as it is)
    let next = input ? _cache.get(key) : "";
    if (next === undefined) {
      let streamed = "";
      const result = await generateEditorContent(
        action,
        input,
        (token) => {
          streamed += token;
          show(sofar + visibleStreamText(streamed));
        },
        { lang, modelId, generation }
      );
      if (result.success && result.text) {
        next = result.text.trim();
        remember(key, next);
      } else if (KEEPS_LINE.has(result.error ?? "")) {
        if (result.error === "too_long") tooLong++;
        next = input;
      } else {
        return { success: false, error: result.error ?? "error" };
      }
    }
    // the spaces around a piece stay as they were (a paragraph's sentences joined back)
    const spaced = piece.slice(0, piece.length - piece.trimStart().length) + next + piece.slice(piece.trimEnd().length);
    rewrites.set(index, sofar + spaced);
    const lineDone = steps[step + 1]?.index !== index;
    if (lineDone) done.push((sofar + spaced).trim());
    show(lineDone ? "" : sofar + spaced);
  }
  handlers.onProgress?.({ done: steps.length, total: steps.length });

  if ([...rewrites].every(([index, text]) => sameText(text, (segments[index] as Unit).text))) {
    return { success: false, error: tooLong === steps.length ? "too_long" : "implausible_output" };
  }
  const next = joinNoteBlocks(segments, rewrites);
  return { success: true, html: next, text: blocksText(splitNoteBlocks(next)) };
}

/** What a summary reads: the note's lines, without a summary added on top before. */
function summaryInput(html: string): string[] {
  return splitNoteBlocks(withoutSummary(html))
    .filter((segment): segment is Unit => segment.kind === "unit")
    .map((unit) => unit.text.trim())
    .filter(Boolean);
}

/**
 * A summary of the note `html` (its title gives context). Read in parts when it's long: each part summarized, then the
 * parts' summaries merged. A summary added on top before isn't read again.
 */
export async function summarizeNote(
  html: string,
  title: string,
  handlers: LongNoteHandlers = {},
  options: LongNoteOptions = {}
): Promise<LongNoteResult> {
  const generation = currentGeneration();
  const modelId = options.modelId ?? selectedModelId();
  const lang = options.lang ?? resolveLanguage();
  const texts = summaryInput(html);
  if (texts.length === 0) return { success: false, error: "no_content" };
  const parts = chunkTexts(texts, SUMMARY_PART_TOKENS);
  const withTitle = (body: string) => (title.trim() ? `${title.trim()}\n${body}` : body);
  const run = (action: EditorAction, input: string, shownBefore: string[]) => {
    let streamed = "";
    return generateEditorContent(
      action,
      input,
      (token) => {
        streamed += token;
        handlers.onText?.([...shownBefore, visibleStreamText(streamed)].join("\n"));
      },
      { lang, modelId, generation }
    );
  };

  const total = parts.length > 1 ? parts.length + 1 : 1;
  const partials: string[] = [];
  if (parts.length > 1) {
    for (let step = 0; step < parts.length; step++) {
      if (generation !== currentGeneration()) return { success: false, error: "cancelled" };
      handlers.onProgress?.({ done: step, total });
      const key = cacheKey("summarize_part", lang, modelId, parts[step]);
      let partial = _cache.get(key);
      if (partial === undefined) {
        const result = await run("summarize_part", parts[step], partials);
        if (!result.success || !result.text) return { success: false, error: result.error ?? "error" };
        partial = result.text.trim();
        remember(key, partial);
      }
      partials.push(partial);
      handlers.onText?.(partials.join("\n"));
    }
  }

  if (generation !== currentGeneration()) return { success: false, error: "cancelled" };
  handlers.onProgress?.({ done: total - 1, total });
  const result = await run("summarize", withTitle(parts.length > 1 ? partials.join("\n") : parts[0]), []);
  if (!result.success || !result.text) return { success: false, error: result.error ?? "error" };
  handlers.onProgress?.({ done: total, total });
  return { success: true, text: result.text.trim() };
}

/**
 * What each completion reads besides its text (the chat template, and the system prompt where its cache misses): measured
 * as about half a second per line on the 2B and two on the 4B (AI evaluation, 2026-10).
 */
const STEP_TOKENS = 50;

function secondsFor(action: LongNoteAction, html: string, speed: { prefill: number; generate: number }): number {
  if (action === "summarize") {
    const tokens = estimateTokens(summaryInput(html).join("\n"));
    const parts = Math.max(1, Math.ceil(tokens / SUMMARY_PART_TOKENS));
    const steps = parts > 1 ? parts + 1 : 1;
    const written = parts > 1 ? parts * 90 + 150 : 150;
    return (tokens + steps * STEP_TOKENS) / speed.prefill + written / speed.generate;
  }
  const segments = splitNoteBlocks(html);
  const texts = targetsOf(action, segments).flatMap((i) => splitText((segments[i] as Unit).text, REWRITE_PIECE_TOKENS));
  const tokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
  const written = tokens * (action === "shorten" ? 0.6 : 1);
  return (tokens + texts.length * STEP_TOKENS) / speed.prefill + written / speed.generate;
}

/** About how long `action` takes on the note `html`, in seconds, at the speed the model runs on this device. */
export function estimateSeconds(action: LongNoteAction, html: string, modelId?: AIModelId): number {
  return secondsFor(action, html, getModelSpeed(modelId));
}

/** The actions that would take longer on the note `html` than anyone should wait: they're turned off for it. */
export function tooLongForAI(html: string, modelId?: AIModelId): LongNoteAction[] {
  const speed = getModelSpeed(modelId);
  return (["summarize", "fix_grammar", "shorten", "translate"] as const).filter(
    (action) => secondsFor(action, html, speed) > LONG_NOTE_MAX_SECONDS
  );
}
