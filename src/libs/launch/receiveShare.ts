import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";

import { fitShare, noteFromShare } from "@/libs/launch/share";
import { reducePhoto } from "@/libs/reducePhoto";
import { getTextSize } from "@/utils/string";

/** A share read and its pictures reduced, ready to be a text note. */
export interface ReceivedShare {
  html: string;
  title: string;
  /** Something left out: the text past the note's limit, or a picture that didn't fit (it and the ones after it). */
  overLimit: boolean;
  /** A picture that couldn't be read. */
  unreadable: boolean;
}

/**
 * What was shared to the app, as a note's HTML (spec D.3), or null when it holds nothing the app keeps. Only the raw
 * payloads: never the resolving call, which would fetch a shared address. The text is cut at a line's end to `limit`
 * (null: no limit); each picture is reduced as the editor's (`reducePhoto`) and appended while the note stays within it. The payloads stay until
 * `clearShare`: the pictures' addresses can be read only until then.
 */
export async function receiveShare(limit: number | null): Promise<ReceivedShare | null> {
  const shared = noteFromShare(getSharedPayloads());
  if (!shared) return null;
  // The text first, held to the limit like the editor's own paths; the pictures then while room is left.
  const text = fitShare(shared.html, limit);
  let html = text.html;
  let overLimit = text.cut;
  let unreadable = false;
  for (const uri of overLimit ? [] : shared.images) {
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
