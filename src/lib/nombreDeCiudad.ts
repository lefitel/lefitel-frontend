/**
 * What to call a city on screen. The name column is nullable, so a city can come
 * without one; `#<id>` is how the server already writes it inside a tramo's name.
 */
export const nombreDeCiudad = (c: { id: number; name?: string | null }): string =>
  c.name != null && c.name.trim() !== "" ? c.name : `#${c.id}`;
