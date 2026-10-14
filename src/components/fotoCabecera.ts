/**
 * How tall the photo at the head of a detail panel is — a city's, a pole's, an
 * incident's, the two of a tramo. One value for the four, so they cannot drift
 * apart again: it was `h-30` written out in each of them.
 *
 * 176px. Taller than the 120px strip it was, which was too low to recognise
 * the place by; short of 16:9 (216px in this panel), which on a laptop took
 * more than a quarter of the panel before its first line of data.
 *
 * A whole class name, so Tailwind finds it when it scans the sources.
 */
export const FOTO_CABECERA_ALTO = "h-44";
