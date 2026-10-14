import { useEffect, useRef } from "react";

/**
 * Whether the component is still on screen. A save that outlives its view (the
 * map was pressed, the selection moved on) must not write state into it afterwards.
 */
export function useVivo() {
  const vivo = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);
  return vivo;
}
