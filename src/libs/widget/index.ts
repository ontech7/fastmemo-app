import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { t as translate } from "i18next";
import { requestWidgetUpdate } from "react-native-android-widget";

import { configs } from "@/configs";
import { widgetState } from "@/libs/widget/snapshot";
import { WIDGETS } from "@/widgets/registry";

import type { WidgetState } from "@/libs/widget/snapshot";
import type { RootState } from "@/types";
import type { Store } from "@reduxjs/toolkit";

/*
 * The widgets' data (spec D.6, ADR-045): the app writes a small state (the chosen note's copy, the texts, the links) and
 * asks for a redraw; the widgets read that state, never the notes, and with the app closed (the launcher's requests come
 * to `src/widgets/taskHandler.tsx`).
 */

const STATE_KEY = "@widgetState";
const SCHEME = configs.app.slug.toLowerCase();

const t = (key: string) => translate(key);

/** The state as this phone shows it now. */
const stateOf = (state: RootState): WidgetState => {
  const id = state.settings.widgetNoteId;
  return widgetState(id ? state.notes.items.find((note) => note.id === id) : undefined, t, SCHEME);
};

/** The last state written; before any, one with no note in the phone's language (a widget added before the app ran). */
export async function readWidgetState(): Promise<WidgetState> {
  try {
    const stored = await AsyncStorage.getItem(STATE_KEY);
    if (stored) return JSON.parse(stored) as WidgetState;
  } catch {}
  return widgetState(undefined, t, SCHEME);
}

const redraw = (state: WidgetState) =>
  Promise.all(
    Object.entries(WIDGETS).map(([widgetName, draw]) =>
      requestWidgetUpdate({ widgetName, renderWidget: () => draw(state) }).catch(() => {})
    )
  );

/** After the home has drawn: writes the state now, and again when the featured note, the choice or the language changes. */
export function startWidget(store: Store<RootState>): () => void {
  let written = "";
  let chain: Promise<unknown> = Promise.resolve();
  const write = () => {
    const state = stateOf(store.getState());
    const json = JSON.stringify(state);
    if (json === written) return;
    written = json;
    chain = chain.then(() => AsyncStorage.setItem(STATE_KEY, json).then(() => redraw(state))).catch(() => {});
  };

  // Only what can change the state: the notes, the choice (the language comes through i18n).
  let notes = store.getState().notes.items;
  let chosen = store.getState().settings.widgetNoteId;
  const unsubscribe = store.subscribe(() => {
    const { notes: nextNotes, settings } = store.getState();
    if (nextNotes.items === notes && settings.widgetNoteId === chosen) return;
    notes = nextNotes.items;
    chosen = settings.widgetNoteId;
    write();
  });
  i18n.on("languageChanged", write);
  write();

  return () => {
    unsubscribe();
    i18n.off("languageChanged", write);
  };
}
