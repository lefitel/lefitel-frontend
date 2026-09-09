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
import { AGG_LABEL, columnKeys, fieldLabel, findField, isSummary } from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";
import { flatControl } from "../../../components/ui/control-surface";

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
  /**
   * Where this column sits in the report's tie-breaking order, 1-based, and
   * only when more than one column sorts. With a single criterion there is no
   * priority to read: it wins by being alone.
   */
  sortRank: number | undefined;
  /** Identity that survives a reorder and a rename; see `columnKeys`. */
  id: string;
  onRemove: (index: number) => void;
  onRename: (index: number, label: string) => void;
  onSetAgg: (index: number, agg?: AggFn) => void;
  onToggleGroup: (index: number) => void;
  onToggleSort: (path: string, agg?: AggFn) => void;
}

/**
 * One column, as a pill that carries everything that acts on it.
 *
 * The controls were behind a press for a while, because the panel was a quarter
 * of the configuration band and a row had around 260 pixels to fit a text box,
 * a select and three buttons into. The band is two panels wide now, so a pill
 * has around 640 and they all fit on one line — and a control you can see and
 * reach beats a control one press away, every time.
 *
 * The two that act rather than describe — order and group — are icons alone,
 * with the tooltip carrying what they do. They spelt themselves out in words
 * until the row had a select in it too and the whole pill read as a sentence
 * nobody was reading.
 *
 * Memoised because the parent re-renders on every keystroke of any rename or
 * filter value, and sixty of these re-reconciling with their selects on each
 * was measured at over half a second per keypress.
 */
const ColumnChip = memo(function ColumnChip({
  column, index, label, group, available, isAggregateOnly, canGroup, isGrouped, sortDir, sortRank,
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
        // Eight pixels, not four. The origin line sits at the top of the pill,
        // and `leading-tight` on eleven-pixel text leaves almost no room above
        // the glyphs themselves — so four pixels of padding read as none. The
        // right side was on two, which put the remove button against the
        // border.
        "flex w-full items-center gap-1 rounded-lg border py-2 pr-1 pl-2",
        // A grouped column is a different kind of thing — it defines the rows
        // rather than describing them — and that shows on the pill itself, not
        // only on the button that set it.
        //
        // Ungrouped it paints nothing, which is how the filter rows beside it
        // have always looked: they are one bordered box with hairlines between
        // them and no fill of their own. `bg-background` was a second tone on
        // top of the card — 0.976 against white in the light theme, 0.215
        // against 0.288 in the dark one — so the two lists read as two
        // materials for no reason anybody could name.
        isGrouped ? "border-primary/40 bg-primary/10" : "bg-transparent",
        // Except while it is being dragged: dnd-kit translates the pill over
        // its neighbours, and a transparent one would show them straight
        // through the thing you are holding.
        isDragging && "relative z-10 bg-card shadow-md",
      )}
    >
      {/*
        The handle, and the only thing that starts a drag: the pill holds a text
        box you have to be able to select inside, so a draggable pill would
        fight every rename.

        `listeners` also carry the keyboard: focus this, press space, move with
        the arrows, press space again. Without it a keyboard cannot reorder
        anything at all.
      */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${label}`}
        // A real target, not just an icon: this is the whole of the reorder for
        // a pointer, it is what a finger goes for on a touch screen, and at
        // fourteen pixels inside a pill twice that tall it read as decoration.
        className="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVerticalIcon className="h-5 w-5" />
      </button>

      {/* `gap-1`: with the two stacked and nothing between them the origin
          read as part of the box below it rather than as a label over it. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/*
          Where the field comes from, above the header rather than beside it.
          It is the only thing in the pill that is not a control, and in the
          row it sat between the header box and the summary select, reading as
          another value somebody had set. Above it, it labels what it belongs
          to — which is also what it is for: telling two fields of the same
          name apart.
        */}
        <span className="truncate px-2 text-[11px] leading-tight text-muted-foreground">
          {group}
        </span>
        <Input
          value={column.label ?? ""}
          placeholder={label}
          aria-label={`Nombre de la columna ${label}`}
          onChange={(e) => onRename(index, e.target.value)}
          maxLength={120}
          className={cn(flatControl, "h-6 min-w-0 rounded-md px-2 focus-visible:ring-1")}
        />
      </div>

      {available.length > 0 && !isGrouped && (
        <Select
          value={column.agg ?? "none"}
          onValueChange={(v) => onSetAgg(index, v === "none" ? undefined : (v as AggFn))}
        >
          <SelectTrigger
            className="h-7 w-28 shrink-0 rounded-md text-xs"
            aria-label={`Resumen de ${label}`}
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={sortDir ? "secondary" : "ghost"}
            size="sm"
            // `min-w-7` and not `w-7`: the rank widens it by a digit when there
            // is one, and a fixed square would crop it.
            className="h-7 min-w-7 shrink-0 gap-0.5 rounded-md px-1 text-xs"
            aria-label={sortLabel}
            // The aggregate travels with the path. Without it the server
            // refuses every sort in a grouped report — a column that is not
            // grouped has to say how it is summarised — and two pills of the
            // same field could not be sorted apart.
            onClick={() => onToggleSort(column.path, column.agg)}
          >
            {sortDir === "asc" ? <ArrowUpNarrowWideIcon className="h-3.5 w-3.5" />
              : sortDir === "desc" ? <ArrowDownNarrowWideIcon className="h-3.5 w-3.5" />
              : <ArrowUpDownIcon className="h-3.5 w-3.5" />}
            {/*
              The number stays when the word goes: it is the report's
              tie-breaking order, it only appears when there is more than one
              criterion to rank, and it decided the result from the first day
              while being written down nowhere. The strip below says the same
              thing at more length; this is the half you can see without
              looking away from the column.

              It is not a label — the arrow already says "order", and the state
              is in the arrow's direction and the button's fill. Losing the word
              costs the person who read the arrow as a filter, which is why
              every one of these carries a tooltip and an accessible name that
              spell the whole thing out.
            */}
            {sortRank && <span className="tabular-nums">{sortRank}</span>}
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
              className="h-7 w-7 shrink-0 rounded-md"
              aria-label={isGrouped ? `Dejar de agrupar por ${label}` : `Agrupar por ${label}`}
              aria-pressed={isGrouped}
              onClick={() => onToggleGroup(index)}
            >
              <LayersIcon className={cn("h-3.5 w-3.5", isGrouped && "text-primary-foreground")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {/*
              One string for both, like the sort button in this same pill. The
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
        className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
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
 * One pill per line rather than wrapped into a cloud, because this order is the
 * order of the columns in the exported file: down a column it is unarguable,
 * and across wrapped rows somebody has to work out where the reading resumes.
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
   * list.
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
  const columnSortKey = (path: string, agg?: AggFn) => `${path}|${agg ?? ""}`;
  const sorts = config.sort ?? [];
  const sortByColumn = new Map(sorts.map((s) => [columnSortKey(s.path, s.agg), s.dir]));
  // Ranks only once there is a tie to break. With one criterion the number
  // would be a "1" that never becomes anything else.
  const rankByColumn = new Map(
    sorts.length > 1 ? sorts.map((s, i) => [columnSortKey(s.path, s.agg), i + 1]) : [],
  );

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
          <ul className="flex flex-col gap-1.5">
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
                  sortDir={sortByColumn.get(columnSortKey(column.path, column.agg))}
                  sortRank={rankByColumn.get(columnSortKey(column.path, column.agg))}
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
