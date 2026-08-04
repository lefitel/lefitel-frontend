import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon, SigmaIcon } from "lucide-react";
import type { CatalogField, CatalogRoot } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { cn } from "../../../lib/utils";

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
 * Field chooser. The catalog can hold hundreds of paths across four roots, so
 * search comes first and the grouping mirrors how the user thinks about the
 * data ("Evento › Poste › Ciudad A") rather than the underlying tables.
 */
const FieldPicker = ({
  root,
  chosen,
  onPick,
  onPickAggregate,
  label = "Añadir columna",
  disabled,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    if (!root) return [];
    const needle = query.trim().toLowerCase();
    const matches = (f: CatalogField) =>
      needle === "" ||
      f.label.toLowerCase().includes(needle) ||
      f.group.toLowerCase().includes(needle);

    const byGroup = new Map<string, CatalogField[]>();
    for (const field of root.fields) {
      if (!matches(field)) continue;
      const list = byGroup.get(field.group) ?? [];
      list.push(field);
      byGroup.set(field.group, list);
    }
    return [...byGroup.entries()];
  }, [root, query]);

  const aggregates = useMemo(() => {
    if (!root || !onPickAggregate) return [];
    const needle = query.trim().toLowerCase();
    return root.aggregateOnly.filter(
      (a) => needle === "" || a.label.toLowerCase().includes(needle),
    );
  }, [root, query, onPickAggregate]);

  const empty = groups.length === 0 && aggregates.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar campo…"
            aria-label="Buscar campo"
            className="h-8 border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {empty && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ningún campo coincide con «{query}»
            </p>
          )}

          {groups.map(([group, fields]) => (
            <div key={group} className="pb-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {fields.map((field) => {
                const already = chosen.has(field.path);
                return (
                  <button
                    key={field.path}
                    type="button"
                    onClick={() => { onPick(field); setOpen(false); setQuery(""); }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                      "hover:bg-accent focus:bg-accent focus:outline-none",
                      already && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{field.label}</span>
                    {field.calculated && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        calculado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {aggregates.length > 0 && (
            <div className="border-t pt-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Resúmenes
              </p>
              {aggregates.map((a) => (
                <button
                  key={a.path}
                  type="button"
                  onClick={() => { onPickAggregate?.(a.path, a.label); setOpen(false); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <SigmaIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">Nº de {a.label.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FieldPicker;
