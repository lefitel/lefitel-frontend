import type { RowData } from "@tanstack/react-table";
import type { Col } from "./tableFeatures";

/**
 * The leading "#" column, which counts rows across pages rather than restarting
 * at one on each.
 *
 * Nineteen copies of this lived across twelve screens, in two variants that
 * looked like drift and are not. A client-paginated table reads the page off the
 * table instance, because the table is the thing doing the paging. A
 * server-paginated one cannot: the API has already sliced the rows, so the
 * table's own `pageIndex` is always 0 and the screen's `page` state is the only
 * thing that knows which slice this is.
 *
 * Both are still here, but the difference is now a named argument at the call
 * site instead of a shape somebody has to notice. Passing `server` says out loud
 * that the API is paging this table; leaving it off says the browser is.
 *
 * The count is 1-based for a reader and `page` is too, which is why it is turned
 * into an index here rather than at eight call sites — off by one in a row
 * number is the kind of thing nobody reports and everybody distrusts.
 */
export function rowNumberColumn<T extends RowData>(
  server?: { page: number; pageSize: number },
): Col<T> {
  return {
    id: "num",
    header: "#",
    enableSorting: false,
    cell: ({ row, table }) => {
      const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
      const { pageIndex, pageSize } = server
        ? { pageIndex: server.page - 1, pageSize: server.pageSize }
        : table.options.state?.pagination ?? { pageIndex: 0, pageSize: 0 };
      return (
        <span className="text-xs text-muted-foreground">
          {pageIndex * pageSize + visibleIndex + 1}
        </span>
      );
    },
  };
}
