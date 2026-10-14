import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import type { TramoConCifras } from "../../../../api/Tramo.api";
import { getEventosPendientesDelTramo } from "../../../../api/Evento.api";
import { mensajeDeError } from "../../../../api/descarga";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import type { EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import BitacoraPanel from "../../../../components/BitacoraPanel";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { openedAgo } from "../../inicio/helpers";
import { Encabezado } from "./panelUi";

// The views of a tramo's card other than its summary. Each takes the whole
// card and keeps the card's own header — the tramo's name over the list — so
// it is always plain which tramo the list under it belongs to.

const fila =
  "flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-sm transition-colors hover:bg-muted -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring";

function Cargando() {
  return (
    <div className="space-y-1.5" role="status" aria-label="Cargando">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
    </div>
  );
}

/** A pole as the list serves it: with the count of its open incidents, which the type of a bare pole lacks. */
type PosteConPendientes = PosteInterface & { pendingEvents?: number | string };

interface PropsPostes {
  tramo: TramoConCifras;
  /** The tramo's poles, which the page already holds: the map draws them. */
  postes: PosteConPendientes[];
  cargando: boolean;
}

/**
 * What a pole's row says under its name: who owns it, what it is made of and,
 * for a role that may read incidents, how many it has open.
 *
 * All of it comes with the row already — the pole list sends the owner, the
 * material and the count — so the view asks for nothing more. Each part is
 * left out when the row does not carry it, rather than shown as a dash.
 */
function datosDelPoste(p: PosteConPendientes, verEventos: boolean): string {
  const pendientes = Number(p.pendingEvents ?? 0);
  return [
    p.propietario?.name,
    p.material?.name,
    verEventos && p.pendingEvents !== undefined
      ? pendientes === 0 ? "sin pendientes" : `${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"}`
      : null,
  ].filter(Boolean).join(" · ");
}

/** Every pole of the tramo, each a link to its own sheet. */
export function PanelTramoPostes({ tramo, postes, cargando }: PropsPostes) {
  const { sesion } = useContext(SesionContext);
  const verEventos = can(sesion.usuario.id_rol, "eventos", "ver");
  return (
    <div className="space-y-3">
      <Encabezado rotulo="Postes del tramo" titulo={tramo.nombre} />
      {cargando ? <Cargando /> : postes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este tramo no tiene postes.</p>
      ) : (
        <ul aria-label={`Postes de ${tramo.nombre}`} className="space-y-1.5">
          {postes.map((p) => (
            <li key={p.id}>
              <Link to={`/app/postes/${p.id}`} className={fila}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">Poste {p.name}</span>
                  {datosDelPoste(p, verEventos) && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {datosDelPoste(p, verEventos)}
                    </span>
                  )}
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Carga =
  | { estado: "cargando" }
  | { estado: "lista"; eventos: EventoInterface[] }
  | { estado: "fallo"; mensaje: string };

/** Priority first, then the oldest: the one that has waited longest is the one to look at. */
const porUrgencia = (a: EventoInterface, b: EventoInterface) =>
  Number(!!b.priority) - Number(!!a.priority) || new Date(a.date).getTime() - new Date(b.date).getTime();

/**
 * The incidents still open on the tramo's poles, each a link to its own sheet.
 *
 * Asked for when the view is opened, not with the tramo: most visits to a card
 * never open it. It is the list behind the `pendientes` figure on the tramo's
 * row, counted the same way on the server.
 */
export function PanelTramoPendientes({ tramo }: { tramo: TramoConCifras }) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  // Only the last question asked gets to write: the card can move to another
  // tramo, or be retried, with an answer still on its way.
  const pregunta = useRef(0);

  const pedir = useCallback(() => {
    const esta = ++pregunta.current;
    setCarga({ estado: "cargando" });
    getEventosPendientesDelTramo(tramo.id)
      .then((eventos) => {
        if (esta === pregunta.current) setCarga({ estado: "lista", eventos: [...eventos].sort(porUrgencia) });
      })
      .catch((error) => {
        if (esta === pregunta.current) {
          setCarga({ estado: "fallo", mensaje: mensajeDeError(error, "No se pudieron cargar los eventos del tramo") });
        }
      });
  }, [tramo.id]);

  useEffect(() => {
    pedir();
    // A late answer must not write into a card that is gone.
    return () => { pregunta.current += 1; };
  }, [pedir]);

  return (
    <div className="space-y-3">
      <Encabezado rotulo="Eventos pendientes del tramo" titulo={tramo.nombre} />
      {carga.estado === "cargando" && <Cargando />}
      {carga.estado === "fallo" && (
        // A failure is not "no incidents": said, with the way to ask again.
        <div className="space-y-2">
          <p className="text-sm text-destructive">{carga.mensaje}</p>
          <Button variant="outline" size="sm" onClick={pedir}>Reintentar</Button>
        </div>
      )}
      {carga.estado === "lista" && carga.eventos.length === 0 && (
        <p className="text-sm text-muted-foreground">Este tramo no tiene eventos pendientes.</p>
      )}
      {carga.estado === "lista" && carga.eventos.length > 0 && (
        <ul aria-label={`Eventos pendientes de ${tramo.nombre}`} className="space-y-1.5">
          {carga.eventos.map((e) => (
            <li key={e.id}>
              <Link to={`/app/eventos/${e.id}`} className={fila}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.description}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {e.poste?.name ? `Poste ${e.poste.name} · ` : ""}
                    {openedAgo(e.date)}
                    {e.priority ? " · prioritario" : ""}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What has been done to the tramo, and by whom: the panel every sheet uses. */
export function PanelTramoBitacora({ tramo }: { tramo: TramoConCifras }) {
  return (
    <div className="space-y-3">
      <Encabezado rotulo="Bitácora del tramo" titulo={tramo.nombre} />
      <BitacoraPanel entity="Tramo" entityId={tramo.id} />
    </div>
  );
}
