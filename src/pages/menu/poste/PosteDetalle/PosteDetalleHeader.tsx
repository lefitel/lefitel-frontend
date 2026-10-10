import { PosteInterface } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { ChevronRightIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { HealthStatus, STATUS_CONFIG } from "./posteHealth";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  /** `null` for a role that may not see incidents: the state is made of them. */
  status?: HealthStatus | null;
  canCreateEvento: boolean;
  canEditPoste: boolean;
  onNuevoEvento: () => void;
  onEditarPoste: () => void;
  onRefrescar: () => void;
}

/**
 * The first card of the pole's panel, under its photograph: its name, its state, what
 * can be done to it.
 */
export default function PosteDetalleHeader({
  loading, poste, status,
  canCreateEvento, canEditPoste,
  onNuevoEvento, onEditarPoste, onRefrescar,
}: Props) {
  const cfg = status ? STATUS_CONFIG[status] : null;

  return (
    <div className="p-3 space-y-2.5">
      <div className="min-w-0">
        {loading ? (
          <>
            <Skeleton className="h-6 w-36 mb-1.5" />
            <Skeleton className="h-4 w-48" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight leading-tight truncate">
                Poste {poste?.name ?? "—"}
              </h1>
              {cfg && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 min-w-0">
              <span className="truncate">{poste?.ciudadA?.name ?? "—"}</span>
              <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="truncate">{poste?.ciudadB?.name ?? "—"}</span>
            </p>
          </>
        )}
      </div>

      {/*
        On the panel, not behind a «⋯». That menu held these two and nothing
        else, so each of them cost a click to find and a click to press, for
        the sake of hiding two buttons there was room for. Editing keeps its
        word because it is the one somebody looks for; refreshing is an icon
        every table here already uses, and is named for whoever cannot see it.
      */}
      <div className="flex items-center gap-2">
        {canCreateEvento && (
          <Button
            size="sm"
            className="gap-1.5 flex-1"
            onClick={onNuevoEvento}
            disabled={loading || !poste}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Nuevo evento
          </Button>
        )}
        {canEditPoste && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onEditarPoste}
            disabled={loading || !poste}
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRefrescar}
          disabled={loading}
          aria-label="Refrescar"
          title="Refrescar"
        >
          <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
