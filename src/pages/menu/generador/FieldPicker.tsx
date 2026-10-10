import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronRightIcon, PlusIcon, SearchIcon, SigmaIcon } from "lucide-react";
import type { CatalogField, CatalogRoot } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { cn } from "../../../lib/utils";
import { flatControl } from "../../../components/ui/control-surface";

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

/** The entries that share an origin, shown under one foldable header. */
interface Section {
  group: string;
  /** The header text: the group without the root every group starts with. */
  title: string;
  entries: Entry[];
}

interface Props {
  root: CatalogRoot | undefined;
  /**
   * Paths already used, shown with a tick: the report's columns in one picker,
   * the fields that already carry a filter in the other.
   */
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
 *
 * Each group folds. An event report has sixteen of them and the list shows
 * about nine rows, so laid out flat the fields of "Solución" sat some fifty rows
 * down. Only the root's own group starts open; searching unfolds everything,
 * because a match hidden inside a folded group is a search that found nothing.
 */
const FieldPicker = ({
  root, chosen, onPick, onPickAggregate, label = "Añadir columna", disabled,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // By id, not by position: folding a group moves every position after it.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Groups flipped away from their default, keyed by root as well: the picker
  // outlives a change of detail level, and "Evento › Poste" is not "Poste".
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const searching = query.trim() !== "";

  const sections = useMemo<Section[]>(() => {
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
            // "Contar", not "Nº de": the catalog already has calculated fields
            // labelled "Nº de revisiones" and "Nº de observaciones" sitting in
            // the very same group of the very same root, so two entries had the
            // identical visible text and behaved differently — one can never be
            // grouped, the other can only ever be a count. A verb reads as what
            // this entry is: a summary you are adding, not a field that holds a
            // number.
            label: `Contar ${a.label.toLowerCase()}`,
            chosen: chosen.has(a.path),
            path: a.path,
            relationLabel: a.label,
          }))
      : [];

    // Gathered by group rather than left in catalog order: the counts come
    // after every field, so "Contar revisiones" used to trail the list under a
    // second "Evento" header instead of sitting with the event's own fields.
    const byGroup = new Map<string, Entry[]>();
    for (const entry of [...fields, ...aggregates]) {
      const list = byGroup.get(entry.group);
      if (list) list.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    // Every group below the root repeats its label, and at four levels deep
    // that prefix is what pushes the part that tells groups apart off the edge.
    const prefix = `${root.label} › `;
    return [...byGroup].map(([group, entries]) => ({
      group,
      title: group.startsWith(prefix) ? group.slice(prefix.length) : group,
      entries,
    }));
  }, [root, query, chosen, onPickAggregate]);

  // The root's own fields are listed first and are what most reports are made
  // of, so that group alone starts open.
  const openByDefault = root?.fields[0]?.group;
  const toggleKey = (group: string) => `${root?.key}\n${group}`;
  const isOpen = (group: string) =>
    searching || (group === openByDefault) !== toggled.has(toggleKey(group));

  // What the arrow keys walk: the entries on screen, and only those.
  const entries = sections.flatMap((section) => (isOpen(section.group) ? section.entries : []));
  // An id that is no longer on screen falls back to the first entry.
  const active = Math.max(0, entries.findIndex((entry) => entry.id === activeId));

  useEffect(() => { setActiveId(null); }, [query]);

  const toggle = (section: Section) => {
    const opening = !isOpen(section.group);
    setToggled((current) => {
      const next = new Set(current);
      const key = toggleKey(section.group);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    // Land on the group just opened, and hand the keyboard back to the search
    // box: the click took focus, and the arrow keys only work from there.
    setActiveId(opening ? (section.entries[0]?.id ?? null) : null);
    searchRef.current?.focus();
  };

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
      setActiveId(entries[(active + 1) % entries.length].id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveId(entries[(active - 1 + entries.length) % entries.length].id);
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
  }, [active, activeId]);

  // Positions run across sections, matching `entries`.
  let index = -1;

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
            ref={searchRef}
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
            className={cn(flatControl, "h-8 px-0 focus-visible:ring-0")}
          />
        </div>

        <div
          ref={listRef}
          id="field-picker-list"
          role="listbox"
          aria-label="Campos disponibles"
          className="max-h-80 overflow-y-auto py-1"
        >
          {sections.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ningún campo coincide con «{query}»
            </p>
          )}

          {sections.map((section) => {
            const expanded = isOpen(section.group);
            return (
              <div key={section.group}>
                {searching ? (
                  // Nothing to fold while searching: every match is in view.
                  <p
                    title={section.group}
                    className="truncate px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {section.title}
                  </p>
                ) : (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    title={section.group}
                    onClick={() => toggle(section)}
                    className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
                  >
                    <ChevronRightIcon
                      className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
                    />
                    <span className="min-w-0 flex-1 truncate">{section.title}</span>
                    <span className="shrink-0 font-normal tabular-nums">
                      {section.entries.length}
                      <span className="sr-only"> campos</span>
                    </span>
                  </button>
                )}
                {expanded && section.entries.map((entry) => {
                  index += 1;
                  const position = index;
                  return (
                    <div
                      key={entry.id}
                      id={`opt-${entry.id}`}
                      role="option"
                      aria-selected={position === active}
                      data-index={position}
                      tabIndex={-1}
                      onClick={() => choose(entry)}
                      onMouseEnter={() => setActiveId(entry.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-2 py-1.5 pr-3 text-left text-sm",
                        // Under the header's text, past its chevron — but only
                        // when there is a chevron to clear.
                        searching ? "pl-3" : "pl-8",
                        position === active && "bg-accent",
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
                        {/* Already used, and still pickable: a column is refused
                            with a message, a field takes a second filter. The
                            tick says which ones, rather than leave it to be
                            found out by pressing. */}
                        {entry.chosen && <CheckIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/*
          The Σ already tells the two kinds of entry apart, and "Contar" reads
          as a verb rather than as a field. What neither says is *what* they
          are, which is the thing people ask about: "Nº de revisiones" is a
          number that sits in no table and exists only while the report runs.
          Shown only when one is on the list, so the picker does not carry an
          explanation of something not in front of the reader.
        */}
        {entries.some((entry) => entry.kind === "aggregate") && (
          <p className="flex items-start gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
            <SigmaIcon className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Los «Contar…» no son un dato guardado: se cuentan al generar el reporte.</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FieldPicker;
