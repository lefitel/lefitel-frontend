import { createContext } from "react";

/**
 * Where the app's header offers room to the open screen: one element on each
 * side of the trail. See `HeaderSlot`, which draws into them.
 *
 * Kept apart from that component because a module that exports a component
 * and also a context or a function cannot be hot-reloaded in place.
 */
export interface HeaderSlots {
  start: HTMLElement | null;
  end: HTMLElement | null;
}

export const HeaderSlotContext = createContext<HeaderSlots | undefined>(undefined);

/** Each side is `null` while the header has not mounted yet; the element once it has. */
export const HeaderSlotProvider = HeaderSlotContext.Provider;
