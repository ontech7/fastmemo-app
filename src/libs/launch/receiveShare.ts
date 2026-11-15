import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";

import { noteFromShare } from "@/libs/launch/share";
import { reducePhoto } from "@/libs/reducePhoto";
import { getTextSize } from "@/utils/string";

/** A share read and its pictures reduced, ready to be a text note. */
export interface ReceivedShare {
  html: string;
  title: string;
  /** A picture left out: it didn't fit the note's limit (it and the ones after it). */
  overLimit: boolean;
  /** A picture that couldn't be read. */
  unreadable: boolean;
}

/**
 * What was shared to the app, as a note's HTML (spec D.3), or null when it holds nothing the app keeps. Only the raw
 * payloads: never the resolving call, which would fetch a shared address. Each picture is reduced as the editor's
 * (`reducePhoto`) and appended while the note stays within `limit` (null: no limit). The payloads stay until
 * `clearShare`: the pictures' addresses can be read only until then.
 */
export async function receiveShare(limit: number | null): Promise<ReceivedShare | null> {
  const shared = noteFromShare(getSharedPayloads());
  if (!shared) return null;
  let html = shared.html;
  let overLimit = false;
  let unreadable = false;
  for (const uri of shared.images) {
    let base64 = "";
    try {
      base64 = await reducePhoto(uri);
    } catch {}
    if (!base64) {
      unreadable = true;
      continue;
    }
    const picture = `<div><img src="data:image/jpeg;base64,${base64}"></div>`;
    if (limit !== null && getTextSize(html + picture) > limit) {
      overLimit = true;
      break;
    }
    html += picture;
  }
  // html can be empty here: pictures alone, none of which could go in
  return { html, title: shared.title, overLimit, unreadable };
}

/** Forgets the share, so that nothing makes a second note of it. */
export function clearShare(): void {
  clearSharedPayloads();
}
