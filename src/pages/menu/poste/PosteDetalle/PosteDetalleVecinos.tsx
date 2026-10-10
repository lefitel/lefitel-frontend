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
      <div className="grid grid-cols-1 gap-2">
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

  // No sentence above the list: how many there are is on the section's title,
  // and which one this is, on the pole's own card.
  return (
    <div>
      <ul className="grid grid-cols-1 gap-2">
        {postes.map((p, i) => {
          const isActual = p.id === posteActualId;
          return (
            <li key={p.id as number}>
              <button
                type="button"
                disabled={isActual}
                onClick={() => onVerPoste(p.id as number)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
                  isActual
                    ? "border-primary/40 bg-primary/5 cursor-default"
                    : "border-border/50 hover:border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActual ? "bg-primary-fill text-primary-foreground" : "bg-muted text-muted-foreground"
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
