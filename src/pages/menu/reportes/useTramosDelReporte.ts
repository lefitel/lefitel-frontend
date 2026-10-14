import { useEffect, useState } from "react";
import { toast } from "sonner";
import { estadoTrasFallo, getOpcionesReporte, type EstadoOpciones } from "../../../api/opciones.api";
import type { Tramo } from "../../../interfaces/interfaces";

/**
 * The tramos a report screen offers in its selector, from the same
 * `/api/reporte/options` the other screens of the section read.
 *
 * For the three screens whose only catalogue is this one (Estado de red,
 * Observaciones, Tiempos). The report itself does not depend on the list —
 * the tramo is optional — so a failure here is told on screen, by
 * `avisoDeTramos`, and Generar stays enabled.
 */
export function useTramosDelReporte(): { tramos: Tramo[]; estado: EstadoOpciones } {
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [estado, setEstado] = useState<EstadoOpciones>("cargando");

  useEffect(() => {
    let vigente = true;
    getOpcionesReporte()
      .then((opciones) => {
        if (!vigente) return;
        setTramos(opciones.tramos);
        setEstado("listas");
      })
      .catch((error) => {
        if (!vigente) return;
        const tras = estadoTrasFallo(error);
        setEstado(tras);
        toast.error(tras === "denegado"
          ? "No tiene permiso para consultar los catálogos de informes."
          : "No se pudieron cargar los catálogos del informe.");
      });
    return () => { vigente = false; };
  }, []);

  return { tramos, estado };
}

/**
 * The sentence for a list that did not arrive, on screen and not only in a
 * toast that is gone in four seconds; `null` while it is fine or on its way.
 * The report still works without it, and the sentence says so.
 */
export const avisoDeTramos = (estado: EstadoOpciones): string | null =>
  estado === "denegado"
    ? "No tiene permiso para consultar los catálogos, así que no se puede filtrar por tramo. El resto del informe funciona."
    : estado === "fallo"
      ? "No se pudieron cargar los catálogos, así que no se puede filtrar por tramo. Recargue la pantalla."
      : null;
