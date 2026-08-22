import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "lucide-react";
import type { ReportResult } from "../../../api/generador.api";
import { Button } from "../../../components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import { formatValue } from "../../../lib/reportConfig";
import { imageUrl } from "../../../lib/imageUrl";

interface Props {
  result: ReportResult;
  onPage: (offset: number) => void;
  loading?: boolean;
}

const PreviewTable = ({ result, onPage, loading }: Props) => {
  const { columns, rows, total, limit, offset } = result;
  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  /**
   * The footer states three facts — the range, the page number, and how many
   * pages there are — computed from a total that was true when the page was
   * asked for. Between two pages somebody else can archive events, and then the
   * three contradict each other: on offset 300 of a report that has shrunk to
   * 250 rows it read "Mostrando 301–250 de 250" on page 4 of 3, which is three
   * impossible statements side by side and no hint of why.
   *
   * So the range is clamped so it can never invert, and the case is named
   * instead of rendered: a page with no rows and an offset past the end means
   * the report changed underneath, and the reader is told that and offered the
   * way back.
   */
  const stale = rows.length === 0 && offset > 0;
  const from = total === 0 || rows.length === 0 ? 0 : Math.min(offset + 1, total);
  const to = Math.min(offset + rows.length, total);
  const lastPageOffset = Math.max(0, (pages - 1) * Math.max(1, limit));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={c.kind === "number" ? "text-right whitespace-nowrap" : "whitespace-nowrap"}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length || 1} className="py-10 text-center text-sm text-muted-foreground">
                  Ningún registro coincide con estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => {
                    const value = row[c.key];
                    if (c.kind === "image") {
                      return (
                        <TableCell key={c.key}>
                          {value ? (
                            <a
                              href={imageUrl(value) ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span className="text-xs">Ver</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
                        key={c.key}
                        className={c.kind === "number" ? "text-right tabular-nums text-sm" : "text-sm"}
                      >
                        {formatValue(value, c.kind)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {stale && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Esta página ya no existe: el reporte cambió mientras la miraba.{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => onPage(lastPageOffset)}
          >
            Ir a la última página
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "Sin resultados"
            : stale
              ? `${total} en total`
              : `Mostrando ${from}–${to} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={offset <= 0 || loading}
            onClick={() => onPage(Math.max(0, offset - limit))}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Anterior
          </Button>
          <span className="tabular-nums">{Math.min(page, pages)} / {pages}</span>
          <Button
            variant="outline" size="sm"
            disabled={offset + limit >= total || loading}
            onClick={() => onPage(offset + limit)}
          >
            Siguiente
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreviewTable;
