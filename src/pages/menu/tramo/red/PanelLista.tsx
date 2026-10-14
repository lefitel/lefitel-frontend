import { useContext, useEffect, useRef } from "react";
import { ChevronRightIcon, ListFilterIcon, PencilIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import type { TramoConCifras } from "../../../../api/Tramo.api";
import { Encabezado } from "./panelUi";
import { NINGUNO } from "./departamentoValor";
import { TODOS, tramoEncaja, type FiltrosLista } from "./filtrosLista";

interface Props {
  tramos: TramoConCifras[];
  /** The selected tramo: marked in the list, and the one the map draws. */
  tramoSel: number | null;
  busqueda: string;
  setBusqueda: (q: string) => void;
  filtros: FiltrosLista;
  setFiltros: (f: FiltrosLista) => void;
  /** null takes the selection off. */
  onSeleccionar: (s: { tramo: number } | null) => void;
  /** Opens that tramo's card, selecting it if it was not. */
  onDetalle: (tramo: number) => void;
  /** Starts a new tramo. Absent for a role that may not create one, and so is the button. */
  onNuevoTramo?: () => void;
}

/**
 * Every tramo of the network, by name. Rows keep the order they arrived in.
 *
 * Tramos only: this is the Tramos screen, and a city is reached by pressing it
 * on the map or from a tramo it bounds. The cities have a screen of their own.
 *
 * Pressing a row selects it and no more: the map draws that tramo and the list
 * stays, so one after another can be looked at without leaving it. The way
 * into a tramo's card is the small button at the end of its row.
 *
 * The filter is the page's, not this list's: it also takes cities off the map
 * beside it (see `ciudadesDelMapa`).
 */
export default function PanelLista({
  tramos, tramoSel, busqueda, setBusqueda, filtros, setFiltros, onSeleccionar, onDetalle, onNuevoTramo,
}: Props) {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  // The card is where a tramo is changed; for a role that can change nothing
  // it is still where its cities and its poles are read, and is called that.
  const puedeCambiar = can(rol, "tramos", "editar") || can(rol, "tramos", "archivar");

  const q = busqueda.trim().toLowerCase();
  const filtrando = filtros.departamento !== TODOS;
  const vistos = tramos.filter((t) => t.nombre.toLowerCase().includes(q) && tramoEncaja(t, filtros));

  // Only the departments some tramo is in: one with none would be a filter
  // that can only ever answer "nothing".
  const departamentos = [...new Map(
    tramos.flatMap((t) => (t.departamento ? [[t.departamento.id, t.departamento] as const] : [])),
  ).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const haySinDepartamento = tramos.some((t) => t.id_departamento === null);

  // A selection made elsewhere — a tramo just created, a row of a city's card —
  // can be far down the list. `nearest`, so a row already in sight does not move.
  const filaSel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tramoSel !== null) filaSel.current?.scrollIntoView?.({ block: "nearest" });
  }, [tramoSel]);

  return (
    <div className="space-y-3">
      <Encabezado
        rotulo="Red"
        titulo={`${tramos.length} ${tramos.length === 1 ? "tramo" : "tramos"}`}
        accion={onNuevoTramo && (
          <Button size="sm" className="gap-1.5" onClick={onNuevoTramo}>
            <PlusIcon className="h-4 w-4" />
            Añadir tramo
          </Button>
        )}
      />
      <div className="flex items-center gap-2">
        <Input
          aria-label="Buscar por nombre"
          placeholder="Buscar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative shrink-0"
              aria-label={filtrando ? "Filtros (1 aplicado)" : "Filtros"}
            >
              <ListFilterIcon className="h-4 w-4" />
              {/* A filter left on and forgotten reads as missing data. */}
              {filtrando && (
                <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary-fill ring-2 ring-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Departamento</span>
              <Select
                value={filtros.departamento}
                onValueChange={(departamento) => setFiltros({ ...filtros, departamento })}
              >
                <SelectTrigger aria-label="Filtrar por departamento" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos los departamentos</SelectItem>
                  {haySinDepartamento && <SelectItem value={NINGUNO}>Sin departamento</SelectItem>}
                  {departamentos.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {filtrando && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setFiltros({ ...filtros, departamento: TODOS })}
              >
                Quitar filtro
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        {vistos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {filtrando ? "Nada con ese nombre y ese filtro." : "Nada con ese nombre."}
          </p>
        )}
        {vistos.map((t) => {
          const elegido = t.id === tramoSel;
          return (
            // Two buttons side by side, not one inside the other: the row
            // selects, and the small one beside it opens.
            <div
              key={t.id}
              ref={elegido ? filaSel : undefined}
              className={cn(
                "group/fila flex items-center gap-1 rounded-lg transition-colors",
                elegido ? "bg-primary/10 inset-ring inset-ring-primary/40" : "bg-muted/60 hover:bg-muted",
              )}
            >
              <button
                type="button"
                aria-pressed={elegido}
                // Pressed again, the selected row lets go.
                onClick={() => onSeleccionar(elegido ? null : { tramo: t.id })}
                className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {/* Two lines: the name has the row to itself, and what is
                    known about the tramo reads under it instead of squeezing
                    it. A figure is absent, not zero, for a role that cannot
                    read what it counts — and so is left out, not shown as 0. */}
                <span className="block truncate text-sm font-medium">{t.nombre}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {t.departamento?.name ?? "Sin departamento"}
                  {t.postes !== undefined && (
                    <>
                      {" · "}
                      <span className="tabular-nums">{t.postes}</span> {t.postes === 1 ? "poste" : "postes"}
                    </>
                  )}
                  {t.pendientes !== undefined && (
                    <>
                      {" · "}
                      {/* In the line's own colour, like the two before it:
                          three facts about the tramo, none louder. */}
                      {t.pendientes === 0 ? "sin pendientes" : (
                        <>
                          <span className="tabular-nums">{t.pendientes}</span>{" "}
                          {t.pendientes === 1 ? "pendiente" : "pendientes"}
                        </>
                      )}
                    </>
                  )}
                </span>
              </button>
              {/* On every row, and shown by the pointer being over it: the
                  way into a tramo's card without selecting it first. It is
                  always there on the selected row, for the keyboard (it shows
                  on focus) and where there is no pointer to hover with — the
                  `mouse:` variant is what hides it, so a touch screen never
                  does. Its own hover is a darker step of the row's tint, so
                  it visibly answers before it is pressed. */}
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "mr-1 shrink-0 text-primary hover:bg-primary/20 hover:text-primary",
                  !elegido && "mouse:opacity-0 mouse:group-hover/fila:opacity-100 mouse:focus-visible:opacity-100",
                )}
                aria-label={`${puedeCambiar ? "Editar" : "Ver detalle de"} ${t.nombre}`}
                onClick={() => onDetalle(t.id)}
              >
                {puedeCambiar ? <PencilIcon /> : <ChevronRightIcon />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
