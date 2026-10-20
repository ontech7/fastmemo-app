import { store } from "@/slicers/store";
import type { Category } from "@/types";

export function findCategoryByName(name: string): Category | undefined {
  const state = store.getState();
  const categories = state.categories.items;
  const lowerName = name.toLowerCase();
  return categories.find((c: Category) => c.name.toLowerCase().includes(lowerName));
}

/** Strip HTML tags and decode entities to get plain text for AI processing. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|h[1-6]|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The answer without a reasoning block: thinking is turned off for every action, but a model may still open one. A block
 * left open (the token budget ran out inside it) leaves no answer at all.
 */
export function stripThinking(text: string): string {
  const open = text.indexOf("<think>");
  if (open === -1) return text;
  const close = text.indexOf("</think>", open);
  if (close === -1) return text.slice(0, open).trim();
  return (text.slice(0, open) + text.slice(close + "</think>".length)).trim();
}
