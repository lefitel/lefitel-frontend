import { useCallback, useEffect, useState } from "react";

/**
 * Chrome's install event, which TypeScript's DOM library does not describe
 * because it is not in any standard.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already opened from a home screen icon rather than in a browser tab. */
function alreadyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // The iOS flag is Safari's own, and predates the standard media query.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * Which set of instructions to show when there is no prompt to fire.
 *
 * iPadOS reports itself as a Mac, so the user agent alone says desktop; a Mac
 * with a touch screen is the tell.
 */
function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Whether this browser will install the app, and how to ask it to.
 *
 * Chrome and Edge fire `beforeinstallprompt` once they judge the app
 * installable; it has to be caught and kept, because it can only be answered
 * later, from a real click. Safari fires nothing at all and has no
 * programmatic install, and Chrome withholds the event until it has seen some
 * interaction — so most of the time there is no prompt to fire even where
 * installing works perfectly well.
 *
 * Which is why `canInstall` decides *how* the entry behaves, never whether it
 * exists. An entry that appears only when the browser feels like it cannot be
 * found by the person looking for it, and cannot be tested at all: the service
 * worker does not run under `npm run dev`, so the event never fires there. The
 * caller shows the entry always and falls back to instructions, and the only
 * thing that hides it is the app already being installed — at which point
 * there is genuinely nothing left to offer.
 */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(alreadyInstalled);

  useEffect(() => {
    const capture = (e: Event) => {
      // Without this the browser shows its own banner and never hands us the
      // event, so the menu entry could never appear.
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const done = () => {
      setInstalled(true);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    // Single use: the browser will fire a fresh one if it is still installable.
    setEvent(null);
  }, [event]);

  return {
    /** There is a prompt in hand: the click can install it here and now. */
    canInstall: Boolean(event) && !installed,
    /** Nothing left to offer. */
    installed,
    /** Whose instructions to show when there is no prompt to fire. */
    platform: detectPlatform(),
    install,
  };
}
