import { ArrowDownIcon, ArrowUpIcon, LayersIcon, XIcon } from "lucide-react";
import type { AggFn, CatalogRoot, ReportConfig } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { findField, isSummary } from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";

const AGG_LABEL: Record<AggFn, string> = {
  count: "Conteo",
  sum: "Suma",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
};

interface Props {
  config: ReportConfig;
  root: CatalogRoot | undefined;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onSetAgg: (index: number, agg?: AggFn) => void;
  onToggleGroup: (path: string) => void;
}

/**
 * The chosen columns, in output order.
 *
 * Grouping is toggled from the column itself rather than a separate panel:
 * the decision "this column defines the groups" belongs next to the column, and
 * it keeps the two lists from drifting apart.
 */
const ColumnList = ({
  config, root, onMove, onRemove, onRename, onSetAgg, onToggleGroup,
}: Props) => {
  const summary = isSummary(config);
  const grouped = new Set(config.groupBy ?? []);

  if (config.columns.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Sin columnas todavía. Añada la primera para empezar.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {config.columns.map((column, index) => {
        const field = findField(root, column.path);
        const isAggregateOnly = root?.aggregateOnly.some((a) => column.path === a.path) ?? false;
        const isGrouped = grouped.has(column.path);
        const available: AggFn[] = isAggregateOnly
          ? ["count", "sum", "min", "max"]
          : field?.aggregates ?? [];

        return (
          <li key={`${column.path}-${index}`} className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Subir columna"
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowUpIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Bajar columna"
                disabled={index === config.columns.length - 1}
                onClick={() => onMove(index, index + 1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowDownIcon className="h-3 w-3" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <Input
                value={column.label ?? ""}
                placeholder={field?.label ?? (isAggregateOnly ? `Nº de ${column.path}` : column.path)}
                aria-label={`Nombre de la columna ${field?.label ?? column.path}`}
                onChange={(e) => onRename(index, e.target.value)}
                className="h-7 border-0 px-1 shadow-none focus-visible:ring-1"
              />
              <p className="truncate px-1 text-[11px] text-muted-foreground">{field?.group ?? "Resumen"}</p>
            </div>

            {available.length > 0 && !isGrouped && (
              <Select
                value={column.agg ?? "none"}
                onValueChange={(v) => onSetAgg(index, v === "none" ? undefined : (v as AggFn))}
              >
                <SelectTrigger
                  className="h-7 w-28 text-xs"
                  aria-label={`Resumen de ${field?.label ?? column.path}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!isAggregateOnly && <SelectItem value="none">Sin resumen</SelectItem>}
                  {available.map((agg) => (
                    <SelectItem key={agg} value={agg}>{AGG_LABEL[agg]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isAggregateOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isGrouped ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    aria-label={isGrouped ? "Dejar de agrupar por esta columna" : "Agrupar por esta columna"}
                    aria-pressed={isGrouped}
                    onClick={() => onToggleGroup(column.path)}
                  >
                    <LayersIcon className={cn("h-3.5 w-3.5", isGrouped && "text-primary-foreground")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isGrouped ? "Agrupando por esta columna" : "Agrupar por esta columna"}
                </TooltipContent>
              </Tooltip>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={`Quitar ${field?.label ?? column.path}`}
              onClick={() => onRemove(index)}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </li>
        );
      })}

      {summary && (
        <li className="bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Reporte agrupado: cada columna no agrupada necesita un resumen.
        </li>
      )}
    </ul>
  );
};

export default ColumnList;
