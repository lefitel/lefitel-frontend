import { useSyncExternalStore } from "react";
import { APP_VERSION } from "../data/changelog";

const KEY = "osefi-seen-release";

/**
 * Whether this browser has read the notes for the version it is running.
 *
 * A changelog nobody opens is a changelog nobody has. The version number alone
 * sits in the menu looking like metadata, so the only people who ever find out
 * something changed are the ones who happened to go looking — which is nobody.
 * A dot next to the entry is the whole difference between the feature working
 * and the feature merely existing.
 *
 * Kept per browser rather than per account: it is about what this person has
 * read on this screen, and it is not worth a column in the database.
 *
 * Storage can refuse outright — a locked-down browser, a private window — so
 * the value is held in memory as well. Failing to write means the dot comes
 * back on the next reload, which is a nuisance; failing to read must not mean
 * a dot that never clears, which is worse.
 */

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let seen: string | null = read();
const listeners = new Set<() => void>();

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** Called by the notes themselves, on arrival. */
export function markReleaseSeen(): void {
  if (seen === APP_VERSION) return;
  seen = APP_VERSION;
  try {
    localStorage.setItem(KEY, APP_VERSION);
  } catch {
    // In memory only: the dot clears for this session and returns on reload.
  }
  listeners.forEach((notify) => notify());
}

export function useUnseenRelease(): boolean {
  const snapshot = () => seen;
  return useSyncExternalStore(subscribe, snapshot, snapshot) !== APP_VERSION;
}

/** For tests, which need each case to start from nothing. */
export function resetSeenRelease(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  seen = null;
  listeners.forEach((notify) => notify());
}
