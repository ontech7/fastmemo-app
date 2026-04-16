/*
 * Workaround for heavy params or non-serializable params
 */

const registry = new Map<string, unknown>();

/* NOTE - Dirty tracking */

export function storeDirtyNoteId(uuid: string): void {
  registry.set("dirtyNote", uuid);
}

export function retrieveDirtyNoteId(): string | null {
  const uuid = (registry.get("dirtyNote") as string) ?? null;

  if (uuid) {
    registry.delete("dirtyNote");
  }

  return uuid;
}

/* SECRET CODE */

export function storeSecretCodeCallback(callback: () => void): void {
  registry.set("secretCodeCallback", callback);
}

export function retrieveSecretCodeCallback(): (() => void) | undefined {
  return registry.get("secretCodeCallback") as (() => void) | undefined;
}
