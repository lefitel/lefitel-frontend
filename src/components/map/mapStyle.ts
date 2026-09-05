/**
 * OpenFreeMap serves OpenStreetMap data with no API key and no registration.
 * "positron" and "dark" are the same two looks the CARTO basemaps gave us
 * before CARTO started stamping "API KEY REQUIRED" on unkeyed tiles.
 */
export const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
export const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export function styleForTheme(resolvedTheme: string): string {
  return resolvedTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
