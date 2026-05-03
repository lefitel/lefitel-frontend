import { PosteInterface } from "../../../../interfaces/interfaces";
import { Skeleton } from "../../../../components/ui/skeleton";
import { ChevronRightIcon, MapPinIcon, ZapIcon } from "lucide-react";

interface Props {
  loading: boolean;
  postes: PosteInterface[];
  posteActualId: number | null | undefined;
  onVerPoste: (id: number) => void;
}

export default function PosteDetalleVecinos({ loading, postes, posteActualId, onVerPoste }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const otros = postes.filter((p) => p.id !== posteActualId);

  if (otros.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Este poste no tiene vecinos en el tramo.
      </div>
    );
  }

  const idx = postes.findIndex((p) => p.id === posteActualId);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {otros.length} poste{otros.length === 1 ? "" : "s"} en el mismo tramo.
        {idx >= 0 && (
          <> Este es el #{idx + 1} de {postes.length}.</>
        )}
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {postes.map((p, i) => {
          const isActual = p.id === posteActualId;
          return (
            <li key={p.id as number}>
              <button
                type="button"
                disabled={isActual}
                onClick={() => onVerPoste(p.id as number)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  isActual
                    ? "border-primary/40 bg-primary/5 cursor-default"
                    : "border-border/50 hover:border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActual ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">Poste {p.name}</p>
                      {isActual && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Actual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 min-w-0">
                      {p.material?.name && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <ZapIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{p.material.name}</span>
                        </span>
                      )}
                      {p.propietario?.name && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPinIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{p.propietario.name}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {!isActual && <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
