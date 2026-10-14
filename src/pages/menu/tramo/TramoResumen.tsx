import type { TramoConCifras } from "../../../api/Tramo.api";

/**
 * A tramo as a row of a list reads it: its name with the line to itself, and
 * under it what is known about it — department, poles, incidents still open —
 * in one line and one colour, none of the three louder than the others.
 *
 * A figure is absent, not zero, for a role that cannot read what it counts,
 * and so is left out rather than shown as 0.
 */
export default function TramoResumen({ tramo }: { tramo: TramoConCifras }) {
  return (
    <>
      <span className="block truncate text-sm font-medium">{tramo.nombre}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {tramo.departamento?.name ?? "Sin departamento"}
        {tramo.postes !== undefined && (
          <>
            {" · "}
            <span className="tabular-nums">{tramo.postes}</span> {tramo.postes === 1 ? "poste" : "postes"}
          </>
        )}
        {tramo.pendientes !== undefined && (
          <>
            {" · "}
            {tramo.pendientes === 0 ? "sin pendientes" : (
              <>
                <span className="tabular-nums">{tramo.pendientes}</span>{" "}
                {tramo.pendientes === 1 ? "pendiente" : "pendientes"}
              </>
            )}
          </>
        )}
      </span>
    </>
  );
}
