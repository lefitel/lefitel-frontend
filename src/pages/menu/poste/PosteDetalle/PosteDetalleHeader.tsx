import { PosteInterface } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { ChevronRightIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  posicionEnTramo?: { index: number; total: number } | null;
  canCreateEvento: boolean;
  canEditPoste: boolean;
  onNuevoEvento: () => void;
  onEditarPoste: () => void;
  onRefrescar: () => void;
}

export default function PosteDetalleHeader({
  loading, poste, posicionEnTramo,
  canCreateEvento, canEditPoste,
  onNuevoEvento, onEditarPoste, onRefrescar,
}: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-4 bg-background/85 supports-backdrop-filter:backdrop-blur-md border-b border-border/40">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {loading ? (
            <>
              <Skeleton className="h-7 w-44 mb-1.5" />
              <Skeleton className="h-4 w-64" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight truncate">
                Poste {poste?.name ?? "—"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                <span className="truncate max-w-[8rem]">{poste?.ciudadA?.name ?? "—"}</span>
                <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="truncate max-w-[8rem]">{poste?.ciudadB?.name ?? "—"}</span>
                {posicionEnTramo && (
                  <>
                    <span className="text-muted-foreground/40 mx-1">·</span>
                    <span className="text-xs">
                      Posición {posicionEnTramo.index} de {posicionEnTramo.total}
                    </span>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canCreateEvento && (
            <Button
              className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
              onClick={onNuevoEvento}
              disabled={loading || !poste}
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo evento
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={loading}>
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canEditPoste && (
                <DropdownMenuItem onClick={onEditarPoste} disabled={!poste}>
                  <PencilIcon className="h-4 w-4" />
                  Editar poste
                </DropdownMenuItem>
              )}
              {canEditPoste && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onRefrescar} disabled={loading}>
                <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refrescar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
