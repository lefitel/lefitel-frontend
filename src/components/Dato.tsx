import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  /** The value. Nothing, or an empty string, reads as a dash. */
  children?: ReactNode;
  /** A second, quieter line under the value. */
  sub?: ReactNode;
  /** Both columns of the grid, for a value that does not fit in half of it. */
  ancho?: boolean;
  /** What acts on the value — copy it, change it — at the end of the row. */
  accion?: ReactNode;
}

/**
 * One fact of a detail sheet: its icon, a small label, and the value under it.
 * A cell of a two-column `<dl className="grid grid-cols-2 …">`.
 */
export default function Dato({ icon, label, children, sub, ancho = false, accion }: Props) {
  const vacio = children === undefined || children === null || children === "";
  return (
    <div className={`flex items-center gap-2 min-w-0 ${ancho ? "col-span-2" : ""}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <div className={`min-w-0 ${accion ? "flex-1" : ""}`}>
        <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
        <dd
          className="text-sm font-medium leading-tight truncate"
          title={typeof children === "string" ? children : undefined}
        >
          {vacio ? "—" : children}
        </dd>
        {sub && <dd className="text-xs leading-tight text-muted-foreground truncate">{sub}</dd>}
      </div>
      {accion}
    </div>
  );
}
