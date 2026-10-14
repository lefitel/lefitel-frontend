import { EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import PosteDetalleEventosResueltos from "./PosteDetalleEventosResueltos";
import PosteDetalleVecinos from "./PosteDetalleVecinos";
import BitacoraPanel from "../../../../components/BitacoraPanel";
import type { VistaPoste } from "./posteVistas";

interface Props {
  vista: Exclude<VistaPoste, "resumen">;
  loading: boolean;
  poste: PosteInterface | null;
  eventos: EventoInterface[];
  tramoPostes: PosteInterface[];
  onVerPoste: (id: number) => void;
  onVerEvento: (id: number) => void;
}

const TITULO: Record<Props["vista"], string> = {
  resueltos: "Eventos resueltos",
  vecinos: "Vecinos del tramo",
  bitacora: "Bitácora",
};

/**
 * One of the pole's long lists, with the whole panel to itself: its closed
 * incidents, the poles it shares a stretch with, or its audit log. Which one
 * is chosen on the rail, and the rail is what knows which a role may open.
 */
export default function PosteDetalleHistorial({
  vista, loading, poste, eventos, tramoPostes, onVerPoste, onVerEvento,
}: Props) {
  const count =
    vista === "resueltos" ? eventos.filter((e) => e.state).length :
    vista === "vecinos" ? tramoPostes.filter((p) => p.id !== poste?.id).length :
    0;

  return (
    // Straight on the panel, which is the card.
    <div>
      <h2 className="px-3 py-2.5 text-sm font-semibold">
        {TITULO[vista]}
        {count > 0 && <span className="text-muted-foreground font-normal tabular-nums"> · {count}</span>}
      </h2>
      <div className="px-3 pb-3">
        {vista === "resueltos" && (
          <PosteDetalleEventosResueltos loading={loading} eventos={eventos} onVerDetalle={onVerEvento} />
        )}
        {vista === "vecinos" && (
          <PosteDetalleVecinos
            loading={loading}
            postes={tramoPostes}
            posteActualId={poste?.id}
            onVerPoste={onVerPoste}
          />
        )}
        {vista === "bitacora" && <BitacoraPanel entity="Poste" entityId={poste?.id} />}
      </div>
    </div>
  );
}
