import { ESTADO_DE_EJECUCION, type Tono } from "../lib/envios";
import type { EstadoDeEjecucion } from "../api/Programacion.api";
import { cn } from "../lib/utils";
import { TONO } from "./tonos";

/**
 * How a run of a scheduled report ended, as a dot and a word. The Envíos
 * table, the dialog's history of one schedule and the screen's history of all
 * of them draw it the same way, so it lives here and not in any of them.
 */
export const Estado = ({ estado }: { estado: EstadoDeEjecucion }) => {
  const { etiqueta, tono } = ESTADO_DE_EJECUCION[estado] ?? { etiqueta: estado, tono: "neutro" as Tono };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap", TONO[tono])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {etiqueta}
    </span>
  );
};
