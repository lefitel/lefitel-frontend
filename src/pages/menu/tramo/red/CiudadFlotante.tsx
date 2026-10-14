import { Link } from "react-router-dom";
import { ArrowUpRightIcon, PlusIcon } from "lucide-react";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import { Button } from "../../../../components/ui/button";
import { nombreDeCiudad } from "../../../../lib/nombreDeCiudad";

interface Props {
  ciudad: CiudadDeRed;
  /** The live tramos that end in this city. */
  tramos: TramoConCifras[];
  /** Selects that tramo: it is marked in the list and drawn on the map. */
  onTramo: (id: number) => void;
  /** Starts a new tramo from this city. Absent for a role that may not create one. */
  onTramoDesdeAqui?: () => void;
  /** Whether this role may open the city's own sheet (`ciudades.ver`). */
  puedeVerFicha: boolean;
}

/**
 * What the map says about a city that is pressed: its name, the tramos that
 * leave it, and the two things that can be done about it from here.
 *
 * This is the Tramos screen, so a city is read here and not changed: its name,
 * its photo and where it stands are edited on its own sheet, which the last
 * link opens. It floats over the map, on the city, and the list beside the map
 * stays where it was.
 */
export default function CiudadFlotante({ ciudad, tramos, onTramo, onTramoDesdeAqui, puedeVerFicha }: Props) {
  return (
    <div className="min-w-56 space-y-2.5 py-1">
      <div>
        <p className="text-sm font-bold leading-tight text-foreground">{nombreDeCiudad(ciudad)}</p>
        <p className="text-xs text-muted-foreground">
          {tramos.length === 0 ? "Sin tramos todavía" : `${tramos.length} ${tramos.length === 1 ? "tramo" : "tramos"}`}
        </p>
      </div>

      {tramos.length > 0 && (
        // Its own scroll: a hub with twenty tramos must not grow a card taller
        // than the map — 320px on a phone, which is why it is shorter there.
        <ul aria-label={`Tramos de ${nombreDeCiudad(ciudad)}`} className="max-h-28 space-y-1 overflow-y-auto sm:max-h-44">
          {tramos.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTramo(t.id)}
                className="w-full truncate rounded-md bg-muted/60 px-2 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(onTramoDesdeAqui || puedeVerFicha) && (
        <div className="space-y-1.5">
          {onTramoDesdeAqui && (
            <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={onTramoDesdeAqui}>
              <PlusIcon className="h-3.5 w-3.5" />
              Tramo desde aquí
            </Button>
          )}
          {puedeVerFicha && (
            <Button asChild size="sm" className="h-7 w-full gap-1.5 text-xs">
              <Link to={`/app/ciudades/${ciudad.id}`}>
                Abrir ficha de la ciudad
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
