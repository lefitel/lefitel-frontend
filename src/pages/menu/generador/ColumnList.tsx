import { memo } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownNarrowWideIcon, ArrowUpNarrowWideIcon,
  ArrowUpDownIcon, GripVerticalIcon, LayersIcon, XIcon,
} from "lucide-react";
import type { AggFn, CatalogRoot, ColumnSpec, ReportConfig } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { AGG_LABEL, columnKey, fieldLabel, findField, isSummary } from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";

interface RowProps {
  column: ColumnSpec;
  index: number;
  label: string;
  group: string;
  available: AggFn[];
  isAggregateOnly: boolean;
  canGroup: boolean;
  isGrouped: boolean;
  sortDir: "asc" | "desc" | undefined;
  /** Identity that survives a reorder; see `columnKey`. */
  id: string;
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
  column, index, label, group, available, isAggregateOnly, canGroup, isGrouped, sortDir,
  id, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const sortLabel =
    sortDir === "asc" ? `Ordenando por ${label}, ascendente`
    : sortDir === "desc" ? `Ordenando por ${label}, descendente`
    : `Ordenar por ${label}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5",
        // Lifted while it travels, so the row being moved is never confused
        // with the ones it is passing over.
        isDragging && "relative z-10 rounded-md bg-accent shadow-md",
      )}
    >
      {/*
        The handle, and the only thing that starts a drag: the row holds a text
        box you have to be able to select inside, so making the whole row
        draggable would fight every rename.

        `listeners` also carry the keyboard: focus this and press space, then
        the arrow keys, then space again. That is not a nicety — it replaced the
        two ↑↓ buttons that used to live here, and without it a keyboard has no
        way to reorder anything at all.
      */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${label}`}
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVerticalIcon className="h-3.5 w-3.5" />
      </button>

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
            {/*
              One string for both, like the sort button in this same row. The
              tooltip used to state a status ("Agrupando por esta columna")
              while the accessible name offered the inverse action ("Dejar de
              agrupar por X"): in the pressed state the two said opposite
              things, and a sighted person and a screen-reader user could not
              talk about the same control.
            */}
            {isGrouped ? `Dejar de agrupar por ${label}` : `Agrupar por ${label}`}
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
  /** Both ends named by `columnKey`, never by position: position is what moves. */
  onReorder: (from: string, to: string) => void;
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
  config, root, onReorder, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: Props) => {
  /**
   * Pointer and keyboard, both wired.
   *
   * The keyboard one is not optional politeness: it replaced the two ↑↓ buttons
   * that used to sit in every row, and they were the only way to reorder
   * without a mouse. Focus the handle, press space, move with the arrows, press
   * space again.
   *
   * The pointer sensor waits for 6 pixels of travel before it calls something a
   * drag, so a plain click on the handle is still a click and not a jerk of the
   * list.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // `over` is null when the drop lands outside the list, and equal to
    // `active` when the row was picked up and put back. Neither is a move.
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

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

  const ids = config.columns.map(columnKey);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // A column list only moves up and down, and only within itself: without
      // these a row can be dragged out over the rest of the page, which reads
      // as a bug in a panel that is now one of four side by side.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="divide-y rounded-md border">
      {config.columns.map((column, index) => {
        const field = findField(root, column.path);
        const isAggregateOnly = root?.aggregateOnly.some((a) => column.path === a.path) ?? false;
        const relation = root?.aggregateOnly.find((a) => column.path === a.path);
        const label = fieldLabel(root, column.path);
        const group = field?.group ?? relation?.group ?? "Resumen";

        return (
          <ColumnRow
            // Keyed by identity, not position: keying by index remounted every
            // row on a move and threw keyboard focus back to the document.
            //
            // The renamed header is part of that identity. Two columns of the
            // same field kept apart only by their header survive grouping —
            // rightly, someone put them both there — and without the label in
            // the key they arrived as two children with one key, which leaves
            // reconciliation undefined: an edit lands on the wrong twin, or
            // focus jumps out of the box being typed in.
            key={ids[index]}
            id={ids[index]}
            column={column}
            index={index}
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
      </SortableContext>
    </DndContext>
  );
};

export default ColumnList;
