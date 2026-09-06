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
import { Label } from "../../../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { AGG_LABEL, columnKeys, fieldLabel, findField, isSummary } from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";

interface ChipProps {
  column: ColumnSpec;
  index: number;
  label: string;
  group: string;
  available: AggFn[];
  isAggregateOnly: boolean;
  canGroup: boolean;
  isGrouped: boolean;
  sortDir: "asc" | "desc" | undefined;
  /** Identity that survives a reorder and a rename; see `columnKeys`. */
  id: string;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onSetAgg: (index: number, agg?: AggFn) => void;
  onToggleGroup: (index: number) => void;
  onToggleSort: (path: string, agg?: AggFn) => void;
}

/**
 * One column, as a pill.
 *
 * It was a full-width row carrying a text box, a select and three icon buttons,
 * on two lines because that stopped fitting the panel's width. Sixty columns
 * were a hundred and twenty lines of scrolling, and what each one *was* — how
 * it is summarised, whether it groups, whether it sorts — could only be learned
 * by reading every row.
 *
 * As pills, stacked one per line, sixty columns are sixty lines instead of a
 * hundred and twenty, and each one reads at a glance: a pill carries its
 * header, its summary, and the grouping and sorting marks. Everything that
 * edits sits in a popover behind it. The one thing that costs is renaming by
 * typing straight into the list — now a press and then typing, which is the
 * trade for a list that can be taken in at all.
 *
 * One per line rather than wrapped into a cloud, because this order is the
 * order of the columns in the file: down a column it is unarguable, and across
 * wrapped rows somebody has to work out where the reading resumes.
 *
 * Memoised because the parent re-renders on every keystroke of any rename or
 * filter value, and sixty of these re-reconciling with their selects on each
 * was measured at over half a second per keypress.
 */
