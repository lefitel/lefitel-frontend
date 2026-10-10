/**
 * How big each kind of dot is, in pixels of fill radius.
 *
 * Three ranks, and the order is the point: the thing the screen is about is the
 * largest dot on its map, the two cities a stretch runs between come next, and
 * the other poles of the stretch are the smallest.
 *
 * It was `main: 7, secondary: 6.5`, with the cities written as a literal 7 in
 * each screen — and the subject came out the *smallest* dot of the three. Half
 * a pixel is no rank at all, and the two components that draw a dot disagreed
 * about what a radius is: `MapPoint` put the border outside it and
 * `SonarMarker` inside, so the pole a screen was about measured 14 px across
 * beside neighbours of 15 and cities of 16. Both count the border outside now
 * (`dotDiameter`), so one number means one size wherever it is used.
 */
export const MAP_RADIUS = {
  main: 8,
  endpoint: 6.5,
  secondary: 5,
} as const;

export const MAP_WEIGHT = {
  main: 1.5,
  secondary: 1,
} as const;

/** What a dot measures across on screen: its fill, plus its border on both sides. */
export const dotDiameter = (radius: number, strokeWidth: number): number =>
  2 * (radius + strokeWidth);

/**
 * How the route is drawn on each of the two base maps.
 *
 * It was one blue for both — `#596BAB` at 70% — and it was written out again by
 * hand in three of the four screens that draw a route. On the dark map that
 * blue sits a few steps above the background and the line was hard to find; on
 * the light one, at 70%, it read as a faded road rather than as the stretch.
 *
 * So it follows the theme, the way the base map under it already does: paler,
 * towards white, on the dark map; the same hue a little deeper and more solid
 * on the light one. Literal colours and not the theme's CSS tokens because
 * MapLibre paints on a canvas and cannot read a custom property.
 */
export const ROUTE_PAINT = {
  light: { color: "#3F54A6", opacity: 0.9 },
  dark: { color: "#C9D4FA", opacity: 0.9 },
} as const;

/**
 * The colours of the quiet dots, by role. Theme tokens (`index.css`), so a dot
 * is right on both base maps without its screen knowing which one is showing.
 *
 * They were literals in five screens: `#374151` for a city and `#9ca3af` for a
 * pole, both picked against the light map. `MapPoint` and `SonarMarker` are DOM
 * markers, so a custom property reaches them — unlike the route line, which
 * MapLibre paints on its canvas and which needs `ROUTE_PAINT` for that reason.
 */
export const MAP_DOT = {
  endpoint: "var(--map-endpoint)",
  pole: "var(--map-pole)",
  poleFill: "var(--map-pole-fill)",
  /** The dot a form is placing, and the three channels its ripple is drawn from. */
  subject: "var(--map-subject)",
  subjectRgb: "var(--map-subject-rgb)",
} as const;

/**
 * `--map-subject` again, for the one map that cannot read it: the home screen
 * paints its poles on the canvas, where a custom property does not reach. The
 * same split as `ROUTE_PAINT`, and `mapConstants.test.tsx` holds the two in
 * step with the stylesheet.
 */
export const SUBJECT_PAINT = {
  light: "#38669f",
  dark: "#6ca1e5",
} as const;
