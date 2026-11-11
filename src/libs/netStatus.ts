/*
 * The connection status on the web and the desktop (LL-082, ADR-029). The browser's `offline` event is told at once.
 * `online` only says a network is there, not that it reaches anything: while something needs to tell "offline" from "the
 * cloud doesn't answer" (a cloud is connected), a small request answers that. It runs only while retained and while the
 * page is visible: once at the first retain, once when the page shows again, and every PROBE_INTERVAL_MS in between,
 * with one timer for the whole app however many screens read the status.
 */

export interface NetStatus {
  isConnected: boolean;
  type: string;
}

/** What the status reads from the browser; a fake one in `scripts/net-status.test.mjs`. */
export interface NetStatusEnv {
  /** `navigator.onLine` */
  isOnline(): boolean;
  /** `document.visibilityState === "visible"` */
  isVisible(): boolean;
  /** The request that tells whether the internet answers: true if it does. */
  probe(): Promise<boolean>;
  onOnline(listener: () => void): () => void;
  onOffline(listener: () => void): () => void;
  onVisibility(listener: () => void): () => void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const PROBE_INTERVAL_MS = 30_000;

export function createNetStatus(env: NetStatusEnv): {
  subscribe(listener: () => void): () => void;
  getSnapshot(): NetStatus;
  /** Asks for the probe while something needs to tell "offline" from "the cloud doesn't answer". Returns the release. */
  retainProbe(): () => void;
} {
  let snapshot: NetStatus = { isConnected: env.isOnline(), type: "unknown" };
  const listeners = new Set<() => void>();
  let retainers = 0;
  let timer: unknown = null;
  /** Bumped when the last retainer leaves: an answer to a probe asked before then is not used. */
  let generation = 0;
  /** The generation of the probe waiting for its answer, if any: never two at once. */
  let inFlight: number | null = null;

  const set = (isConnected: boolean, type: string) => {
    if (snapshot.isConnected === isConnected && snapshot.type === type) return;
    snapshot = { isConnected, type };
    listeners.forEach((listener) => listener());
  };

  const probeNow = () => {
    if (!retainers || !env.isVisible() || inFlight === generation) return;
    const asked = generation;
    inFlight = asked;
    env
      .probe()
      .catch(() => false)
      .then((answered) => {
        if (inFlight === asked) inFlight = null;
        if (asked !== generation || !retainers) return;
        set(answered, answered ? "wifi" : "none");
      });
  };

  const startTimer = () => {
    if (timer === null) timer = env.setInterval(probeNow, PROBE_INTERVAL_MS);
  };
  const stopTimer = () => {
    if (timer === null) return;
    env.clearInterval(timer);
    timer = null;
  };

  env.onOffline(() => set(false, "none"));
  // With a cloud, the state stays as it is until the probe answers; without one, the browser is trusted.
  env.onOnline(() => (retainers ? probeNow() : set(true, "unknown")));
  env.onVisibility(() => {
    if (!retainers) return;
    if (env.isVisible()) {
      probeNow();
      startTimer();
    } else {
      stopTimer();
    }
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: () => snapshot,

    retainProbe() {
      retainers++;
      if (retainers === 1 && env.isVisible()) {
        probeNow();
        startTimer();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        retainers--;
        if (retainers > 0) return;
        stopTimer();
        generation++;
        set(env.isOnline(), "unknown");
      };
    },
  };
}
