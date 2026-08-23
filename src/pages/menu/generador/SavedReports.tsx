import { CopyIcon, StarIcon, Trash2Icon, UsersIcon, LockIcon } from "lucide-react";
import type { SavedReport } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";

interface Props {
  reports: SavedReport[];
  /**
   * How many saved reports exist in all, which is not always how many are
   * listed: the endpoint returns one page. Shown so a capped list never reads
   * as the whole of it.
   */
  total?: number;
  onLoadMore?: () => void;
  currentId: number | null;
  currentUserId: number | undefined;
  onOpen: (report: SavedReport) => void;
  /**
   * The three that write.
   *
   * Undefined means this role does not hold the permission, and the control is
   * not drawn at all: the server gates each of them separately, and a button
   * whose only outcome is "No tiene permiso" is worse than no button. Opening
   * is not here — it is `ver`, which the page already required to load.
   */
  onToggleFavorite?: (report: SavedReport) => void;
  onDuplicate?: (report: SavedReport) => void;
  onDelete?: (report: SavedReport) => void;
  loading?: boolean;
  /**
   * The list could not be read.
   *
   * Distinct from "there are none", which is what this panel used to say in
   * both cases: the failure only fired a toast that disappears, and then the
   * panel stated, permanently, that the user had never saved a report. Somebody
   * with forty of them was told to build their first. The field picker two
   * cards down already had this state and its own Reintentar; this did not.
   */
  failed?: boolean;
  onRetry?: () => void;
}

const SavedReports = ({
  reports, total, onLoadMore, currentId, currentUserId, onOpen, onToggleFavorite, onDuplicate,
  onDelete, loading, failed, onRetry,
}: Props) => {
  const missing = Math.max(0, (total ?? reports.length) - reports.length);
  if (reports.length === 0 && failed) {
    return (
      <div className="rounded-md border border-dashed px-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar sus reportes guardados.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    );
  }
  if (reports.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Todavía no hay reportes guardados. Arme uno y guárdelo para volver a usarlo.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {reports.map((report) => {
        const mine = report.id_usuario === currentUserId;
        const author = report.usuario?.name
          ? `${report.usuario.name} ${report.usuario.lastname ?? ""}`.trim()
          : null;

        return (
          <li
            key={report.id}
            className={cn(
              "flex items-center gap-2 px-2 py-2",
              report.id === currentId && "bg-accent/50",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(report)}
              disabled={loading}
              className="min-w-0 flex-1 text-left"
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{report.name}</span>
                {report.visibility === "shared" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <UsersIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Compartido con el equipo</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Privado</TooltipContent>
                  </Tooltip>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {report.description || (author && !mine ? `De ${author}` : "Sin descripción")}
              </span>
            </button>

            {mine && onToggleFavorite && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                aria-label={report.favorite ? `Quitar ${report.name} de favoritos` : `Marcar ${report.name} como favorito`}
                aria-pressed={report.favorite}
                onClick={() => onToggleFavorite(report)}
              >
                <StarIcon
                  className={cn("h-3.5 w-3.5", report.favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground")}
                />
              </Button>
            )}

            {onDuplicate && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                aria-label={`Duplicar ${report.name}`}
                onClick={() => onDuplicate(report)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </Button>
            )}

            {mine && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Archivar ${report.name}`}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Archivar «{report.name}»?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El reporte dejará de estar disponible para usted y para el resto del equipo, y no
              podrá recuperarlo desde el sistema. Los datos que consulta no se tocan: sólo se
              archiva este reporte guardado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(report)}>Archivar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        );
      })}

      {missing > 0 && (
        <li className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Mostrando {reports.length} reportes de {total}.
          </span>
          {onLoadMore && (
            <Button variant="ghost" size="sm" className="h-7" onClick={onLoadMore} disabled={loading}>
              Cargar más
            </Button>
          )}
        </li>
      )}
    </ul>
  );
};

export default SavedReports;
