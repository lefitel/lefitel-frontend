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
 * The public page's palette is the application's.
 *
 * Every surface, line and text colour points at the theme tokens in
 * `index.css`, so the page follows the same light/dark choice as the login and
 * the system (one `ThemeProvider`, one stored preference), and a colour change
 * made there reaches the page without anyone remembering it. The page once had
 * its own paper-and-orange palette; with two palettes the site and the product
 * looked like two companies.
 *
 * Orange survives in one job only: the fault. In the application orange means
 * a pole with work pending, and the P472 on the hero plan is exactly that, so
 * the colour says the same thing on the page as on the map. `--pp-fault` marks
 * (dot, ring, leader), `--pp-fault-ink` is the darker value that holds 4.5:1
 * as text.
 *
 * The showcase band is the sidebar's colour: a step off the page in either
 * theme, so the screens on it read as a separate surface.
 */
export const paperVars = {
  "--pp-paper": "var(--background)",
  "--pp-sunk": "var(--sidebar)",
  "--pp-grid": "color-mix(in oklch, var(--border) 50%, transparent)",
  "--pp-rule": "var(--border)",
  "--pp-ink": "var(--foreground)",
  "--pp-dim": "var(--muted-foreground)",
  "--pp-acc": "var(--primary)",
  "--pp-mark": "var(--primary)",
  "--pp-fill": "var(--primary-fill)",
  "--pp-fill-hover": "color-mix(in oklch, var(--primary-fill) 86%, black)",
  "--pp-on-fill": "var(--primary-foreground)",
  "--pp-band": "var(--sidebar)",
  "--pp-band-fg": "var(--foreground)",
  "--pp-band-acc": "var(--primary)",
  "--pp-sans": "'Archivo Variable', system-ui, sans-serif",
  "--pp-mono": "'IBM Plex Mono', ui-monospace, monospace",
} as CSSProperties;

/**
 * The few page colours with no theme token to point at, each in both themes.
 * A class rather than more `paperVars`: an inline style cannot see `.dark`.
 */
export const paperClass =
  "[--pp-fault:oklch(0.68_0.2_42)] [--pp-fault-ink:oklch(0.56_0.17_45)] " +
  "dark:[--pp-fault:oklch(0.72_0.18_48)] dark:[--pp-fault-ink:oklch(0.78_0.14_55)]";

/**
 * The product's palette for the showcase pieces: the application's own tokens.
 *
 * The pieces are screens of the system, and the system has a light and a dark
 * theme, so they follow the same switch as the page around them. Before, they
 * were fixed dark, and flipping the page to light left a band of night in the
 * middle of it.
 */
export const screenVars = {
  "--scr-bg": "var(--background)",
  "--scr-panel": "var(--card)",
  "--scr-raise": "var(--secondary)",
  "--scr-line": "var(--border)",
  "--scr-hair": "color-mix(in oklch, var(--border) 65%, var(--card))",
  "--scr-text": "var(--foreground)",
  "--scr-dim": "var(--muted-foreground)",
  "--scr-faint": "color-mix(in oklch, var(--muted-foreground) 78%, var(--card))",
  "--scr-primary": "var(--primary-fill)",
  "--scr-bar": "var(--chart-1)",
} as CSSProperties;

/**
 * The showcase colours with no theme token, each in both themes: the states
 * (the red-to-green the technicians read), the highlighted chart bar, the text
 * on a solved tick, and the street plan, which copies the application's two
 * map styles (`public/map-styles/basic.json` and `basic-dark.json`).
 */
export const screenClass = [
  "[--scr-warn:oklch(0.62_0.16_55)] [--scr-ok:oklch(0.56_0.13_160)] [--scr-crit:oklch(0.56_0.2_27)]",
  "[--scr-bar-hi:oklch(0.42_0.13_258)] [--scr-on-ok:oklch(0.99_0_0)]",
  "[--map-ground:hsl(47_26%_88%)] [--map-fields:hsl(36_38%_87%)] [--map-green:hsl(82_46%_72%)]",
  "[--map-residential:hsl(47_13%_86%)] [--map-water:hsl(205_56%_73%)] [--map-building:hsl(39_37%_81%)]",
  "[--map-building-line:hsl(29_50%_70%)] [--map-road:hsl(0_0%_100%)] [--map-minor:hsl(0_0%_97%)]",
  "[--map-casing:hsl(40_14%_72%)] [--map-label:hsl(0_0%_10%)] [--map-halo:hsl(0_0%_100%/0.8)]",
  "dark:[--scr-warn:oklch(0.755_0.155_62)] dark:[--scr-ok:oklch(0.745_0.135_162)] dark:[--scr-crit:oklch(0.655_0.205_25)]",
  "dark:[--scr-bar-hi:oklch(0.72_0.115_258)] dark:[--scr-on-ok:oklch(0.16_0.02_162)]",
  "dark:[--map-ground:hsl(220_14%_11%)] dark:[--map-fields:hsl(30_10%_16%)] dark:[--map-green:hsl(126_26%_21%)]",
  "dark:[--map-residential:hsl(220_12%_15%)] dark:[--map-water:hsl(203_48%_21%)] dark:[--map-building:hsl(220_10%_18%)]",
  "dark:[--map-building-line:hsl(220_10%_26%)] dark:[--map-road:hsl(220_9%_36%)] dark:[--map-minor:hsl(220_8%_25%)]",
  "dark:[--map-casing:hsl(220_14%_11%)] dark:[--map-label:hsl(220_16%_92%)] dark:[--map-halo:hsl(220_16%_8%/0.85)]",
].join(" ");

/**
 * A criticality colour made legible as text in either theme. The scale in
 * `parts/fiction.ts` is lifted for a dark surface; mixing it with the text
 * colour darkens it on light ground and keeps it light on dark.
 */
export const asText = (color: string) => `color-mix(in oklch, ${color} 70%, var(--scr-text))`;
