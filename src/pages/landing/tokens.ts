import type { CSSProperties } from "react";
// The brand's typefaces load with its palette: any screen that paints with
// `paperVars` (the public page, the login's brand panel) gets them too.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

/** Exponential deceleration. Things arrive and settle; nothing bounces. */
export const EXPO = [0.16, 1, 0.3, 1] as const;
export const QUART = [0.25, 1, 0.5, 1] as const;

/**
 * The public page's own palette: a survey sheet, paper and graphite.
 *
 * The page is drawn as a line plan of the network (poles, spans, codes), so
 * the ground is drafting paper rather than the dark of the application. The
 * orange is the logo's, and like the application's colours it is split by job:
 * `--pp-or` only marks (dots, cables, rules), `--pp-or-ink` is the darker
 * value that still reads as orange and holds 4.5:1 as text on paper or as a
 * fill under paper-coloured text. One value cannot do both.
 */
export const paperVars = {
  "--pp-paper": "oklch(0.972 0.009 75)",
  "--pp-sunk": "oklch(0.948 0.011 75)",
  "--pp-grid": "oklch(0.915 0.011 75)",
  "--pp-rule": "oklch(0.84 0.012 70)",
  "--pp-ink": "oklch(0.23 0.012 55)",
  "--pp-dim": "oklch(0.46 0.012 55)",
  "--pp-or": "oklch(0.66 0.19 42)",
  "--pp-or-ink": "oklch(0.54 0.17 40)",
  "--pp-or-ink-hover": "oklch(0.48 0.16 40)",
  "--pp-band": "oklch(0.205 0.01 55)",
  "--pp-sans": "'Archivo Variable', system-ui, sans-serif",
  "--pp-mono": "'IBM Plex Mono', ui-monospace, monospace",
} as CSSProperties;

/**
 * The application palette, dark, with every neutral tinted toward its blue.
 *
 * Deliberately not the landing page orange. The page around the pieces is the
 * brand; the pieces themselves are the product, and the product is slate with a
 * red-to-blue criticality scale, the same one the technicians read in the
 * field. Repainting it to match the poster would misrepresent what a client is
 * being shown.
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