const ColumnChip = memo(function ColumnChip({
  column, index, label, group, available, isAggregateOnly, canGroup, isGrouped, sortDir,
  id, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: ChipProps) {
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
        "flex max-w-full items-center gap-0.5 rounded-full border py-0.5 pr-0.5 pl-1",
        // A grouped column is a different kind of thing — it defines the rows
        // rather than describing them — and in a wrapped cloud that has to show
        // without anything being opened.
        isGrouped ? "border-primary/40 bg-primary/10" : "bg-background",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      {/*
        The handle, and the only thing that starts a drag. The pill's body opens
        a popover, so a draggable pill would fight every press.

        `listeners` also carry the keyboard: focus this, press space, move with
        the arrows, press space again. Without it a keyboard cannot reorder
        anything at all.
      */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${label}`}
        className="shrink-0 cursor-grab touch-none rounded-full text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVerticalIcon className="h-3.5 w-3.5" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Ajustes de ${label}`}
            className="flex min-w-0 items-center gap-1 rounded-full px-1 py-0.5 text-sm hover:bg-accent/60"
          >
            <span className="truncate">{column.label || label}</span>

            {/* What a pill has to say without being opened: how it is
                summarised, and whether it groups or sorts. */}
            {column.agg && (
              <span className="shrink-0 text-xs text-muted-foreground">
                · {AGG_LABEL[column.agg]}
              </span>
            )}
            {isGrouped && <LayersIcon className="h-3 w-3 shrink-0 text-primary" />}
            {sortDir === "asc" && <ArrowUpNarrowWideIcon className="h-3 w-3 shrink-0" />}
            {sortDir === "desc" && <ArrowDownNarrowWideIcon className="h-3 w-3 shrink-0" />}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`col-name-${id}`} className="text-xs">Cabecera</Label>
            <Input
              id={`col-name-${id}`}
              value={column.label ?? ""}
              placeholder={label}
              aria-label={`Nombre de la columna ${label}`}
              onChange={(e) => onRename(index, e.target.value)}
              maxLength={120}
              className="h-8"
            />
            {/* Where the field comes from. It used to sit under the box in the
                list, which was a line of height per column for something read
                once, when two fields of the same name have to be told apart. */}
            <p className="truncate text-xs text-muted-foreground">{group}</p>
          </div>

          {available.length > 0 && !isGrouped && (
            <div className="space-y-1.5">
              <Label className="text-xs">Resumen</Label>
              <Select
                value={column.agg ?? "none"}
                onValueChange={(v) => onSetAgg(index, v === "none" ? undefined : (v as AggFn))}
              >
                <SelectTrigger className="h-8 text-xs" aria-label={`Resumen de ${label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!isAggregateOnly && <SelectItem value="none">Sin resumen</SelectItem>}
                  {available.map((agg) => (
                    <SelectItem key={agg} value={agg}>{AGG_LABEL[agg]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            {canGroup && (
              <Button
                variant={isGrouped ? "default" : "outline"}
                size="sm"
                className="h-8 flex-1 text-xs"
                aria-label={isGrouped ? `Dejar de agrupar por ${label}` : `Agrupar por ${label}`}
                aria-pressed={isGrouped}
                onClick={() => onToggleGroup(index)}
              >
                <LayersIcon className="mr-1 h-3.5 w-3.5" />
                {isGrouped ? "Agrupando" : "Agrupar"}
              </Button>
            )}
            <Button
              variant={sortDir ? "secondary" : "outline"}
              size="sm"
              className="h-8 flex-1 text-xs"
              aria-label={sortLabel}
              // The aggregate travels with the path. Without it the server
              // refuses every sort in a grouped report — a column that is not
              // grouped has to say how it is summarised — and two pills of the
              // same field could not be sorted apart.
              onClick={() => onToggleSort(column.path, column.agg)}
            >
              {sortDir === "asc" ? <ArrowUpNarrowWideIcon className="mr-1 h-3.5 w-3.5" />
                : sortDir === "desc" ? <ArrowDownNarrowWideIcon className="mr-1 h-3.5 w-3.5" />
                : <ArrowUpDownIcon className="mr-1 h-3.5 w-3.5" />}
              {sortDir === "asc" ? "Ascendente" : sortDir === "desc" ? "Descendente" : "Ordenar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
        aria-label={`Quitar ${label}`}
        onClick={() => onRemove(index)}
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </li>
  );
});

interface Props {
  config: ReportConfig;
  root: CatalogRoot | undefined;
  /** Both ends named by `columnKeys`, never by position: position is what moves. */
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
 * Grouping and sorting are set from the column itself rather than a separate
 * panel: both decisions belong to the column they describe, and it keeps the
 * two lists from drifting apart.
 */
const ColumnList = ({
  config, root, onReorder, onRemove, onRename, onSetAgg, onToggleGroup, onToggleSort,
}: Props) => {
  /**
   * Pointer and keyboard, both wired.
   *
   * The keyboard one is not optional politeness: it replaced two ↑↓ buttons
   * that used to sit in every row, and they were the only way to reorder
   * without a mouse.
   *
   * The pointer sensor waits for six pixels of travel before calling something
   * a drag, so a press on the handle is still a press and not a jerk of the
   * cloud.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // `over` is null when the drop lands outside, and equal to `active` when a
    // pill was picked up and put back. Neither is a move.
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  const summary = isSummary(config);
  const grouped = new Set(config.groupBy ?? []);
  // Keyed by column, not by field: the minimum and the maximum of the same date
  // are two columns, and keyed by path alone one arrow lit both of them while
  // only one could ever be sorted.
  const sortKey = (path: string, agg?: AggFn) => `${path}|${agg ?? ""}`;
  const sortByColumn = new Map((config.sort ?? []).map((s) => [sortKey(s.path, s.agg), s.dir]));

  if (config.columns.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Sin columnas todavía. Añada la primera para empezar.
      </p>
    );
  }

  const ids = columnKeys(config);

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        // Up and down, and only within itself: the pills are stacked, so a drag
        // that wanders sideways or out over the rest of the page reads as a bug.
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {/* `items-start` so a pill is as wide as what it says: stretched to
              the panel they stop reading as pills and go back to being rows. */}
          <ul className="flex flex-col items-start gap-1.5">
            {config.columns.map((column, index) => {
              const field = findField(root, column.path);
              const isAggregateOnly = root?.aggregateOnly.some((a) => column.path === a.path) ?? false;
              const relation = root?.aggregateOnly.find((a) => column.path === a.path);
              const label = fieldLabel(root, column.path);
              const group = field?.group ?? relation?.group ?? "Resumen";

              return (
                <ColumnChip
                  // Keyed by identity, not position: keying by index rebuilt
                  // every pill on a move and threw keyboard focus back to the
                  // document. The header is not part of that identity, and that
                  // is what makes typing in the rename box possible at all.
                  key={ids[index]}
                  id={ids[index]}
                  column={column}
                  index={index}
                  label={label}
                  group={group}
                  // A to-many relation can only be counted: the server needs a
                  // field for any other aggregate, and there is no way to pick
                  // one here.
                  available={isAggregateOnly ? ["count"] : field?.aggregates ?? []}
                  isAggregateOnly={isAggregateOnly}
                  // A count cannot define groups; the server rejects it, and the
                  // catalog says which fields are already summaries.
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
          </ul>
        </SortableContext>
      </DndContext>

      {summary && (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Reporte agrupado: cada columna no agrupada necesita un resumen.
        </p>
      )}
    </div>
  );
};

export default ColumnList;
