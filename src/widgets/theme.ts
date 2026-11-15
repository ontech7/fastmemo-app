import { CARD_TYPE_COLOR, COLOR, GLASS } from "@/constants/styles";

import type { NoteType } from "@/types";

/*
 * The widgets' look (spec D.6), from the app's tokens: the library takes "#rrggbb" or "rgba(r, g, b, a)" strings, and
 * Geist by its file name (the plugin copies the files). heroicons outline paths (24 × 24, stroke 1.5), as the launcher
 * shortcuts' drawables in app.config.ts.
 */

type Color = `#${string}` | `rgba(${number}, ${number}, ${number}, ${number})`;
const c = (value: string) => value as Color;

export const W = {
  surface: c(COLOR.surface),
  border: c(GLASS.border),
  field: c(GLASS.fill),
  text: c(COLOR.textPrimary),
  secondary: c(COLOR.textSecondary),
  muted: c(COLOR.textMuted),
  button: c(COLOR.accentMuted),
  buttonBorder: c(COLOR.accentMutedBorder),
  icon: COLOR.softWhite,
  radius: 24,
  font: { regular: "Geist-Regular", medium: "Geist-Medium", semiBold: "Geist-SemiBold" },
  chip: c(GLASS.fillStrong),
};

export const typeColor = (type: NoteType) => CARD_TYPE_COLOR[type] ?? CARD_TYPE_COLOR.text;

const PATHS = {
  pencil:
    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125",
  list: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z",
  mic: "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z",
  text: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  kanban:
    "M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z",
  code: "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5",
  check: "m4.5 12.75 6 6 9-13.5",
} as const;

/** An icon as the SVG string `SvgWidget` takes. */
export const icon = (name: keyof typeof PATHS, color: string, strokeWidth = 1.5) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name]}"/></svg>`;

export const typeIcon: Record<NoteType, keyof typeof PATHS> = { text: "text", todo: "list", kanban: "kanban", code: "code" };
