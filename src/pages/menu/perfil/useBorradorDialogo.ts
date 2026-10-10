import { useState } from "react";

/**
 * The draft of one profile dialog: what is being typed, whether the person has
 * already pressed save once, and whether a save is in flight.
 *
 * **Seeded every time the dialog opens, from what the page holds at that
 * moment** — the same "adjust state while rendering" step `FormDialog` uses for
 * its own reset. That is the whole reason there is no stale draft to guard
 * against: nothing outlives a close, and nothing that happens while the dialog
 * is open (a photo saved from the header folds a new record into the page) can
 * reach into what is being typed, because the seed is only read on the
 * closed-to-open edge.
 *
 * `soltarAlCerrar` empties the draft the moment the dialog closes instead of
 * waiting for the next opening. For the one that holds a password: a closed
 * dialog should not keep what was typed in it in memory for the rest of the
 * session.
 *
 * **Errors are not state.** Each dialog computes them from the draft on every
 * render and shows them once `intentado` is true, so a message disappears by
 * itself the moment the field is corrected and there is no list of messages to
 * keep in step with the fields.
 */
export function useBorradorDialogo<T extends object>(
  open: boolean,
  semilla: T,
  { soltarAlCerrar = false }: { soltarAlCerrar?: boolean } = {},
) {
  const [borrador, setBorrador] = useState<T>(semilla);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [abierto, setAbierto] = useState(open);
  if (open !== abierto) {
    setAbierto(open);
    if (open) {
      setBorrador(semilla);
      setIntentado(false);
    } else if (soltarAlCerrar) {
      setBorrador(semilla);
    }
  }

  const poner = <K extends keyof T>(campo: K, valor: T[K]) =>
    setBorrador((prev) => ({ ...prev, [campo]: valor }));

  /**
   * Press save. With any error pending nothing leaves the dialog; otherwise
   * `guardar` runs and, when it answers `true`, the dialog closes itself. A
   * `false` keeps it open with the draft intact, so a refusal from the server
   * can be corrected without retyping.
   */
  const enviar = async (hayErrores: boolean, guardar: () => Promise<boolean>, cerrar: () => void) => {
    setIntentado(true);
    if (hayErrores) return;
    setGuardando(true);
    try {
      if (await guardar()) cerrar();
    } finally {
      setGuardando(false);
    }
  };

  return { borrador, poner, intentado, guardando, enviar };
}
