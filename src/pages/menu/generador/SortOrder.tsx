// The order the report is sorted in, when more than one column sorts.
//
// The priority existed from the start and decided the result — the server
// writes `ORDER BY` straight from this list, so the first entry decides and the
// rest break its ties — and nothing on screen said so. A column pill showed an
// arrow, the table header showed an arrow, and with two columns sorted there
// was no way to tell which one won, nor to change it without switching every
// sort off and back on in the sequence you wanted.
//
// It appears only with two criteria or more. With one there is no priority to
// read and no ambiguity to resolve, and a strip explaining a decision nobody
// has to make is one more thing to skip past.
//
// Left to right rather than stacked, unlike the columns above it: this is a
// sequence of ranks, and first-then-second reads across a line the way it reads
// in a sentence.

import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownNarrowWideIcon, ArrowUpNarrowWideIcon, GripVerticalIcon, XIcon,
} from "lucide-react";
import type { CatalogRoot, ReportConfig, SortSpec } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { AGG_LABEL, fieldLabel, sortKey } from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";

interface CriterionProps {
  sort: SortSpec;
  rank: number;
  label: string;
  onFlip: (key: string) => void;
  onRemove: (key: string) => void;
}

const Criterion = ({ sort, rank, label, onFlip, onRemove }: CriterionProps) => {
  const id = sortKey(sort);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const dirLabel = sort.dir === "asc" ? "ascendente" : "descendente";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-md border bg-background py-0.5 pr-0.5 pl-1 text-xs",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${label} en el orden`}
        // Bigger than it was, and still smaller than the one on a column: these
        // chips are a third the height, and a handle that dominates its chip is
        // the same mistake in the other direction.
        className="flex h-5 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>

      {/* The rank, which is the whole point of this strip. Not a control: the
          position is changed by dragging, and a number that is sometimes a
          button and sometimes a label is worse than a number. */}
      <span className="shrink-0 font-medium tabular-nums text-muted-foreground">{rank}.</span>
      <span className="truncate">{label}</span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-md"
            // Flips, and cannot delete. The button on the column itself cycles
            // ascending, descending, off — which is what a table header does —
            // and that cycle is wrong here: turning a criterion around should
            // not be able to remove it from a list of criteria.
            aria-label={`Cambiar ${label} a ${sort.dir === "asc" ? "descendente" : "ascendente"}`}
            onClick={() => onFlip(id)}
          >
            {sort.dir === "asc"
              ? <ArrowUpNarrowWideIcon className="h-3 w-3" />
              : <ArrowDownNarrowWideIcon className="h-3 w-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ordenando {dirLabel}. Púlselo para invertirlo.</TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
        aria-label={`Dejar de ordenar por ${label}`}
        onClick={() => onRemove(id)}
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </li>
  );
};

interface Props {
  config: ReportConfig;
  root: CatalogRoot | undefined;
  /** Both ends named by `sortKey`, never by position: position is what moves. */
  onReorder: (from: string, to: string) => void;
  onFlip: (key: string) => void;
  onRemove: (key: string) => void;
}

const SortOrder = ({ config, root, onReorder, onFlip, onRemove }: Props) => {
  const sorts = config.sort ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Nothing to say with one criterion: it wins by being alone.
  if (sorts.length < 2) return null;

  const ids = sorts.map(sortKey);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <div className="space-y-1.5 rounded-md bg-muted/40 px-2 py-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Orden del reporte.</span>{" "}
        La primera manda; las siguientes deshacen sus empates. Arrástrelas para cambiarlo.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className="flex flex-wrap gap-1.5">
            {sorts.map((sort, index) => (
              <Criterion
                key={ids[index]}
                sort={sort}
                rank={index + 1}
                // The aggregate is part of the name here, because two criteria
                // can be the same field summarised two ways — the minimum and
                // the maximum of one date — and "Fecha" twice is unreadable.
                label={sort.agg
                  ? `${fieldLabel(root, sort.path)} (${AGG_LABEL[sort.agg].toLowerCase()})`
                  : fieldLabel(root, sort.path)}
                onFlip={onFlip}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SortOrder;
