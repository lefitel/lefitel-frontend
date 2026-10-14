import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    ColumnFiltersState,
    ColumnVisibilityState,
    flexRender,
    RowSelectionState,
    SortingState,
    useTable,
} from "@tanstack/react-table";
// Which capabilities the table has, and the column type with that set already
// filled in. See `tableFeatures.ts` for why it is declared once and not here.
import { appFeatures, type Col } from "./tableFeatures";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button, buttonVariants } from "../ui/button";
import { cn } from "@/lib/utils";
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    ColumnsIcon,
    SearchIcon,
} from "lucide-react";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { IGeneral } from "../../interfaces/iGeneral";
import TableSkeleton from "../skeleton/TableSkeleton";
import DynamicColumnFilter from "./DataTableFilter";

type RowSize = "sm" | "md" | "lg";

/**
 * The column a list keeps its ⋮ in, by the id every list gives it.
 *
 * On a phone a table is wider than the screen and scrolls sideways, and the ⋮
 * — the only way to edit or archive a row — sat past the right edge, behind a
 * scroll nobody knew to make. Below `md` it stays pinned to the right instead,
 * over the columns that scroll under it, with a background so they do not show
 * through. From `md` up the table fits, and a pinned cell would only paint over
 * the row's hover colour.
 */
const ACTIONS = "actions";
// The page's background, or the card's when the table sits in one — a ficha's.
const STICKY_ACTIONS_CELL = "max-md:sticky max-md:right-0 max-md:z-[1] max-md:bg-background max-md:in-data-[slot=card]:bg-card";
const STICKY_ACTIONS_HEAD = "max-md:sticky max-md:right-0 max-md:z-[1] max-md:bg-muted";

const ROW_SIZE_CLASS: Record<RowSize, string> = {
    sm: "py-1",
    md: "py-2",
    lg: "py-3",
};

export interface ActiveFilter {
    column: string;
    value: string;
}

interface ServerSideProps {
    total: number;
    onPageChange: (page: number, pageSize: number) => void;
    onFilterChange: (filters: ActiveFilter[]) => void;
    onSortingChange?: (sorting: SortingState) => void;
}

interface Props<T extends IGeneral> {
    data: T[] | null;
    actions: ReactNode;
    columns: Col<T>[];
    hasOptions?: boolean;
    hasPaginated?: boolean;
    loading?: boolean;
    onRetry?: () => void;
    onRowClick?: (row: T) => void;
    /** Rows `onRowClick` does not apply to: they are not drawn as clickable and a click on one does nothing. */
    isRowClickable?: (row: T) => boolean;
    getRowClassName?: (row: T) => string;
    initialColumnVisibility?: ColumnVisibilityState;
    initialSorting?: SortingState;
    getRowId?: (row: T) => string;
    rowSize?: RowSize;
    serverSide?: ServerSideProps;
    initialPageSize?: number;
    /**
     * The page to start on, counted from 1. Only for a server-side table whose
     * owner keeps the page somewhere that outlives the table — the Bitácora
     * keeps it in the address, so that coming back from a link lands on the
     * page that was left.
     */
    initialPage?: number;
    /**
     * What the empty body says. "Sin datos." fits a table with nothing to
     * narrow; a screen whose filters can empty it, or that has a better word
     * for "nothing yet", says so here.
     */
    emptyMessage?: string;
    /**
     * The inline "filter by column" bar, on by default. A screen that filters
     * through controls of its own (a result, a schedule) and has no column worth
     * typing into turns it off, rather than showing a picker with nothing in it.
     */
    hasColumnFilter?: boolean;
}

