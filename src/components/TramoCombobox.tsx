import { useMemo } from "react";
import { Combobox, type ComboboxOption } from "./ui/combobox";
import type { Tramo } from "../interfaces/interfaces";

export interface TramoComboboxProps {
  tramos: Tramo[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Adds a first "Todos los tramos" entry that maps to null. For report filters. */
  permitirTodos?: boolean;
  /** Adds a last "Crear tramo nuevo" entry. Only pass it when the role may create. */
  onCrear?: () => void;
  /**
   * The tramo `value` points at, for when it is not among `tramos`: the lists
   * only carry live tramos, and a pole can stand on one that was archived.
   * It is shown as the current value, marked "archivado", and is not offered
   * once something else is chosen.
   */
  actual?: Tramo | null;
  placeholder?: string;
  disabled?: boolean;
  /** The trigger's accessible name. */
  ariaLabel?: string;
}

/** Not an id, so it cannot be mistaken for one. */
const TODOS = "todos";

/**
 * The tramo picker the pole form and the report filters share.
 *
 * Each option is the name the server built and, to its right, the department:
 * that is what tells two tramos apart if they ever share a name. The options
 * stay in the order they arrived — the server sorts them, and a sort here
 * would not agree with it — and the search looks at the name and the
 * department.
 */
export default function TramoCombobox({
  tramos, value, onChange, permitirTodos, onCrear, actual, placeholder = "Seleccionar tramo...",
  disabled, ariaLabel = "Tramo",
}: TramoComboboxProps) {
  const opciones = useMemo<ComboboxOption[]>(() => {
    // The archived one only while it is the value: after that it is gone from the list.
    const fuera = actual && actual.id === value && !tramos.some((t) => t.id === actual.id) ? [actual] : [];
    const delTramo = (t: Tramo): ComboboxOption => ({
      value: String(t.id),
      label: t.nombre ?? "",
      hint: t.archivado ? "archivado" : (t.departamento?.name ?? "Sin departamento"),
    });
    return [
      ...(permitirTodos ? [{ value: TODOS, label: "Todos los tramos" }] : []),
      ...fuera.map(delTramo),
      ...tramos.map(delTramo),
    ];
  }, [tramos, actual, value, permitirTodos]);

  return (
    <Combobox
      options={opciones}
      value={value !== null ? String(value) : permitirTodos ? TODOS : ""}
      onValueChange={(v) => onChange(v === TODOS ? null : Number(v))}
      placeholder={placeholder}
      searchPlaceholder="Buscar tramo..."
      ariaLabel={ariaLabel}
      disabled={disabled}
      footer={onCrear ? { label: "Crear tramo nuevo", onSelect: onCrear } : undefined}
    />
  );
}
