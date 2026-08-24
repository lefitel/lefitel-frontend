// Which parts of TanStack Table this application uses, declared once.
//
// v8 shipped every capability whether a table used it or not, and typed a
// column as `ColumnDef<TData>`. v9 makes the capabilities opt-in — the bundle
// then carries only what is listed below — and the type system follows: every
// type gains a first parameter naming the feature set, so `ColumnDef<TData>`
// becomes `ColumnDef<typeof appFeatures, TData>`.
//
// Written out at sixteen call sites that only wanted "a column of Postes", that
// second parameter is noise, and it is the same value every time. So it is fixed
// here and re-exported as `Col`, `Tbl`, `Rw` and `ColumnOf`. A screen writes
// `Col<PosteInterface>` and never learns the feature set exists — which is the
// point: the day a feature is added below, no screen changes.
//
// The list is not a menu of everything available. It is exactly what
// `DataTable.tsx` asks the table to do, and adding to it costs bundle size:
//
// - columnFilteringFeature  the per-column filter bar
// - rowSortingFeature       clicking a header
// - rowPaginationFeature    the page controls at the bottom
// - rowSelectionFeature     `enableRowSelection`, used by the row highlight
// - columnVisibilityFeature the "Columnas" dropdown
//
// and the three row models are the machinery each of the first three needs to
// actually produce rows. `filterFns` and `sortFns` are the built-in registries,
// required because columns identify their behaviour by name (`includesString`)
// rather than by passing a function.

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type Column,
  type ColumnDef,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table";

export const appFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns,
  sortFns,
});

export type AppFeatures = typeof appFeatures;

/** A column definition, as every screen writes it: `Col<PosteInterface>`. */
export type Col<TData extends RowData, TValue = unknown> = ColumnDef<AppFeatures, TData, TValue>;

/** A table instance, for the components that receive one as a prop. */
export type Tbl<TData extends RowData> = Table<AppFeatures, TData>;

/** A row, for the cell renderers that reach into `row.original`. */
export type Rw<TData extends RowData> = Row<AppFeatures, TData>;

/** A column instance — not its definition. `DataTableFilter` walks these. */
export type ColumnOf<TData extends RowData, TValue = unknown> = Column<AppFeatures, TData, TValue>;
