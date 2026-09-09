import { memo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import type {
  CatalogField, CatalogRoot, FilterCondition, Operator, ReportConfig,
} from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Combobox, type ComboboxOption } from "../../../components/ui/combobox";
import { chooserTrigger } from "../../../components/ui/control-surface";
import { DatePicker } from "../../../components/ui/date-picker";
import { DateRangePicker } from "../../../components/ui/date-range-picker";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  findField, isExists, isFilterGroup, operatorNeedsTwoValues, operatorNeedsValue,
} from "../../../lib/reportConfig";
import { cn } from "../../../lib/utils";

const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "es igual a",
  neq: "es distinto de",
  gt: "es mayor que",
  gte: "es mayor o igual que",
  lt: "es menor que",
  lte: "es menor o igual que",
  between: "está entre",
  in: "está en la lista",
  like: "contiene",
  isnull: "está vacío",
  notnull: "tiene valor",
};

interface Props {
  config: ReportConfig;
  root: CatalogRoot | undefined;
  /**
   * The value lists the server published, keyed by what a field's `optionList`
   * names. Absent against an older server, and a field may name a list that is
   * not in here — see `CatalogField.optionList`. Both cases mean the same
   * thing on screen: the box the filter had before.
   */
  optionLists?: Record<string, string[]>;
  onUpdate: (index: number, patch: Partial<FilterCondition>) => void;
  onRemove: (index: number) => void;
  onSetJoin: (op: "and" | "or") => void;
}

/**
 * The offered values, plus whatever the configuration already holds if it is
 * not among them.
 *
 * A saved report can name an owner that has since been archived, and the list
 * only carries the live ones. Dropping the stored value would leave the box
 * reading "Elija un valor" over a filter that is set and running — the screen
 * saying the opposite of what the report does. So it stays, named as what it
 * is, and can be replaced or unpicked like any other.
 */
const withCurrent = (options: string[], current: string): ComboboxOption[] => {
  const list = options.map((v) => ({ value: v, label: v }));
  if (current !== "" && !options.includes(current)) {
    list.unshift({ value: current, label: `${current} (ya no está en la lista)` });
  }
  return list;
};

/**
 * The two directions a date travels between the calendar and the report.
 *
 * The wire format is a plain "yyyy-MM-dd" — what the browser's own date box
 * used to write and what the server reads — and both of these stay in local
 * time on purpose. Building the Date with `new Date("2026-03-15")` lands on
 * UTC midnight, which is the day before for anybody west of Greenwich: every
 * open of the calendar would walk the filter one day back.
 */
const asDay = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || value === "") return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

const asIsoDay = (date: Date | undefined): string | undefined =>
  date ? format(date, "yyyy-MM-dd") : undefined;

/**
 * The pair the configuration holds, as the range picker wants it.
 *
 * Undefined rather than an empty range when neither end is set, so the trigger
 * shows its placeholder instead of a dash between two blanks. Half a range is
 * passed through as it is: the calendar draws the one end that exists, and
 * `validateConfig` is what says the filter is not finished.
 */
const rangeValue = (pair: unknown[]): DateRange | undefined => {
  const from = asDay(pair[0]);
  const to = asDay(pair[1]);
  return from || to ? { from, to } : undefined;
};

/**
 * Input shaped by the field type.
 *
 * Numbers are kept as text while being edited rather than coerced on every
 * keystroke: `Number("-")` is NaN, which used to blank the field the moment
 * someone typed a minus sign, and then serialise to null in the request.
 * Validation flags a value that never becomes a number.
 */
