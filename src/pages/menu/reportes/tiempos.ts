// What the tiempos report says about its numbers, apart from the screen that
// draws it: a component file cannot also export functions and stay hot-reloadable.

// Bandas fijadas por Isaias sobre la cifra real: la mediana de la red es de 31
// días. Con las viejas (1 y 7) todo salía rojo y el color dejaba de informar.
export const diasColor = (d: number) =>
  d <= 15 ? "text-green-600" : d <= 45 ? "text-amber-600" : "text-red-600";

/**
 * Aviso de los eventos que quedaron fuera del promedio. Un panel que descarta
 * filas en silencio miente por omisión, así que dice cuántas y por qué.
 */
export const textoDescartados = (n: number): string | null => {
  if (n <= 0) return null;
  const plural = n === 1 ? "evento quedó" : "eventos quedaron";
  return `${n} ${plural} fuera del promedio: su reparación está fechada antes que la avería, así que no se puede saber cuánto tardó.`;
};
