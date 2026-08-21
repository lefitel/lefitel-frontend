import { memo, useState } from "react";
import { XIcon } from "lucide-react";
import type {
  CatalogField, CatalogRoot, FilterCondition, Operator, ReportConfig,
} from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  findField, isExists, isFilterGroup, operatorNeedsTwoValues, operatorNeedsValue,
} from "../../../lib/reportConfig";

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
  onUpdate: (index: number, patch: Partial<FilterCondition>) => void;
  onRemove: (index: number) => void;
  onSetJoin: (op: "and" | "or") => void;
}

/**
 * Input shaped by the field type.
 *
 * Numbers are kept as text while being edited rather than coerced on every
 * keystroke: `Number("-")` is NaN, which used to blank the field the moment
 * someone typed a minus sign, and then serialise to null in the request.
 * Validation flags a value that never becomes a number.
 */
const ValueInput = ({
  field, value, onChange, ariaLabel,
}: {
  field: CatalogField | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  ariaLabel: string;
}) => {
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

  if (field?.kind === "date") {
    return (
      <Input
        type="date"
        aria-label={ariaLabel}
        className="h-8 flex-1"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
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
  if (fromConfig !== adopted) {
    setAdopted(fromConfig);
    setText(fromConfig);
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

interface RowProps {
  condition: FilterCondition;
  index: number;
  field: CatalogField | undefined;
  onUpdate: (index: number, patch: Partial<FilterCondition>) => void;
  onRemove: (index: number) => void;
}

/** Memoised: the parent re-renders on every keystroke anywhere in the builder. */
const FilterRow = memo(function FilterRow({ condition, index, field, onUpdate, onRemove }: RowProps) {
  const label = field?.label ?? condition.path;
  const operators = field?.operators ?? ["eq"];
  const range = operatorNeedsTwoValues(condition.operator);
  const pair = Array.isArray(condition.value) ? condition.value : ["", ""];

  return (
    <li className="space-y-1.5 px-2 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        <Select
          value={condition.operator}
          onValueChange={(v) => onUpdate(index, { operator: v as Operator })}
        >
          <SelectTrigger className="h-8 w-44 text-xs" aria-label={`Operador para ${label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>{OPERATOR_LABEL[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label={`Quitar filtro sobre ${label}`}
          onClick={() => onRemove(index)}
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {operatorNeedsValue(condition.operator) && (
        <div className="flex items-center gap-2 pl-1">
          {condition.operator === "in" ? (
            <ListInput
              value={condition.value}
              ariaLabel={`Valores para ${label}`}
              onChange={(v) => onUpdate(index, { value: v })}
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
              value={condition.value}
              ariaLabel={`Valor para ${label}`}
              onChange={(v) => onUpdate(index, { value: v })}
            />
          )}
        </div>
      )}
    </li>
  );
});

const FilterBuilder = ({ config, root, onUpdate, onRemove, onSetJoin }: Props) => {
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
          return (
            <FilterRow
              key={`${condition.path}-${index}`}
              condition={condition}
              index={index}
              field={findField(root, condition.path)}
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
