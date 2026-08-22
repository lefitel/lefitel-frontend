import type { CSSProperties } from "react";

/** Size every scene is composed at, before the stage scales it to fit. */
export const STAGE_W = 940;
export const STAGE_H = 580;

/** Exponential deceleration. Things arrive and settle; nothing bounces. */
export const EXPO = [0.16, 1, 0.3, 1] as const;
export const QUART = [0.25, 1, 0.5, 1] as const;

/**
 * The application palette, dark, with every neutral tinted toward its blue.
 *
 * Deliberately not the landing page orange. The window frame is the brand; the
 * screen inside it is the product, and the product is slate with a red-to-blue
 * criticality scale. Repainting it to match the poster would misrepresent what
 * a client is being shown.
 */
export const screenVars = {
  "--scr-bg": "oklch(0.168 0.012 258)",
  "--scr-panel": "oklch(0.212 0.013 258)",
  "--scr-raise": "oklch(0.252 0.014 258)",
  "--scr-line": "oklch(0.305 0.014 258)",
  "--scr-hair": "oklch(0.262 0.013 258)",
  "--scr-text": "oklch(0.955 0.004 258)",
  "--scr-dim": "oklch(0.735 0.011 258)",
  "--scr-faint": "oklch(0.565 0.012 258)",
  "--scr-primary": "oklch(0.635 0.105 258)",
  "--scr-warn": "oklch(0.755 0.155 62)",
  "--scr-ok": "oklch(0.745 0.135 162)",
  "--scr-crit": "oklch(0.655 0.205 25)",
} as CSSProperties;