const DataTable = <T extends IGeneral>({
    data,
    actions,
    columns,
    hasOptions = true,
    hasPaginated = true,
    loading = false,
    onRetry,
    onRowClick,
    isRowClickable,
    getRowClassName,
    initialColumnVisibility = {},
    initialSorting = [],
    getRowId,
    rowSize = "sm",
    serverSide,
    initialPageSize = 15,
    initialPage = 1,
    emptyMessage = "Sin datos.",
    hasColumnFilter = true,
}: Props<T>) => {
    const [filterOpen, setFilterOpen] = useState(false);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialColumnVisibility);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>(initialSorting);
    const [pagination, setPagination] = useState({
        pageIndex: Math.max(0, initialPage - 1),
        pageSize: hasPaginated ? initialPageSize : 1_000_000,
    });

    const isFirstRender = useRef(true);

    // Server-side: debounce filter changes
    useEffect(() => {
        if (!serverSide) return;
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        const timer = setTimeout(() => {
            serverSide.onFilterChange(
                columnFilters
                    .filter(f => typeof f.value === "string" && (f.value as string).trim() !== "")
                    .map(f => ({ column: f.id, value: String(f.value) }))
            );
        }, 300);
        return () => clearTimeout(timer);
    }, [columnFilters]); // eslint-disable-line react-hooks/exhaustive-deps

    // Server-side: notify sorting changes (skip on mount)
    const isFirstSortRender = useRef(true);
    useEffect(() => {
        if (!serverSide?.onSortingChange) return;
        if (isFirstSortRender.current) { isFirstSortRender.current = false; return; }
        serverSide.onSortingChange(sorting);
    }, [sorting]); // eslint-disable-line react-hooks/exhaustive-deps

    // Server-side: notify page changes (skip on mount)
    const isFirstPageRender = useRef(true);
    useEffect(() => {
        if (!serverSide) return;
        if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
        serverSide.onPageChange(pagination.pageIndex + 1, pagination.pageSize);
    }, [pagination]); // eslint-disable-line react-hooks/exhaustive-deps

    const table = useTable({
        // Sorting, filtering, pagination, selection and column visibility, and
        // the row models behind them. v8 supplied all of it whether a table used
        // it or not; here it is a list, and the bundle carries only the list.
        features: appFeatures,
        data: data ?? [],
        columns,
        getRowId: getRowId ?? ((row) => (row.id ?? "").toString()),
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination,
        },
        ...(serverSide ? {
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            rowCount: serverSide.total,
            // Every click adds a column instead of replacing one, so two-level
            // ordering is reachable without a modifier key — which a phone in a
            // field does not have. `DataTable.test.tsx` pins the list the server
            // is then sent, order included.
            isMultiSortEvent: () => true,
        } : {}),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
    });

    // Estado: Cargando sin datos previos → skeleton completo
    if (loading && data === null) {
        return (
            <TableSkeleton colums={5} rows={5} hasOptions={hasOptions} hasPaginated={hasPaginated} />
        );
    }

    // Estado: Error al cargar (data es null cuando no está loading)
    if (data === null) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
                <p className="text-sm text-muted-foreground">Error al cargar los datos.</p>
                {onRetry && (
                    <Button variant="outline" onClick={onRetry} className="mt-4">
                        Reintentar
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 overflow-auto">
            {/* Barra superior con filtros y opciones */}
            {!hasOptions ? null : (() => {
                const hasActiveFilter = columnFilters.length > 0;
                const columnsDropdown = (
                    <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outlineGray" }), "border-muted h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]")}>
                            <ColumnsIcon />
                            <span className="ml-2 hidden lg:inline">Columnas</span>
                            <ChevronDownIcon className="ml-1 text-secondary-foreground/30" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table.getAllColumns().map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) => column.toggleVisibility(value)}
                                    disabled={!column.getCanHide()}
                                    onSelect={(event) => event.preventDefault()}
                                >
                                    {typeof column.columnDef.header === "string" && column.columnDef.header
                                        ? column.columnDef.header
                                        : column.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
                return (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-1">
                            {/* Mobile: botón lupa */}
                            {hasColumnFilter && (
                                <button
                                    className={cn(
                                        "relative shrink-0 sm:hidden",
                                        buttonVariants({ variant: "outlineGray" }),
                                        "border-muted h-8 w-8 rounded-[min(var(--radius-md),12px)] p-0 flex items-center justify-center"
                                    )}
                                    onClick={() => setFilterOpen((v) => !v)}
                                    aria-label="Filtrar"
                                >
                                    <SearchIcon className="h-3.5 w-3.5" />
                                    {hasActiveFilter && (
                                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                    )}
                                </button>
                            )}
                            {/* Desktop: filtro inline */}
                            <div className="hidden sm:flex flex-1">
                                {hasColumnFilter && <DynamicColumnFilter table={table} />}
                            </div>
                            {/* Wraps, to the right, when a screen's filters
                                are wider than a phone: Envíos hangs two
                                selects and a button here, some 470px, and in
                                one row they ran past the edge. */}
                            <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1">
                                {columnsDropdown}
                                {actions}
                            </div>
                        </div>
                        {/* Mobile: panel de filtro colapsable */}
                        {filterOpen && hasColumnFilter && (
                            <div className="sm:hidden">
                                <DynamicColumnFilter table={table} />
                            </div>
                        )}
                    </div>
                );
            })()}
            <div className="relative overflow-hidden rounded-lg border">
                {loading && (
                    <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
                        <div className="h-full w-full origin-left animate-[progress_1.2s_ease-in-out_infinite] bg-primary" />
                    </div>
                )}
                <Table>
                    <TableHeader className="bg-muted">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const canSort = header.column.getCanSort();
                                    const sorted = header.column.getIsSorted();
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={`text-left capitalize text-sm font-medium text-muted-foreground ${header.column.id === ACTIONS ? STICKY_ACTIONS_HEAD : ""}`}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={canSort ? "flex items-center gap-1 cursor-pointer select-none" : ""}
                                                    onClick={canSort ? (e) => header.column.getToggleSortingHandler()?.(e) : undefined}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {canSort && (
                                                        <span className="text-muted-foreground/50 flex items-center gap-0.5">
                                                            {sorted === "asc" ? (
                                                                <ArrowUpIcon className="h-3.5 w-3.5" />
                                                            ) : sorted === "desc" ? (
                                                                <ArrowDownIcon className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <ArrowUpDownIcon className="h-3.5 w-3.5" />
                                                            )}
                                                            {sorted && sorting.length > 1 && (
                                                                <span className="text-[10px] leading-none">{header.column.getSortIndex() + 1}</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => { if (isRowClickable?.(row.original) ?? true) onRowClick?.(row.original); }}
                                    className={`${onRowClick && (isRowClickable?.(row.original) ?? true) ? "cursor-pointer hover:bg-muted/50" : ""} ${getRowClassName?.(row.original) ?? ""}`}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => {
                                        return (
                                            <TableCell key={cell.id} className={`${ROW_SIZE_CLASS[rowSize]} m-0 ${cell.column.id === ACTIONS ? STICKY_ACTIONS_CELL : ""}`}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="text-center text-muted-foreground text-sm py-8">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {/* Controles de paginación */}
            {!hasPaginated ? null : (
                <div className="flex items-center justify-between px-4">
                    <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        {(() => {
                            const { pageIndex, pageSize: ps } = pagination;
                            const total = serverSide ? serverSide.total : table.getFilteredRowModel().rows.length;
                            const from = total === 0 ? 0 : pageIndex * ps + 1;
                            const to = Math.min((pageIndex + 1) * ps, total);
                            return `Mostrando ${from}–${to} de ${total}`;
                        })()}
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit ml-auto">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-normal text-muted-foreground">
                                Mostrar
                            </Label>
                            <Select
                                value={`${pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value));
                                }}
                            >
                                <SelectTrigger className="w-20" id="rows-per-page">
                                    <SelectValue placeholder={String(pagination.pageSize)} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[15, 25, 50, 100].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm text-muted-foreground">
                            Página {pagination.pageIndex + 1} de {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-1 lg:ml-0">
                            <Button
                                variant="outlineGray"
                                size="icon"
                                className="hidden size-8 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Ir a la primera página</span>
                                <ChevronsLeftIcon />
                            </Button>
                            <Button
                                variant="outlineGray"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Página anterior</span>
                                <ChevronLeftIcon />
                            </Button>
                            <Button
                                variant="outlineGray"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Página siguiente</span>
                                <ChevronRightIcon />
                            </Button>
                            <Button
                                variant="outlineGray"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Ir a la última página</span>
                                <ChevronsRightIcon />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
