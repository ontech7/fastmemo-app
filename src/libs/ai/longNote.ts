import {
  chunkTexts,
  estimateTokens,
  joinNoteBlocks,
  type NoteSegment,
  sameText,
  splitNoteBlocks,
  withoutSummary,
} from "./blocks";
import { LONG_NOTE_MAX_SECONDS, SHORTEN_MIN_TOKENS, SUMMARY_PART_TOKENS } from "./constants";
import { currentGeneration, generateEditorContent, getModelSpeed, resolveLanguage, selectedModelId } from "./context";
import { visibleStreamText } from "./helpers";
import type { AIModelId, EditorAction, LongNoteProgress } from "./types";

/*
 * Text notes of any length (spec docs/AI_QWEN35_UPGRADE.md §7.5). A rewrite (grammar, shortening, translation) runs one
 * paragraph, heading or list item at a time and puts each back in its place, so the note keeps its structure. A summary
 * reads the note in parts, summarizes each, then merges them; it goes on top of the note, which stays below it. Each step
 * is one completion: the progress shows, a cancel stops every step left, and nothing is applied until the end.
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
  /** The rewritten text (a rewrite), or the summary. */
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
    if (segment.kind !== "unit") return;
    if (action === "shorten" && (!SHORTEN_TAGS.has(segment.tag) || estimateTokens(segment.text) < SHORTEN_MIN_TOKENS)) return;
    targets.push(i);
  });
  return targets;
}

/*
 * The steps done, by action, language, model and input text: a run again after a cancel, or over paragraphs that didn't
 * change, takes them at once. Memory only, never stored or synced.
 */
const CACHE_MAX = 300;
const _cache = new Map<string, string>();

function remember(key: string, value: string) {
  _cache.delete(key);
  _cache.set(key, value);
  if (_cache.size > CACHE_MAX) _cache.delete(_cache.keys().next().value as string);
}

/** Forgets the steps done (the AI evaluation times every run from scratch). */
export function clearLongNoteCache() {
  _cache.clear();
}

const cacheKey = (action: EditorAction, lang: string, modelId: AIModelId, text: string) =>
  [action, lang, modelId, text].join("\u0000");

/** Runs `action` on each paragraph, heading or list item of the note `html` it applies to. */
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
  const targets = targetsOf(action, segments);
  // nothing it applies to (shortening a note of short lines): as if the AI found nothing to improve
  if (targets.length === 0) return { success: false, error: "implausible_output" };

  const rewrites = new Map<number, string>();
  const done: string[] = [];
  for (let step = 0; step < targets.length; step++) {
    if (generation !== currentGeneration()) return { success: false, error: "cancelled" };
    handlers.onProgress?.({ done: step, total: targets.length });
    const unit = segments[targets[step]] as Unit;
    const key = cacheKey(action, lang, modelId, unit.text);
    let next = _cache.get(key);
    if (next === undefined) {
      let streamed = "";
      const result = await generateEditorContent(
        action,
        unit.text,
        (token) => {
          streamed += token;
          handlers.onText?.([...done, visibleStreamText(streamed)].join("\n\n"));
        },
        { lang, modelId, generation }
      );
      if (result.success && result.text) next = result.text.trim();
      // the guard threw this one away: it stays as it was, the rest goes on
      else if (result.error === "implausible_output") next = unit.text.trim();
      else return { success: false, error: result.error ?? "error" };
      remember(key, next);
    }
    rewrites.set(targets[step], next);
    done.push(next);
    handlers.onText?.(done.join("\n\n"));
  }
  handlers.onProgress?.({ done: targets.length, total: targets.length });

  if (targets.every((i) => sameText(rewrites.get(i) ?? "", (segments[i] as Unit).text))) {
    return { success: false, error: "implausible_output" };
  }
  return { success: true, html: joinNoteBlocks(segments, rewrites), text: done.join("\n\n") };
}

/** What a summary reads: the note's units without a summary added on top before, one per line. */
function summaryInput(segments: NoteSegment[], labels: string[]): string[] {
  return withoutSummary(segments, labels)
    .filter((segment): segment is Unit => segment.kind === "unit")
    .map((unit) => unit.text.trim())
    .filter(Boolean);
}

/**
 * A summary of the note `html` (its title gives context). Read in parts when it's long: each part summarized, then the
 * parts' summaries merged. `labels`: the label a summary added before has on top, in every language (it isn't read again).
 */
export async function summarizeNote(
  html: string,
  title: string,
  labels: string[],
  handlers: LongNoteHandlers = {},
  options: LongNoteOptions = {}
): Promise<LongNoteResult> {
  const generation = currentGeneration();
  const modelId = options.modelId ?? selectedModelId();
  const lang = options.lang ?? resolveLanguage();
  const texts = summaryInput(splitNoteBlocks(html), labels);
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

function secondsFor(
  action: LongNoteAction,
  segments: NoteSegment[],
  speed: { prefill: number; generate: number },
  labels: string[]
): number {
  if (action === "summarize") {
    const tokens = estimateTokens(summaryInput(segments, labels).join("\n"));
    const parts = Math.max(1, Math.ceil(tokens / SUMMARY_PART_TOKENS));
    const written = parts > 1 ? parts * 60 + 150 : 150;
    return tokens / speed.prefill + written / speed.generate;
  }
  const tokens = targetsOf(action, segments).reduce((sum, i) => sum + estimateTokens((segments[i] as Unit).text), 0);
  return tokens / speed.prefill + (tokens * (action === "shorten" ? 0.6 : 1)) / speed.generate;
}

/** About how long `action` takes on the note `html`, in seconds, at the speed the model runs on this device. */
export function estimateSeconds(action: LongNoteAction, html: string, modelId?: AIModelId, labels: string[] = []): number {
  return secondsFor(action, splitNoteBlocks(html), getModelSpeed(modelId), labels);
}

/** The actions that would take longer on the note `html` than anyone should wait: they're turned off for it. */
export function tooLongForAI(html: string, modelId?: AIModelId, labels: string[] = []): LongNoteAction[] {
  const segments = splitNoteBlocks(html);
  const speed = getModelSpeed(modelId);
  return (["summarize", "fix_grammar", "shorten", "translate"] as const).filter(
    (action) => secondsFor(action, segments, speed, labels) > LONG_NOTE_MAX_SECONDS
  );
}
