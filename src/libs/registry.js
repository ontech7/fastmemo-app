/*
 * Workaround for heavy params or non-serializable params
 */

const registry = new Map();

/* NOTE - Dirty tracking */

export function storeDirtyNoteId(uuid) {
  registry.set("dirtyNote", uuid);
}

export function retrieveDirtyNoteId() {
  const uuid = registry.get("dirtyNote") ?? null;

  if (uuid) {
    registry.delete("dirtyNote");
  }

  return uuid;
}

/* SECRET CODE */

export function storeSecretCodeCallback(callback) {
  registry.set("secretCodeCallback", callback);
}

export function retrieveSecretCodeCallback() {
  return registry.get("secretCodeCallback");
}
