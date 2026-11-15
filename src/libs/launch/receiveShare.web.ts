import type { ReceivedShare } from "@/libs/launch/receiveShare";

/** Nothing is shared to the web app or the desktop. */
export async function receiveShare(_limit: number | null): Promise<ReceivedShare | null> {
  return null;
}

export function clearShare(): void {}
