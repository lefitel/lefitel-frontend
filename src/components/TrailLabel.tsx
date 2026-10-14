import { createContext, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * The name of what the open screen is showing, for the trail in the app's header.
 *
 * The trail is built from the address, and an address knows a record by its
 * number: `/app/tramos/52` can only say «Tramo #52». The screen is what has
 * the record in hand, so it says what it is called and the trail's last step
 * reads «Camargo – Sucre» instead.
 *
 * Until the screen has it — its data still loading — the trail shows the
 * number, which is also what it shows for a screen that never says anything.
 */
export interface TrailLabel {
  /** The address the name was given for: a name is never shown on another one. */
  path: string;
  text: string;
}

const TrailLabelContext = createContext<((label: TrailLabel | null) => void) | undefined>(undefined);

export const TrailLabelProvider = TrailLabelContext.Provider;

/**
 * Names the trail's last step while this screen is at this address. Nothing,
 * or an empty name, leaves the trail as the address reads. Outside the shell
 * there is no trail and this does nothing.
 */
export function useTrailLabel(text: string | null | undefined): void {
  const set = useContext(TrailLabelContext);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!set) return;
    set(text ? { path: pathname, text } : null);
    // Taken back on the way out, so the next screen does not open under this one's name.
    return () => set(null);
  }, [set, text, pathname]);
}
