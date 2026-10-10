import { useEffect, useRef } from "react";

/**
 * What the profile hands a section so it can live as one row of "Acceso y
 * seguridad" instead of as a card of its own.
 *
 * `onCambios` is how the section answers the one question `PerfilPage` cannot
 * ask it directly: that page allows one open editor at a time and asks before
 * discarding a dirty one, and these sections own their drafts.
 */
export interface FilaDePerfil {
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onCambios: (hay: boolean) => void;
}

/**
 * The two duties a section has towards the profile while it is a row: say
 * whether it holds something that would be lost, and drop it when it is
 * closed from outside.
 *
 * The second one matters because the section stays mounted while collapsed —
 * its row shows a status it has to load — so without it a typed password
 * would sit in the state of a form nobody can see.
 */
export function useFilaDePerfil(fila: FilaDePerfil | undefined, sucio: boolean, alCerrar: () => void) {
  const abierto = fila?.abierto;

  // Both callbacks are rebuilt on every render of whoever passes them; the
  // effects below must fire on what changed, not on that.
  const alCerrarRef = useRef(alCerrar);
  const onCambiosRef = useRef(fila?.onCambios);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
    onCambiosRef.current = fila?.onCambios;
  });

  const estabaAbierto = useRef(abierto);
  useEffect(() => {
    if (estabaAbierto.current && !abierto) alCerrarRef.current();
    estabaAbierto.current = abierto;
  }, [abierto]);

  useEffect(() => {
    onCambiosRef.current?.(sucio);
  }, [sucio]);
}
