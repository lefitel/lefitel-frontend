import { Link } from "react-router-dom";
import { RouteIcon } from "lucide-react";
import Dato from "../../../components/Dato";
import type { Tramo } from "../../../interfaces/interfaces";

/**
 * The tramo something belongs to, as a fact of its detail sheet: its name
 * leading to the tramo's own card, and its department under it. It takes the
 * whole width — "Villa Montes – Yacuiba" does not fit in half of it — and is
 * left out when there is no tramo to name.
 */
export default function DatoTramo({ tramo, canVerTramos }: {
  tramo: Tramo | null | undefined;
  /** Whether the name is a link: `tramos.ver`. */
  canVerTramos: boolean;
}) {
  if (!tramo?.nombre) return null;
  return (
    <Dato icon={<RouteIcon />} label="Tramo" ancho sub={tramo.departamento?.name}>
      {/* The network page holds the active tramos only: an archived one has
          no card there to open. */}
      {canVerTramos && !tramo.archivado ? (
        <Link to={`/app/tramos/${tramo.id}`} className="text-primary hover:underline underline-offset-2">
          {tramo.nombre}
        </Link>
      ) : (
        tramo.nombre
      )}
    </Dato>
  );
}
