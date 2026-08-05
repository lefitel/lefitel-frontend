import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, PlusIcon, SearchIcon, SigmaIcon } from "lucide-react";
import type { CatalogField, CatalogRoot } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { cn } from "../../../lib/utils";

/** One selectable entry, field or aggregate, flattened for keyboard traversal. */
interface Entry {
  id: string;
  kind: "field" | "aggregate";
  group: string;
  label: string;
  hint?: string;
  chosen: boolean;
  field?: CatalogField;
  path?: string;
  relationLabel?: string;
}

interface Props {
  root: CatalogRoot | undefined;
  /** Paths already in the report, shown as chosen. */
  chosen: Set<string>;
  onPick: (field: CatalogField) => void;
  /** Aggregate-only relations such as "revisiones", offered separately. */
  onPickAggregate?: (path: string, label: string) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Field chooser.
 *
 * The catalog holds hundreds of paths across four roots, so search comes first
 * and entries are grouped by where they come from ("Evento › Poste › Ciudad A")
 * rather than by table. The list is a real listbox: typing and pressing Enter
 * picks the first match, which is how anyone expects a search box to behave.
 */
const FieldPicker = ({
  root, chosen, onPick, onPickAggregate, label = "Añadir columna", disabled,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    if (!root) return [];
    const needle = query.trim().toLowerCase();
    const matches = (...text: string[]) =>
      needle === "" || text.some((t) => t.toLowerCase().includes(needle));

    const fields: Entry[] = root.fields
      .filter((f) => matches(f.label, f.group))
      .map((f) => ({
        id: `f:${f.path}`,
        kind: "field",
        group: f.group,
        label: f.label,
        hint: f.calculated ? "calculado" : undefined,
        chosen: chosen.has(f.path),
        field: f,
      }));

    // Two relations can share a label ("Revisiones" reached directly and through
    // another entity), so the group has to be shown or they are indistinguishable.
    const aggregates: Entry[] = onPickAggregate
      ? root.aggregateOnly
          .filter((a) => matches(a.label, a.group))
          .map((a) => ({
            id: `a:${a.path}`,
            kind: "aggregate",
            group: a.group,
            label: `Nº de ${a.label.toLowerCase()}`,
            chosen: chosen.has(a.path),
            path: a.path,
            relationLabel: a.label,
          }))
      : [];

    return [...fields, ...aggregates];
  }, [root, query, chosen, onPickAggregate]);

  useEffect(() => { setActive(0); }, [query]);

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    if (entry.kind === "field" && entry.field) onPick(entry.field);
    if (entry.kind === "aggregate" && entry.path) {
      onPickAggregate?.(entry.path, entry.relationLabel ?? entry.label);
    }
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (entries.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % entries.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + entries.length) % entries.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(entries[active]);
    }
  };

  // Keep the highlighted entry in view while arrowing through a long catalog.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Rendered flat but visually grouped: a header appears when the group changes.
  let lastGroup: string | null = null;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !root}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="field-picker-list"
            aria-activedescendant={entries[active] ? `opt-${entries[active].id}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar campo…"
            aria-label="Buscar campo"
            className="h-8 border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>

        <div
          ref={listRef}
          id="field-picker-list"
          role="listbox"
          aria-label="Campos disponibles"
          className="max-h-80 overflow-y-auto py-1"
        >
          {entries.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ningún campo coincide con «{query}»
            </p>
          )}

          {entries.map((entry, index) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            return (
              <div key={entry.id}>
                {header && (
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {header}
                  </p>
                )}
                <div
                  id={`opt-${entry.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  tabIndex={-1}
                  onClick={() => choose(entry)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                    index === active && "bg-accent",
                    entry.chosen && "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {entry.kind === "aggregate" && (
                      <SigmaIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{entry.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {entry.hint && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {entry.hint}
                      </span>
                    )}
                    {/* Already added: the button still works, adding it again is
                        simply a no-op, so say so rather than appear broken. */}
                    {entry.chosen && <CheckIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FieldPicker;