const ValueInput = ({
  field, value, onChange, ariaLabel, options,
}: {
  field: CatalogField | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  ariaLabel: string;
  /** The closed list of values, when this field has one. */
  options?: string[];
}) => {
  // A list beats a box, and not for comfort: the comparison is exact, so a
  // lowercase "tigo" or one trailing space matches nothing, and an empty report
  // reads the same whether the filter is misspelled or the data really holds no
  // such row. Not letting the value be typed is what removes the question.
  if (options) {
    const current = typeof value === "string" ? value : "";
    return (
      <Combobox
        className="h-8 flex-1"
        ariaLabel={ariaLabel}
        placeholder="Elija un valor"
        searchPlaceholder="Buscar…"
        options={withCurrent(options, current)}
        value={current}
        onValueChange={onChange}
      />
    );
  }

  if (field?.kind === "boolean") {
    return (
      <Select
        value={value === true ? "true" : value === false ? "false" : ""}
        onValueChange={(v) => onChange(v === "true")}
      >
        <SelectTrigger className="h-8 flex-1" aria-label={ariaLabel}>
          <SelectValue placeholder="Elija" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Sí</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // The browser's own date box, which is a different control in every browser
  // — a spinner in one, three tiny boxes in another, and a calendar you cannot
  // reach without a mouse in a third — while six dialogs in this app already
  // open the same Spanish calendar with a year picker in it. There was no
  // reason for the filters to be the one place that did not.
  //
  // The wire format does not change: a plain "yyyy-MM-dd", which is what the
  // box wrote and what the server reads. `parseISO` and `format` are both
  // local-time here, so the round trip cannot move the day — building a Date
  // from that string with `new Date()` would put it at UTC midnight and hand
  // back the day before, for anybody west of Greenwich.
  if (field?.kind === "date") {
    return (
      <DatePicker
        className="h-8 flex-1"
        ariaLabel={ariaLabel}
        placeholder="Elija una fecha"
        value={asDay(value)}
        onSelect={(d) => onChange(asIsoDay(d))}
      />
    );
  }

  return (
    <Input
      type="text"
      inputMode={field?.kind === "number" ? "decimal" : "text"}
      aria-label={ariaLabel}
      className="h-8 flex-1"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
};

/** The list the configuration carries, from what the person typed. */
const toList = (text: string): string[] =>
  text.split(",").map((p) => p.trim()).filter((p) => p !== "");

/**
 * Comma-separated entry for "in", which needs a list and had no way to build one.
 *
 * The text is held here and the list is derived from it, rather than the other
 * way round. Deriving the text from the list ate the comma the moment it was
 * typed: an empty last segment is dropped from the list — correctly — so
 * "1," turned back into "1", React wrote that into the box, and the caret lost
 * the separator. Typing `poste,cable` produced the single value
 * `postecable`, the report came back empty, and the screen said no record
 * matched a filter the person never built. Only pasting worked.
 */
const ListInput = ({
  value, onChange, ariaLabel,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  ariaLabel: string;
}) => {
  const fromConfig = Array.isArray(value) ? value.join(", ") : "";
  const [text, setText] = useState(fromConfig);
  const [adopted, setAdopted] = useState(fromConfig);

  // A value that changed elsewhere — a saved report opened, the operator
  // switched — replaces what is in the box. Comparing against what was last
  // adopted, not against the current text, so this never fights the typing.
  //
  // And only when it disagrees with what the box already means. The
  // configuration is re-joined as "uno, dos", so deleting the last character of
  // the final value made the two strings differ and the box was rewritten from
  // the list — eating the separator with it: "uno, d" plus one backspace became
  // "uno", and the next keystroke merged two values into one. That is the same
  // failure this component was rewritten to remove, reached by editing rather
  // than by typing.
  if (fromConfig !== adopted && fromConfig !== toList(text).join(", ")) {
    setAdopted(fromConfig);
    setText(fromConfig);
  } else if (fromConfig !== adopted) {
    setAdopted(fromConfig);
  }

  return (
    <Input
      type="text"
      aria-label={ariaLabel}
      placeholder="Separe los valores con comas"
      className="h-8 flex-1"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(toList(e.target.value));
      }}
      // What is sent is what the person can see, tidied once they are done.
      onBlur={() => setText(toList(text).join(", "))}
    />
  );
};

/**
 * "Está en la lista", when the values are known.
 *
 * Nothing is typed and nothing is parsed, which is what makes it different from
 * the box above: both failures documented there — the comma eaten as it was
 * typed, and two values merged into one by a backspace — were failures of
 * turning text into a list. There is no text here.
 *
 * Behind a popover rather than laid out in the row: 98 cities is the largest of
 * these lists, and a filter row cannot be 98 lines tall.
 */
const ListPicker = ({
  options, value, onChange, ariaLabel,
}: {
  options: string[];
  value: unknown;
  onChange: (v: unknown) => void;
  ariaLabel: string;
}) => {
  const [q, setQ] = useState("");
  const chosen = Array.isArray(value) ? value.map(String) : [];
  // Stored values that are no longer offered come first and stay visible, so a
  // filter naming an archived owner can be seen and unpicked. Same reason as
  // `withCurrent` above.
  const all = [...chosen.filter((v) => !options.includes(v)), ...options];
  const needle = q.trim().toLowerCase();
  const shown = needle === "" ? all : all.filter((v) => v.toLowerCase().includes(needle));

  const toggle = (v: string) =>
    onChange(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);

  // The count and not the values once there is more than one: the trigger is
  // one line wide inside a filter row, and three truncated names read worse
  // than a number that is exact.
  const label = chosen.length === 0
    ? "Elija los valores"
    : chosen.length === 1 ? chosen[0] : `${chosen.length} valores`;

  return (
    <Popover onOpenChange={(open) => { if (open) setQ(""); }}>
      <PopoverTrigger
        aria-label={ariaLabel}
        // Third copy of the same skin, now shared: it opens a list to choose
        // from, exactly like the select beside it. See `chooserTrigger`.
        className={cn(
          chooserTrigger,
          "h-8 flex-1",
          chosen.length === 0 && "text-muted-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <div className="flex items-center border-b border-border px-3">
          <SearchIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            aria-label={`Buscar en ${ariaLabel.toLowerCase()}`}
            className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            shown.map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox checked={chosen.includes(v)} onCheckedChange={() => toggle(v)} />
                <span className="truncate">{v}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface RowProps {
  condition: FilterCondition;
  index: number;
  field: CatalogField | undefined;
  /**
   * The closed list of values for this field, when it has one.
   *
   * Read out of the catalog and handed down rather than looked up here, so the
   * reference is the same on every render — this row is memoised, and a fresh
   * array each time would defeat that on every keystroke anywhere in the panel.
   */
  options?: string[];
  onUpdate: (index: number, patch: Partial<FilterCondition>) => void;
  onRemove: (index: number) => void;
}

/** Memoised: the parent re-renders on every keystroke anywhere in the builder. */
const FilterRow = memo(function FilterRow({
  condition, index, field, options, onUpdate, onRemove,
}: RowProps) {
  const label = field?.label ?? condition.path;
  const operators = field?.operators ?? ["eq"];
  const range = operatorNeedsTwoValues(condition.operator);
  const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
  // Every operator a list field takes gets the list, except this one:
  // "contiene" searches for a fragment, so a whole value picked from a list is
  // the one thing you are not trying to type there.
  const listed = condition.operator === "like" ? undefined : options;

  return (
    <li className="space-y-1.5 px-2 py-2">
      {/*
        Which field this is about, and the way out of it. Nothing else: the
        title is a name, not a control, and the ✕ is the only thing here that
        undoes rather than adjusts.
      */}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label={`Quitar filtro sobre ${label}`}
          onClick={() => onRemove(index)}
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/*
        The condition itself, on one line, because it is one sentence: "es igual
        a" and what it is equal to. Split across two rows the comparison sat
        beside the field name and its value a line below, so the two halves that
        only mean anything together were the two furthest apart.
        `flex-wrap` and the minimum on the value keep that honest when there is
        no room — a range is two boxes and a "y" — by dropping the value to its
        own line rather than crushing it to nothing.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={condition.operator}
          onValueChange={(v) => onUpdate(index, { operator: v as Operator })}
        >
          <SelectTrigger
            className="h-8 w-44 shrink-0 text-xs"
            aria-label={`Operador para ${label}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>{OPERATOR_LABEL[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {operatorNeedsValue(condition.operator) && (
          <div className="flex min-w-48 flex-1 items-center gap-2">
            {condition.operator === "in" ? (
              listed ? (
                <ListPicker
                  options={listed}
                  value={condition.value}
                  ariaLabel={`Valores para ${label}`}
                  onChange={(v) => onUpdate(index, { value: v })}
                />
              ) : (
                <ListInput
                  value={condition.value}
                  ariaLabel={`Valores para ${label}`}
                  onChange={(v) => onUpdate(index, { value: v })}
                />
              )
            ) : range && field?.kind === "date" ? (
              /*
                One control for both ends, not two calendars side by side.
                Choosing a period is a single act — you look at a month and
                drag your eye from one day to another — and split in two it was
                two popovers, two months to navigate, and no moment where the
                span itself was on screen. The range picker shows both months
                at once and reads back "01/01/2026 — 30/06/2026".
                A range of numbers keeps its two boxes below: there is no
                picker for those, and "entre 5 y 20" is two facts anyway.
              */
              <DateRangePicker
                className="h-8 flex-1"
                ariaLabel={`Rango para ${label}`}
                placeholder="Elija el período"
                value={rangeValue(pair)}
                onChange={(r) => onUpdate(index, {
                  value: [asIsoDay(r?.from), asIsoDay(r?.to)],
                })}
              />
            ) : range ? (
              <>
                <ValueInput
                  field={field}
                  value={pair[0]}
                  ariaLabel={`Desde, ${label}`}
                  onChange={(v) => onUpdate(index, { value: [v, pair[1]] })}
                />
                <span className="text-xs text-muted-foreground">y</span>
                <ValueInput
                  field={field}
                  value={pair[1]}
                  ariaLabel={`Hasta, ${label}`}
                  onChange={(v) => onUpdate(index, { value: [pair[0], v] })}
                />
              </>
            ) : (
              <ValueInput
                field={field}
                options={listed}
                value={condition.value}
                ariaLabel={`Valor para ${label}`}
                onChange={(v) => onUpdate(index, { value: v })}
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
});

const FilterBuilder = ({ config, root, optionLists, onUpdate, onRemove, onSetJoin }: Props) => {
  const conditions = config.filters?.conditions ?? [];

  if (conditions.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Sin filtros. El reporte incluirá todos los registros.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {conditions.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Cumplir</span>
          <Select value={config.filters?.op ?? "and"} onValueChange={(v) => onSetJoin(v as "and" | "or")}>
            <SelectTrigger className="h-7 w-40" aria-label="Combinación de filtros"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="and">todos los filtros</SelectItem>
              <SelectItem value="or">cualquiera de ellos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <ul className="divide-y rounded-md border">
        {conditions.map((node, index) => {
          // Nested groups and existence filters come from saved configurations;
          // there is no interface to edit them, so say so rather than pretend.
          if (isFilterGroup(node) || isExists(node)) {
            return (
              <li key={`adv-${index}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Filtro avanzado</span>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  aria-label={`Quitar filtro avanzado ${index + 1}`}
                  onClick={() => onRemove(index)}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          }

          const condition = node as FilterCondition;
          const field = findField(root, condition.path);
          return (
            <FilterRow
              key={`${condition.path}-${index}`}
              condition={condition}
              index={index}
              field={field}
              options={field?.optionList ? optionLists?.[field.optionList] : undefined}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          );
        })}
      </ul>
    </div>
  );
};

export default FilterBuilder;
