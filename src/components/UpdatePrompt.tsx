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
 * ever interrupting them mid-sentence. `vite.config.ts` keeps `registerType:
 * "prompt"` for exactly this reason — it is the only setting that leaves the
 * timing to the application — and says so beside the setting.
 *
 * The toast stays as an immediate way out for somebody who would rather take it
 * now, and it is the one path that can lose work, so it still says so.
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
      // `true` reloads once the waiting worker has taken over.
      void updateServiceWorker(true);
    }
  }, [needRefresh, pathname, updateServiceWorker]);

  useEffect(() => {
    if (!needRefresh) return;

    const id = toast("Hay una versión nueva", {
      description: "Se aplicará sola al cambiar de pantalla. Puedes aplicarla ahora, pero se perderá lo que tengas a medio escribir.",
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
