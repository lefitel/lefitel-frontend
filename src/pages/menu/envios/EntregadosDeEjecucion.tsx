import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarDestinatariosDeEjecucion,
  type EjecucionDelHistorial,
  type EntregaDeEjecucion,
} from "../../../api/Programacion.api";
import { ENTREGA_DE_EJECUCION, entregadosDe } from "../../../lib/envios";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { TONO } from "../../../components/tonos";

type Lista =
  | { tipo: "cargando" }
  | { tipo: "fallo" }
  | { tipo: "lista"; filas: EntregaDeEjecucion[] };

/** A list, and the run as it was when it was asked for: see `clave` below. */
interface Cargada {
  clave: string;
  lista: Lista;
}

/**
 * The «Entregados» cell of a run in the history: «2 de 3», and — when the run
 * recorded who it was sent to — a button that lists them, each with what became
 * of it.
 *
 * The list is asked for when the button is first pressed and kept for as long
 * as the row is on screen; a failed one is asked for again. A run still going
 * is asked for every time, since it is still writing. **A list belongs to the
 * run as it was when it was asked for**: the row stays mounted when the history
 * is read again, so a list loaded mid-run would otherwise go on showing two
 * recipients under «5 de 5» once the run is over. When the state or the counts
 * of the run change, the list is forgotten.
 *
 * **Every cell holds its own list**, so an answer that arrives late can only
 * land in the cell that asked: opening one run, closing it and opening another
 * cannot put the first one's recipients in the second one's popover.
 */
export default function EntregadosDeEjecucion({ ejecucion: e }: { ejecucion: EjecucionDelHistorial }) {
  const texto = entregadosDe(e);
  const clave = `${e.estado}|${e.enviados}|${e.no_enviados}`;
  const [cargada, setCargada] = useState<Cargada | null>(null);
  const lista = cargada?.clave === clave ? cargada.lista : null;
  // Raised on every mount, not only declared `true`: see the page.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  const pregunta = useRef(0);

  const cargar = useCallback(async () => {
    const esta = ++pregunta.current;
    setCargada({ clave, lista: { tipo: "cargando" } });
    try {
      const sobre = await listarDestinatariosDeEjecucion(e.id);
      if (montado.current && esta === pregunta.current) setCargada({ clave, lista: { tipo: "lista", filas: sobre.data } });
    } catch {
      if (montado.current && esta === pregunta.current) setCargada({ clave, lista: { tipo: "fallo" } });
    }
  }, [e.id, clave]);

  // A skipped run tried nobody, whatever else is true of it.
  if (e.estado === "omitido") return <span className="whitespace-nowrap tabular-nums">{texto}</span>;

  // Nothing recorded. For a run from before the record existed that tried
  // somebody, the reason is said rather than left for the person to wonder; for
  // one that tried nobody (it failed before sending) or has not tried yet (it
  // is still building its files) there is nothing missing, and saying so would
  // be false.
  if (!e.con_destinatarios) {
    const intento = e.enviados + e.no_enviados > 0 && e.estado !== "en_curso";
    return (
      <div className="whitespace-nowrap tabular-nums">
        <span>{texto}</span>
        {intento && <span className="block text-xs text-muted-foreground">No se registró a quién</span>}
      </div>
    );
  }

  // The click is the button's and the list's, not the row's: the row opens the
  // schedule. React delivers a click inside the portal to the row through the
  // component tree, so the list stops it as well.
  const noAbrirLaFila = (ev: { stopPropagation(): void }) => ev.stopPropagation();

  return (
    <Popover
      onOpenChange={(abierta) => {
        if (abierta && (lista === null || lista.tipo === "fallo" || e.estado === "en_curso")) void cargar();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver destinatarios de este envío"
          onClick={noAbrirLaFila}
          className="whitespace-nowrap tabular-nums underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
        >
          {texto}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Destinatarios de este envío" className="w-80 p-2" onClick={noAbrirLaFila}>
        {lista === null || lista.tipo === "cargando" ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : lista.tipo === "fallo" ? (
          <div className="flex flex-col items-center gap-2 px-2 py-3 text-center">
            <p className="text-sm text-muted-foreground">No se pudieron cargar los destinatarios.</p>
            <Button variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {lista.filas.map((f) => {
              const { etiqueta, tono } = ENTREGA_DE_EJECUCION[f.resultado] ?? { etiqueta: f.resultado, tono: "neutro" as const };
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {f.nombre}
                    {f.tipo === "externo" && (
                      <span className="ml-1.5 rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-medium text-muted-foreground">externo</span>
                    )}
                  </span>
                  <span className={cn("shrink-0 text-xs font-semibold", TONO[tono])}>{etiqueta}</span>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
