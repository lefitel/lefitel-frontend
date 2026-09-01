// The report taking shape as it is built, before anything is asked for.
//
// The right-hand panel used to be empty until Generar was pressed, so the whole
// of the building happened blind: you chose a level of detail, added six
// columns and grouped by one of them with nothing on screen to say whether that
// was the table you wanted. This draws that table from the configuration alone.
//
// Two rules keep it honest:
//
//  1. Every value goes through `formatValue`, the same function the real table
//     uses. A date is shown in exactly the format the result will use and a
//     whole number keeps the exact form ids need, so the preview cannot promise
//     a formatting the report will not deliver.
//  2. It never pretends to be a result. The strip above it says so, the values
//     are visibly placeholders, and there is no total and no pagination —
//     nobody knows how many rows there are, including this.

import { ImageIcon } from "lucide-react";
import type { CatalogRoot, ColumnSpec, FieldKind } from "../../../api/generador.api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import { columnHeader, columnKind, formatValue } from "../../../lib/reportConfig";

/**
 * Placeholder values, one set per type, varied by row.
 *
 * Lengths differ on purpose: a column of identical strings reads as a stamp
 * rather than as a column, and the widths a real table settles into come from
 * the values being uneven.
 *
 * Numbers stay small and unremarkable. A placeholder reading "1.376" beside a
 * report of events is the number of events in the database, and somebody would
 * eventually quote it.
 */
const SAMPLE: Record<FieldKind, unknown[]> = {
  string: [
    "Texto de ejemplo",
    "Otro valor de ejemplo",
    "Un ejemplo bastante más largo",
    "Ejemplo",
    "Valor de ejemplo",
    "Otro ejemplo de texto",
  ],
  number: [12, 4, 37, 8, 21, 3],
  boolean: [true, false, true, true, false, true],
  // Fixed dates, not `new Date()`: a preview that shows today's date invites
  // the reading that these rows are today's records.
  date: [
    new Date(2026, 0, 14), new Date(2026, 2, 3), new Date(2026, 4, 22),
    new Date(2026, 6, 9), new Date(2026, 8, 30), new Date(2026, 10, 11),
  ],
  image: [null, null, null, null, null, null],
};

const sampleFor = (kind: FieldKind, row: number): unknown =>
  SAMPLE[kind][row % SAMPLE[kind].length];

interface Props {
  columns: ColumnSpec[];
  root: CatalogRoot | undefined;
  /**
   * Whether the configuration groups.
   *
   * A summary returns one row per distinct value instead of one per record, and
   * showing eight rows for it would teach the opposite of what grouping does.
   * Four is few enough to read as "this collapses your data".
   */
  grouped: boolean;
}

const ShapePreview = ({ columns, root, grouped }: Props) => {
  const rows = grouped ? 4 : 8;

  return (
    <div className="space-y-3">
      {/*
        Said before the table, not after it. Somebody who scrolls to the rows
        first has to meet this on the way, and it has to survive a screenshot:
        the whole risk of a preview built from invented values is that one of
        them ends up quoted in a meeting.
      */}
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
      >
        <span className="font-medium text-foreground">Vista previa</span>
        <span>
          así quedará el reporte. Los valores son de ejemplo: pulse{" "}
          <strong className="font-medium text-foreground">Generar</strong> para ver los datos reales.
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-dashed">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              {columns.map((column, i) => (
                <TableHead
                  key={`${column.path}|${column.agg ?? ""}|${i}`}
                  className={`whitespace-nowrap ${
                    columnKind(root, column) === "number" ? "text-right" : "text-left"
                  }`}
                >
                  {columnHeader(root, column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, row) => (
              <TableRow key={row}>
                {columns.map((column, col) => {
                  const kind = columnKind(root, column);
                  return (
                    <TableCell
                      key={col}
                      // Lighter than a real row on purpose, and italic: at a
                      // glance, from across a desk, this must not read as data.
                      className={`italic text-muted-foreground/70 ${
                        kind === "number" ? "text-right tabular-nums text-sm" : "text-sm"
                      }`}
                    >
                      {kind === "image" ? (
                        // The real table puts a link here. A link that goes
                        // nowhere is worse than no link, so it is the same
                        // shape without being clickable.
                        <span className="inline-flex items-center gap-1 not-italic">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span className="text-xs">Ver</span>
                        </span>
                      ) : (
                        formatValue(sampleFor(kind, row), kind)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/*
        Where the real footer states a range and a total. There is no total to
        state, and inventing one — "8 filas" — would be the one placeholder
        somebody could mistake for an answer, since it is exactly the kind of
        number this screen exists to produce.
      */}
      <p className="text-sm text-muted-foreground">
        {grouped
          ? "Una fila por cada grupo distinto. Cuántas salgan depende de los datos."
          : "Cuántas filas salgan depende de los datos y de los filtros."}
      </p>
    </div>
  );
};

export default ShapePreview;
