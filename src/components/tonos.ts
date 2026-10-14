import type { Tono } from "../lib/envios";

// The theme has no token for "went well" or "look at this": every screen
// writes these two by hand, and these are the pair most of them use.
/** The amber of "look at this", for the text beside a result as well as the result. */
export const AVISO = "text-amber-600 dark:text-amber-500";

/** The text colour of each tone of a result: a run, or a recipient of one. */
export const TONO: Record<Tono, string> = {
  bien: "text-emerald-600 dark:text-emerald-400",
  aviso: AVISO,
  mal: "text-destructive",
  neutro: "text-muted-foreground",
};
