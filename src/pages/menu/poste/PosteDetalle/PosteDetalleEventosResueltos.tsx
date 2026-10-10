import { useMemo } from "react";
import { EventoInterface } from "../../../../interfaces/interfaces";
import { Skeleton } from "../../../../components/ui/skeleton";
import { ChevronRightIcon } from "lucide-react";
import { daysToResolve, resolvedAt } from "./posteHealth";

interface Props {
  loading: boolean;
  eventos: EventoInterface[];
  onVerDetalle: (id: number) => void;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(days: number | null) {
  if (days === null) return null;
  const whole = Math.round(days);
  if (whole === 0) return "en el día";
  return whole === 1 ? "en 1 día" : `en ${whole} días`;
}

/** The pole's closed incidents, the most recently closed first. */
export default function PosteDetalleEventosResueltos({ loading, eventos, onVerDetalle }: Props) {
  const resueltos = useMemo(
    () => eventos
      .filter((e) => e.state)
      .map((e) => ({ evento: e, cierre: resolvedAt(e) }))
      .sort((a, b) => (b.cierre?.getTime() ?? 0) - (a.cierre?.getTime() ?? 0)),
    [eventos]
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (resueltos.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Este poste no tiene eventos resueltos.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {resueltos.map(({ evento, cierre }) => {
        const duration = fmtDuration(daysToResolve(evento));
        return (
          <li key={evento.id as number}>
            <button
              type="button"
              onClick={() => onVerDetalle(evento.id as number)}
              className="w-full text-left rounded-lg border border-border/50 px-3 py-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{evento.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cierre ? `Resuelto el ${fmtDate(cierre)}` : "Resuelto"}
                    {duration && (
                      <>
                        <span className="mx-1.5 text-muted-foreground/40">·</span>
                        {duration}
                      </>
                    )}
                  </p>
                </div>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
