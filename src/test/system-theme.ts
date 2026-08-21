import { act } from "@testing-library/react";

type Listener = (event: MediaQueryListEvent) => void;

/**
 * jsdom's matchMedia always reports `matches: false` and never emits changes,
 * so the OS-level colour preference has to be faked by hand.
 */
export function mockSystemTheme(prefersDark: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => true,
  };

  window.matchMedia = ((query: string) =>
    query === "(prefers-color-scheme: dark)"
      ? mql
      : { ...mql, matches: false, media: query }) as typeof window.matchMedia;

  return {
    /** Simulates the user flipping their OS between light and dark. */
    set(nextPrefersDark: boolean) {
      mql.matches = nextPrefersDark;
      act(() => {
        listeners.forEach((cb) =>
          cb({ matches: nextPrefersDark } as MediaQueryListEvent),
        );
      });
    },
  };
}
