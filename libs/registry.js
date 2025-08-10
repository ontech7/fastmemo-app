/*
 * Workaround for heavy params or non-serializable params
 */

const registry = new Map();

/* NOTE */

export function storeNote(data) {
  registry.set("note", data);
}

export function retrieveNote() {
  return registry.get("note") || {};
}

/* SECRET CODE */

export function storeSecretCodeCallback(callback) {
  registry.set("secretCodeCallback", callback);
}

export function retrieveSecretCodeCallback() {
  return registry.get("secretCodeCallback");
}
