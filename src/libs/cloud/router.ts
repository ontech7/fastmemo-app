import type { CloudSettings } from "@/types";

import { providerOf } from "./scope";
import type { CloudBackend } from "./types";

/**
 * The cloud the app talks to: the backend the settings point to (Firebase or a FastMemo server, ADR-017), chosen on
 * `init`. Everything else goes to it unchanged, so callers keep one `cloud`.
 */
export class CloudRouter implements CloudBackend {
  private readonly backends: Record<"firebase" | "server", CloudBackend>;
  private current: CloudBackend;

  constructor(backends: Record<"firebase" | "server", CloudBackend>) {
    this.backends = backends;
    this.current = backends.firebase;
  }

  get deviceLimit() {
    return this.current.deviceLimit;
  }

  get maxNoteBytes() {
    return this.current.maxNoteBytes;
  }

  get pacing() {
    return this.current.pacing;
  }

  init(settings: CloudSettings): void {
    const next = this.backends[providerOf(settings)];
    // Switching clouds: the other one stops (its listeners are told, and the engine subscribes again on this one).
    if (next !== this.current && this.current.isActive()) void this.current.dispose();
    this.current = next;
    next.init(settings);
  }

  isActive: CloudBackend["isActive"] = () => this.current.isActive();
  verify: CloudBackend["verify"] = () => this.current.verify();
  /** By the settings' own cloud, not the current one. */
  check: CloudBackend["check"] = (settings) => this.backends[providerOf(settings)].check(settings);
  dispose: CloudBackend["dispose"] = () => this.current.dispose();
  reconnect: CloudBackend["reconnect"] = () => this.current.reconnect();

  listDevices: CloudBackend["listDevices"] = () => this.current.listDevices();
  registerDevice: CloudBackend["registerDevice"] = (device) => this.current.registerDevice(device);
  unregisterDevice: CloudBackend["unregisterDevice"] = (uuid) => this.current.unregisterDevice(uuid);
  dropRecipient: CloudBackend["dropRecipient"] = (uuid) => this.current.dropRecipient(uuid);
  touchLastSync: CloudBackend["touchLastSync"] = (uuid) => this.current.touchLastSync(uuid);
  setPresence: CloudBackend["setPresence"] = (uuid, presence) => this.current.setPresence(uuid, presence);
  clearFullSyncDue: CloudBackend["clearFullSyncDue"] = (me, due) => this.current.clearFullSyncDue(me, due);
  subscribeDevices: CloudBackend["subscribeDevices"] = (me, onSnapshot, onError, onLost) =>
    this.current.subscribeDevices(me, onSnapshot, onError, onLost);
  pullDevices: CloudBackend["pullDevices"] = (me) => this.current.pullDevices(me);
  ackChanges: CloudBackend["ackChanges"] = (me, change) => this.current.ackChanges(me, change);

  readVault: CloudBackend["readVault"] = () => this.current.readVault();
  createVaultExclusive: CloudBackend["createVaultExclusive"] = (vault) => this.current.createVaultExclusive(vault);
  writeVault: CloudBackend["writeVault"] = (vault) => this.current.writeVault(vault);
  subscribeVault: CloudBackend["subscribeVault"] = (onRead) => this.current.subscribeVault(onRead);

  fetchNotes: CloudBackend["fetchNotes"] = () => this.current.fetchNotes();
  fetchTombstones: CloudBackend["fetchTombstones"] = () => this.current.fetchTombstones();
  pruneTombstones: CloudBackend["pruneTombstones"] = (ids) => this.current.pruneTombstones(ids);
  fetchNote: CloudBackend["fetchNote"] = (id) => this.current.fetchNote(id);
  fetchCategories: CloudBackend["fetchCategories"] = () => this.current.fetchCategories();
  writeNotes: CloudBackend["writeNotes"] = (notes) => this.current.writeNotes(notes);
  wipeNotes: CloudBackend["wipeNotes"] = () => this.current.wipeNotes();
  wipeCategories: CloudBackend["wipeCategories"] = () => this.current.wipeCategories();
  push: CloudBackend["push"] = (me, ops, recipients, onProgress) => this.current.push(me, ops, recipients, onProgress);
}
