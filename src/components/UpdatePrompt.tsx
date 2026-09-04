import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Applies a new build on its own, at a moment that costs nothing.
 *
 * A service worker keeps the app on the device, which is the point — and also
 * the trap: without something like this, somebody can hold a version from last
 * week and report bugs that were fixed on Tuesday, and nobody can tell from the
 * outside. After the deployment cut it stops being a nuisance and becomes a
 * fault: server and client change contract together, so an old build is not
 * slow, it is broken.
 *
 * **So the update is no longer optional, and it is still not abrupt.** Task E4
 * of the API standard decided the plugin should apply updates by itself
 * (`registerType: "autoUpdate"`). Taken literally that reloads the page the
 * instant a deploy lands, which is the half-filled pole form thrown away that
 * the previous version of this file existed to prevent. The two are reconciled
 * by choosing the *moment* instead of the *policy*: the build downloads and
 * waits, and it is applied at the **first screen change**, where a reload
 * destroys nothing because the screen was being left anyway.
 *
 * That bounds the old-build window to "until the person taps anything", without
 * interrupting the tab they are typing in. `vite.config.ts` keeps `registerType:
 * "prompt"` for exactly this reason — it is the only setting that leaves the
 * timing to the application — and says so beside the setting.
 *
 * **What it does not promise, because it cannot.** Applying an update is a
 * property of the service worker, not of a tab: `skipWaiting` makes the new
 * worker claim every client at once, and every open tab reloads. So a second tab
 * left on a half-filled form loses it when *this* one changes screen. That is
 * true of any automatic update — it is true of `autoUpdate` too, immediately and
 * without a screen change — and an earlier version of this comment claimed the
 * opposite. Choosing the moment shrinks the exposure to "somebody was navigating
 * elsewhere"; it does not remove it.
 *
 * The toast stays as an immediate way out for somebody who would rather take it
 * now, and it says what it costs.
 *
 * One case it deliberately does not cover: a person who spends the morning on
 * one screen changing filters never changes `pathname`, so the update waits for
 * them. Anchoring on the query string as well would treat setting a filter as a
 * safe moment to reload, and it is not — that is the state they just built.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const { pathname } = useLocation();
  /**
   * The screen the person was on when the new build became available.
   *
   * Anchored when `needRefresh` turns true rather than read at mount: the update
   * usually arrives long after this component first rendered, and comparing
   * against the mount path would apply it on a navigation that happened before
   * there was anything to apply — or, worse, never, if they had already moved.
   */
  const anclaje = useRef<string | null>(null);

  useEffect(() => {
    if (!needRefresh) {
      anclaje.current = null;
      return;
    }
    if (anclaje.current === null) {
      anclaje.current = pathname;
      return;
    }
    if (pathname !== anclaje.current) {
      // The argument is passed for intent and vite-plugin-pwa 1.3 ignores it:
      // its `updateServiceWorker` only forwards `skipWaiting` to the waiting
      // worker, and the reload comes from the `controlling` listener the plugin
      // registers, in every tab. Written out because the comment here used to
      // say `true` was what reloaded, and somebody removing it would change
      // nothing while believing they had.
      void updateServiceWorker(true);
    }
  }, [needRefresh, pathname, updateServiceWorker]);

  useEffect(() => {
    if (!needRefresh) return;

    const id = toast("Hay una versión nueva", {
      description: "Se aplicará sola al cambiar de pantalla. Si la aplicas ahora, se perderá lo que tengas a medio escribir.",
      // No timeout: a standing offer, not a notification that scrolls past
      // while the phone is in a pocket.
      duration: Infinity,
      action: {
        label: "Actualizar ahora",
        onClick: () => void updateServiceWorker(true),
      },
    });

    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, updateServiceWorker]);

  return null;
}
