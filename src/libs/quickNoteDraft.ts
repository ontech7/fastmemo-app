import AsyncStorage from "@react-native-async-storage/async-storage";

/*
 * What is typed in the home's quick note bar and not sent yet (LL-084): kept on the device so closing the app doesn't lose
 * it. It is only ever put back in the bar; it never becomes a note by itself, and it is never synced.
 */

export const QUICK_NOTE_DRAFT_KEY = "@quickNoteDraft";

/** The draft, as typed; "" when there is none or the read failed. Never rejects. */
export async function loadQuickNoteDraft(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(QUICK_NOTE_DRAFT_KEY)) ?? "";
  } catch {
    return "";
  }
}

/** Keeps `text` as the draft; a blank text removes it. Never rejects. */
export async function saveQuickNoteDraft(text: string): Promise<void> {
  try {
    if (text.trim()) await AsyncStorage.setItem(QUICK_NOTE_DRAFT_KEY, text);
    else await AsyncStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
  } catch {
    // A draft that couldn't be written is lost like before; the note itself is never at stake.
  }
}
