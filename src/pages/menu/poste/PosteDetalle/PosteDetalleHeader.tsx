import { PosteInterface } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { PencilIcon, PlusIcon } from "lucide-react";
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
}

/**
 * The top of the pole's panel, under its photograph: its name, its state, what
 * can be done to it.
 */
export default function PosteDetalleHeader({
  loading, poste, status,
  canCreateEvento, canEditPoste,
  onNuevoEvento, onEditarPoste,
}: Props) {
  const cfg = status ? STATUS_CONFIG[status] : null;

  return (
    <div className="p-3 space-y-2.5">
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-6 w-36" />
        ) : (
          <>
            {/* The tramo is not said here: it is a row of the sheet below. */}
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
          </>
        )}
      </div>

      {/*
        On the panel, not behind a «⋯». That menu held these and nothing else,
        so each of them cost a click to find and a click to press, for the sake
        of hiding buttons there was room for. There is no refresh button: the
        browser has one. A role with neither permission gets no empty row.
      */}
      {(canCreateEvento || canEditPoste) && (
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
              className="gap-1.5 flex-1"
              onClick={onEditarPoste}
              disabled={loading || !poste}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
