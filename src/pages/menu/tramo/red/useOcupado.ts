import { useEffect } from "react";

/**
 * Tells the page whether this view has a save in flight, and that it has none
 * once the view is gone: the page ignores Esc, the tools and the map's clicks
 * while a save is out, and must not stay deaf because the view that raised the
 * flag was unmounted.
 */
export function useOcupado(ocupado: boolean, alCambiar: (ocupado: boolean) => void) {
  useEffect(() => { alCambiar(ocupado); }, [ocupado, alCambiar]);
  useEffect(() => () => alCambiar(false), [alCambiar]);
}
