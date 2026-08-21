import { memo } from "react";
import {
  ArrowDownIcon, ArrowDownNarrowWideIcon, ArrowUpIcon, ArrowUpNarrowWideIcon,
  ArrowUpDownIcon, LayersIcon, XIcon,
} from "lucide-react";
import type { AggFn, CatalogRoot, ColumnSpec, ReportConfig } from "../../../api/generador.api";
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

interface RowProps {
  column: ColumnSpec;
  index: number;
  total: number;
  label: string;
  group: string;
  available: AggFn[];
  isAggregateOnly: boolean;
  canGroup: boolean;
  isGrouped: boolean;
  sortDir: "asc" | "desc" | undefined;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onSetAgg: (index: number, agg?: AggFn) => void;
  onToggleGroup: (index: number) => void;
  onToggleSort: (path: string, agg?: AggFn) => void;
}

/**
 * One column row.
 *
 * Memoised because the parent re-renders on every keystroke of any rename or
 * filter value, and a 60-column report re-reconciles 60 rows with their Radix
 * selects each time — measured at over half a second per keypress.
 */
const ColumnRow = memo(function ColumnRow({
  column, index, total, label, group, available, isAggregateOnly, canGroup, isGrouped, sortDir,
  onMove, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: RowProps) {
  const sortLabel =
    sortDir === "asc" ? `Ordenando por ${label}, ascendente`
    : sortDir === "desc" ? `Ordenando por ${label}, descendente`
    : `Ordenar por ${label}`;

  return (
    <li className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Subir ${label}`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowUpIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={`Bajar ${label}`}
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowDownIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <Input
          value={column.label ?? ""}
          placeholder={label}
          aria-label={`Nombre de la columna ${label}`}
          onChange={(e) => onRename(index, e.target.value)}
          maxLength={120}
          className="h-7 border-0 px-1 shadow-none focus-visible:ring-1"
        />
        <p className="truncate px-1 text-xs text-muted-foreground">{group}</p>
      </div>

      {available.length > 0 && !isGrouped && (
        <Select
          value={column.agg ?? "none"}
          onValueChange={(v) => onSetAgg(index, v === "none" ? undefined : (v as AggFn))}
        >
          <SelectTrigger className="h-7 w-28 text-xs" aria-label={`Resumen de ${label}`}>
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={sortDir ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label={sortLabel}
            // The aggregate travels with the path. Without it the server
            // refuses every sort in a grouped report — a column that is not
            // grouped has to say how it is summarised — and two rows of the
            // same field could not be sorted apart.
            onClick={() => onToggleSort(column.path, column.agg)}
          >
            {sortDir === "asc" ? <ArrowUpNarrowWideIcon className="h-3.5 w-3.5" />
              : sortDir === "desc" ? <ArrowDownNarrowWideIcon className="h-3.5 w-3.5" />
              : <ArrowUpDownIcon className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{sortLabel}</TooltipContent>
      </Tooltip>

      {canGroup && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isGrouped ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              aria-label={isGrouped ? `Dejar de agrupar por ${label}` : `Agrupar por ${label}`}
              aria-pressed={isGrouped}
              onClick={() => onToggleGroup(index)}
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
        aria-label={`Quitar ${label}`}
        onClick={() => onRemove(index)}
      >
        <XIcon className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
});

interface Props {
  config: ReportConfig;
  root: CatalogRoot | undefined;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onSetAgg: (index: number, agg?: AggFn) => void;
  onToggleGroup: (index: number) => void;
  onToggleSort: (path: string, agg?: AggFn) => void;
}

/**
 * The chosen columns, in output order.
 *
 * Grouping and sorting are toggled from the column itself rather than a
 * separate panel: both decisions belong next to the column they describe, and
 * it keeps the lists from drifting apart.
 */
const ColumnList = ({
  config, root, onMove, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: Props) => {
  const summary = isSummary(config);
  const grouped = new Set(config.groupBy ?? []);
  // Keyed by column, not by field: the minimum and the maximum of the same
  // date are two columns, and keyed by path alone one arrow lit both of them
  // while only one could ever be sorted.
  const sortKey = (path: string, agg?: AggFn) => `${path}|${agg ?? ""}`;
  const sortByColumn = new Map((config.sort ?? []).map((s) => [sortKey(s.path, s.agg), s.dir]));

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
        const relation = root?.aggregateOnly.find((a) => column.path === a.path);
        const label = field?.label ?? (relation ? `Nº de ${relation.label.toLowerCase()}` : column.path);
        const group = field?.group ?? relation?.group ?? "Resumen";

        return (
          <ColumnRow
            // Keyed by identity, not position: keying by index remounted every
            // row on a move and threw keyboard focus back to the document.
            key={`${column.path}|${column.agg ?? ""}`}
            column={column}
            index={index}
            total={config.columns.length}
            label={label}
            group={group}
            // A to-many relation can only be counted: the server needs a field
            // for any other aggregate, and the interface has no way to pick one.
            available={isAggregateOnly ? ["count"] : field?.aggregates ?? []}
            isAggregateOnly={isAggregateOnly}
            // A count cannot define groups; the server rejects it, and the
            // catalog now says which fields are already summaries.
            canGroup={!isAggregateOnly && !field?.aggregate}
            isGrouped={grouped.has(column.path)}
            sortDir={sortByColumn.get(sortKey(column.path, column.agg))}
            onMove={onMove}
            onRemove={onRemove}
            onRename={onRename}
            onSetAgg={onSetAgg}
            onToggleGroup={onToggleGroup}
            onToggleSort={onToggleSort}
          />
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
