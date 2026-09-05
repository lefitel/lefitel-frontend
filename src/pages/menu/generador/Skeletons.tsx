// What the screen shows while it is waiting.
//
// The rule every one of these follows: a skeleton stands in for content that
// does not exist yet, never for content that does. Where there are already rows
// on screen and a new page is on its way, the rows stay — replacing real data
// with grey bars takes away something the reader had and gives back nothing.
//
// They also have to be the same shape as what replaces them. A skeleton that
// does not match causes a bigger jump than the spinner it replaced, which is
// the failure mode that makes people say skeletons feel worse than a spinner.

import type { CatalogRoot, ColumnSpec } from "../../../api/generador.api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import { columnHeader, columnKind } from "../../../lib/reportConfig";
import PageHelp from "./PageHelp";

/**
 * Bar widths that look like text without looking like a pattern.
 *
 * Fixed, not random: a width that changes between two renders makes the whole
 * block twitch while it waits, and React StrictMode renders everything twice in
 * development, so random widths visibly redraw on mount.
 */
const WIDTHS = ["78%", "56%", "91%", "64%", "83%", "49%", "72%", "88%", "60%", "75%"];
const widthAt = (i: number) => WIDTHS[i % WIDTHS.length];

/**
 * The saved report list while its first page is in flight.
 *
 * It stands in for a specific sentence, not for nothing: with no list and no
 * skeleton the panel states "Todavía no hay reportes guardados", which is a
 * claim about the reader's own data built out of a request that has not
 * answered yet. Somebody with forty of them was told to go build their first.
 */
export const SavedListSkeleton = () => (
  <ul className="divide-y rounded-md border" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex items-center gap-2 px-2 py-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5" style={{ width: widthAt(i) }} />
          <Skeleton className="h-2.5" style={{ width: widthAt(i + 5) }} />
        </div>
        <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
        <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
      </li>
    ))}
  </ul>
);

/**
 * A table whose columns are not known yet.
 *
 * Used before the catalog arrives, when there is no configuration to read, and
 * as the fallback for a run with no columns. Four columns because it has to
 * pick a number and four fills the card without claiming to be a real shape.
 * Built from divs rather than a `<table>`: an accessibility tree containing a
 * table with no headers and no cells is worse than no table at all.
 */
const PlainTableSkeleton = () => (
  <div className="overflow-hidden rounded-lg border" aria-hidden="true">
    <div className="flex gap-4 border-b bg-muted px-4 py-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-3 flex-1 bg-muted-foreground/20" />
      ))}
    </div>
    {Array.from({ length: 8 }).map((_, row) => (
      <div key={row} className="flex gap-4 border-b px-4 py-3 last:border-b-0">
        {[0, 1, 2, 3].map((col) => (
          <Skeleton
            key={col}
            className="h-3"
            style={{ flex: "1 1 0%", maxWidth: widthAt(row * 3 + col) }}
          />
        ))}
      </div>
    ))}
  </div>
);

interface ResultSkeletonProps {
  columns: ColumnSpec[];
  root: CatalogRoot | undefined;
}

/**
 * The table a report is about to return, drawn from the configuration.
 *
 * The headers are the real ones. Everything needed to write them is already on
 * this side — the paths, the summaries and any renaming the author typed — so
 * there is no reason to draw a grey bar where a word is already known, and
 * every reason not to: the header row is what decides the column widths, and a
 * bar of arbitrary width sets one width for the wait and another for the
 * result. `columnHeader` builds them the way the server does.
 *
 * Eight rows, because the reader is looking at an empty card and eight is
 * enough to read as a table without pretending to know how many rows will come
 * back. The count is never the report's, which nobody knows yet.
 */
export const ResultSkeleton = ({ columns, root }: ResultSkeletonProps) => {
  // A report with no columns cannot be run, so this should not happen; if it
  // ever does, a table of nothing renders as a thin empty box that reads as a
  // broken card rather than as a wait.
  if (columns.length === 0) return <PlainTableSkeleton />;

  return (
  <div className="space-y-3">
    <div className="overflow-x-auto rounded-lg border">
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
        <TableBody aria-hidden="true">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton
                    className={`h-3 my-0.5 ${
                      columnKind(root, column) === "number" ? "ml-auto" : ""
                    }`}
                    style={{ width: widthAt(rowIndex * 3 + colIndex) }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/*
      The footer keeps its line so the card does not grow by one row of text the
      moment the answer lands, and it says what it knows instead of showing a
      bar where a number will be: nobody knows the total yet, including this.
    */}
    <p className="text-sm text-muted-foreground">Contando las filas…</p>
  </div>
  );
};

