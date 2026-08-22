import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Tell people when they are running yesterday's build.
 *
 * A service worker keeps the app on the device, which is the point — and also
 * the trap: without this, someone can hold a version from last week and report
 * bugs that were fixed on Tuesday, and nobody can tell from the outside.
 *
 * The new build is downloaded and then waits. It is not applied on its own:
 * swapping the page out from under a half-filled pole form would be a worse
 * bug than the one being shipped. The toast has no timeout for the same
 * reason — it is a standing offer, not a notification that scrolls past while
 * the phone is in a pocket.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;

    const id = toast("Hay una versión nueva", {
      description: "Se aplica al recargar. Lo que tengas a medio escribir se perderá.",
      duration: Infinity,
      action: {
        label: "Actualizar",
        // `true` reloads once the waiting worker has taken over.
        onClick: () => void updateServiceWorker(true),
      },
    });

    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, updateServiceWorker]);

  return null;
}
