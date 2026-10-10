import { useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import type { EstadoOpciones, OpcionObs, OpcionSimple } from "../../api/opciones.api";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

interface Props {
  tipos: OpcionSimple[];
  obs: OpcionObs[];
  selected: number[];
  onToggle: (id: number) => void;
  /** Why the lists are empty, when they are. */
  estado: EstadoOpciones;
  /** Editing an incident rather than registering one: it changes what a refusal means. */
  editing: boolean;
}

/** Lower case and without accents, so "electrico" finds "Eléctrico". */
const llano = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Choosing the observations of an incident.
 *
 * It was an accordion that kept one type open at a time. Ticking something
 * under one type and opening the next hid it again, and all that remained was
 * a count: to see what had been chosen, every type had to be opened in turn.
 * It was also written out twice, once in each of the two incident forms.
 *
 * Here every type is open, each says how many of its own are chosen, and what
 * is chosen is repeated at the top as tags that come off with one click. The
 * search is there because the catalogue is a few dozen entries, not a handful.
 */
export default function ObsPicker({ tipos, obs, selected, onToggle, estado, editing }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const grupos = useMemo(() => {
    const aguja = llano(busqueda.trim());
    return tipos
      .map((tipo) => {
        const propias = obs.filter((o) => o.id_tipoObs === tipo.id);
        return {
          tipo,
          total: propias.length,
          elegidas: propias.filter((o) => selected.includes(o.id as number)).length,
          visibles: aguja ? propias.filter((o) => llano(o.name ?? "").includes(aguja)) : propias,
        };
      })
      // A type nothing hangs from is not a choice, with or without a search.
      .filter((g) => g.total > 0);
  }, [tipos, obs, selected, busqueda]);

  if (tipos.length === 0) {
    return (
      <p className="rounded-lg border border-input px-3 py-2.5 text-sm text-muted-foreground">
        {estado === "denegado"
          ? (editing
            ? "No tiene permiso para consultar las observaciones, así que no puede cambiarlas. El resto del evento sí se puede editar."
            : "No tiene permiso para consultar las observaciones, así que no puede registrar la incidencia.")
          : estado === "fallo"
            ? "No se pudieron cargar las observaciones. Cierre y vuelva a abrir para reintentarlo."
            : estado === "cargando"
              ? "Cargando…"
              : "Sin observaciones configuradas."}
      </p>
    );
  }

  const elegidas = obs.filter((o) => selected.includes(o.id as number));
  const hayCoincidencias = grupos.some((g) => g.visibles.length > 0);

  return (
    // Enter in the search box filters; it does not save the form around it.
    <div data-no-submit className="space-y-3">
      {elegidas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Observaciones elegidas">
          {elegidas.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onToggle(o.id as number)}
                aria-label={`Quitar ${o.name}`}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/15 pl-2.5 pr-1.5 text-xs font-medium transition-colors hover:bg-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {o.name}
                <XIcon className="h-3 w-3 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          data-no-autofocus
          aria-label="Buscar observación"
          placeholder="Buscar observación…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {!hayCoincidencias && (
        <p className="text-sm text-muted-foreground">Ninguna observación coincide con «{busqueda.trim()}».</p>
      )}

      {grupos.map(({ tipo, total, elegidas: marcadas, visibles }) => visibles.length > 0 && (
        <fieldset key={tipo.id} className="overflow-hidden rounded-lg border border-input">
          <legend className="sr-only">{tipo.name}</legend>
          <div aria-hidden className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm font-semibold">
            <span>{tipo.name}</span>
            <span className={`text-xs font-medium tabular-nums ${marcadas ? "text-primary" : "text-muted-foreground"}`}>
              {marcadas} de {total}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-2">
            {visibles.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 py-1">
                <Checkbox
                  checked={selected.includes(o.id as number)}
                  onCheckedChange={() => onToggle(o.id as number)}
                />
                <span className="text-sm">{o.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
