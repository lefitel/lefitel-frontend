import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * A record this screen was asked to open by its address — `?tab=material&id=5`,
 * which is how the Bitácora links to a catalogue entry.
 *
 * The page owns the address and the Activos/Archivados switch; the section owns
 * the two lists. This is what travels between them.
 */
export interface RegistroEnlazado {
  id: number;
  /** The record is not among the active ones: show the archived list. */
  verArchivados: () => void;
  /** It is in neither list: back to the active ones. */
  verActivos: () => void;
  /** Answered, one way or another. The page takes it out of the address. */
  atendido: () => void;
}

interface Fila {
  id?: number | null;
  name: string;
}

/**
 * Finds the linked record in the section's lists and opens it.
 *
 * Among the active ones first, where finding it opens its form. Only when it
 * is not there are the archived ones asked for, and only when it is in neither
 * is it said to be gone — "ya no existe" about a record that is one tab away
 * would be a wrong answer about the very thing the log points at.
 *
 * A list that failed to load stays `null`, and so this stays silent: the
 * section has already said the list could not be read, and "no existe" on top
 * of that would be a claim made out of a failed request.
 *
 * `abrir` is absent for a role that may see the catalogue and not edit it: the
 * form is not even mounted for them. Calling the section's `openEdit` anyway
 * left "form open" set with nothing on screen — invisible until the day their
 * role changed mid-session and a dialog nobody asked for appeared. They are
 * told the record is here instead.
 */
export function useRegistroEnlazado<T extends Fila>({ enlace, activos, archivados, abrir }: {
  enlace: RegistroEnlazado | undefined;
  activos: T[] | null;
  archivados: T[] | null;
  abrir: ((fila: T) => void) | undefined;
}): void {
  const fase = useRef<"activos" | "archivados" | "hecho">("activos");

  useEffect(() => {
    if (!enlace || fase.current === "hecho") return;

    if (fase.current === "activos") {
      if (activos === null) return;
      const fila = activos.find((f) => f.id === enlace.id);
      if (fila) {
        fase.current = "hecho";
        if (abrir) abrir(fila);
        else toast.info(`«${fila.name}» está en esta lista; su perfil no permite abrirlo para editarlo`);
        enlace.atendido();
        return;
      }
      fase.current = "archivados";
      enlace.verArchivados();
      // And on, without returning. The archived list may be here already — the
      // person looked at that tab while the active one was failing or slow —
      // and then nothing this effect depends on will change again: it would
      // sit in this phase, the screen switched to Archivados without a word,
      // until some unrelated refresh delivered the answer minutes later.
    }

    if (archivados === null) return;
    fase.current = "hecho";
    const fila = archivados.find((f) => f.id === enlace.id);
    if (fila) {
      toast.info(`«${fila.name}» está archivado`);
    } else {
      toast.error(`El registro #${enlace.id} ya no existe`);
      enlace.verActivos();
    }
    enlace.atendido();
  }, [enlace, activos, archivados, abrir]);
}
