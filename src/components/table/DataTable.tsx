import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, flexRender, RowSelectionState } from "@tanstack/react-table";
import {
    ColumnFiltersState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from "@tanstack/react-table";
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
} from "lucide-react";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { IGeneral } from "../../interfaces/iGeneral";
import TableSkeleton from "../skeleton/TableSkeleton";
import DynamicColumnFilter from "./DataTableFilter";

type RowSize = "sm" | "md" | "lg";

const ROW_SIZE_CLASS: Record<RowSize, string> = {
    sm: "py-1",
    md: "py-2",
    lg: "py-3",
};

interface ServerSideProps {
    total: number;
    onPageChange: (page: number, pageSize: number) => void;
    onFilterChange: (columnId: string, value: string) => void;
}

interface Props<T extends IGeneral> {
    data: T[] | null;
    actions: ReactNode;
    columns: ColumnDef<T>[];
    hasOptions?: boolean;
    hasPaginated?: boolean;
    loading?: boolean;
    onRetry?: () => void;
    onRowClick?: (row: T) => void;
    getRowClassName?: (row: T) => string;
    initialColumnVisibility?: VisibilityState;
    getRowId?: (row: T) => string;
    rowSize?: RowSize;
    serverSide?: ServerSideProps;
    initialPageSize?: number;
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
    getRowClassName,
    initialColumnVisibility = {},
    getRowId,
    rowSize = "sm",
    serverSide,
    initialPageSize = 15,
}: Props<T>) => {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: hasPaginated ? initialPageSize : 1_000_000,
    });

    const isFirstRender = useRef(true);

    // Server-side: debounce filter changes
    useEffect(() => {
        if (!serverSide) return;
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        const filter = columnFilters[0];
        const timer = setTimeout(() => {
            if (filter) {
                serverSide.onFilterChange(filter.id, String(filter.value ?? ""));
            } else {
                serverSide.onFilterChange("", "");
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [columnFilters]); // eslint-disable-line react-hooks/exhaustive-deps

    // Server-side: notify page changes (skip on mount)
    const isFirstPageRender = useRef(true);
    useEffect(() => {
        if (!serverSide) return;
        if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
        serverSide.onPageChange(pagination.pageIndex + 1, pagination.pageSize);
    }, [pagination]); // eslint-disable-line react-hooks/exhaustive-deps

    const table = useReactTable({
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
            rowCount: serverSide.total,
        } : {}),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
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
            {!hasOptions ? null : (
                <div className="flex items-center justify-between gap-1">

                    <DynamicColumnFilter table={table} />
                    <div className="flex gap-1">
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

                        {actions}
                    </div>
                </div>
            )}
            <div className="relative overflow-hidden rounded-lg border">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
                                            className="text-left capitalize text-sm font-medium text-muted-foreground"
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={canSort ? "flex items-center gap-1 cursor-pointer select-none" : ""}
                                                    onClick={canSort ? (e) => header.column.getToggleSortingHandler()?.(e) : undefined}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {canSort && (
                                                        <span className="text-muted-foreground/50">
                                                            {sorted === "asc" ? (
                                                                <ArrowUpIcon className="h-3.5 w-3.5" />
                                                            ) : sorted === "desc" ? (
                                                                <ArrowDownIcon className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <ArrowUpDownIcon className="h-3.5 w-3.5" />
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
                                    onClick={() => onRowClick?.(row.original)}
                                    className={`${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""} ${getRowClassName?.(row.original) ?? ""}`}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => {
                                        return (
                                            <TableCell key={cell.id} className={`${ROW_SIZE_CLASS[rowSize]} m-0`}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="text-center text-muted-foreground text-sm py-8">
                                    Sin datos.
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
                            const { pageIndex, pageSize: ps } = table.getState().pagination;
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
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value));
                                }}
                            >
                                <SelectTrigger className="w-20" id="rows-per-page">
                                    <SelectValue placeholder={String(table.getState().pagination.pageSize)} />
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
                            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
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