/**
 * A card of the configuration panel before the catalog has arrived.
 *
 * The title is real. Four of the five headings on this page — "Reportes
 * detalle", "Reporte", "Columnas", "Filtros" — are fixed strings
 * that never depended on the catalog, so drawing a grey bar over them would be
 * hiding text that is already in hand.
 */
const CardSkeleton = ({
  title, lines, tabs = false,
}: { title: string; lines: number; tabs?: boolean }) => (
  // `size="sm"` because the four real panels are that size, and the size is
  // what sets the padding and the gap under the heading. Without it the
  // skeleton stood four pixels wider on every side than the card that replaced
  // it, which is the jump this whole component exists to avoid.
  <Card size="sm" className="min-w-0 border-muted/60 shadow-sm">
    <CardHeader className="border-b border-border/40 pb-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {/*
          The Guardados/Plantillas strip. It is a bet, and worth naming as one:
          the real strip only appears once the catalog says this reader has
          templates, and the catalog is precisely what has not arrived. Drawn
          because everyone who has a catalog at all has templates in it, so
          leaving it out guesses wrong far more often than drawing it does.
        */}
        {tabs && <Skeleton className="h-7 w-36 rounded-lg" />}
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-8" style={{ width: widthAt(i) }} />
        ))}
      </div>
    </CardContent>
  </Card>
);

/**
 * The whole page while the catalog is loading.
 *
 * It replaced a spinner alone in the middle of an empty page, which told the
 * reader that something was happening and nothing about what. This is the page
 * that is coming: two columns, four cards on the left, the result on the right.
 * Nothing here moves once the catalog lands except the parts that were unknown.
 *
 * The heading and the introduction are not skeletons for the same reason the
 * card titles are not — they are written into this page, not fetched.
 */
export const PageSkeleton = () => (
  <div
    className="@container/card w-full space-y-4 px-6 pt-4 pb-6 md:px-8 md:pb-8"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    {/* Only for anyone listening rather than looking; the bars say it visually. */}
    <span className="sr-only">Cargando los campos disponibles…</span>

    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        {/* Real, like the heading beside it: the help panel is written into the
            page and needs no catalog, so hiding it until one arrives would put
            a control on screen a moment after the reader started reading. */}
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Generador de reportes</h1>
          <PageHelp />
        </div>
        <p className="text-muted-foreground">
          Arme el reporte que necesite: elija las columnas, filtre y agrupe. Guárdelo para volver a generarlo cuando quiera.
        </p>
      </div>
      <Skeleton className="h-8 w-24 rounded-md" aria-hidden="true" />
    </div>

    {/* The same shape the page will have, down to the containment: a strip and
        two panels above a full-width table, `min-w-0` on each so a card wider
        than its share cannot widen the grid. It is repeated here rather than
        left out because the skeleton has to sit in the same box the page will,
        or the layout jumps the moment the catalog lands. */}
    {/* The level of detail, which is a strip and not a panel: one select, and
        the heading beside it is a fixed string that never waited on the
        catalog, so drawing a grey bar over it would hide text already in
        hand. */}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-muted/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Nivel de detalle</span>
        <Skeleton className="h-8 w-52 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Reporte</span>
        <Skeleton className="h-8 w-56 rounded-md" />
      </div>
    </div>

    <div className="grid items-start gap-4 md:grid-cols-2">
      <CardSkeleton title="Columnas" lines={3} />
      <CardSkeleton title="Filtros" lines={2} />
    </div>

    <div>
      <Card className="border-muted/60 shadow-sm">
        <CardHeader className="border-b border-border/40 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Resultado</CardTitle>
            <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PlainTableSkeleton />
        </CardContent>
      </Card>
    </div>
  </div>
);
