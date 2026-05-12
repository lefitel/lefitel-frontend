import { useState } from "react";
import { Column, Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, XIcon } from "lucide-react";

interface DynamicColumnFilterProps<TData> {
    table: Table<TData>;
    placeholder?: string;
}

function getColumnLabel<TData>(column: Column<TData, unknown>): string {
    const header = column.columnDef.header;
    if (typeof header === "string" && header) return header;
    return column.id;
}

function DynamicColumnFilter<TData>({ table, placeholder }: DynamicColumnFilterProps<TData>) {
    const columns = table.getAllColumns().filter((column) => column.getCanFilter());
    const [selectedColumnId, setSelectedColumnId] = useState<string>(columns[0]?.id ?? "");

    const selectedColumn = selectedColumnId ? table.getColumn(selectedColumnId) : undefined;
    const rawFilter = selectedColumn?.getFilterValue();
    const filterValue = typeof rawFilter === "string" ? rawFilter : "";

    const activeFilters = columns.filter(col => {
        const val = col.getFilterValue();
        return typeof val === "string" && (val as string).trim() !== "";
    });

    const handleColumnChange = (columnId: string) => {
        setSelectedColumnId(columnId);
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {activeFilters.map(col => (
                        <span
                            key={col.id}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                            <span className="font-medium">{getColumnLabel(col)}:</span>
                            <span>{String(col.getFilterValue())}</span>
                            <button
                                type="button"
                                onClick={() => col.setFilterValue("")}
                                className="ml-0.5 hover:text-primary/60 transition-colors"
                            >
                                <XIcon className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-1 w-full">
                <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 w-36 shrink-0 items-center justify-between gap-1 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span className="truncate">
                            {selectedColumn ? getColumnLabel(selectedColumn) : "Columna"}
                        </span>
                        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                        {columns.map((column) => (
                            <DropdownMenuItem
                                key={column.id}
                                onClick={() => handleColumnChange(column.id)}
                                className={selectedColumnId === column.id ? "bg-accent text-accent-foreground" : ""}
                            >
                                {getColumnLabel(column)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {selectedColumn && (
                    <div className="relative flex-1">
                        <Input
                            placeholder={placeholder || `Filtrar por ${getColumnLabel(selectedColumn)}...`}
                            value={filterValue}
                            onChange={(e) => selectedColumn.setFilterValue(e.target.value)}
                            className="w-full h-8 pr-8"
                        />
                        {filterValue && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => selectedColumn.setFilterValue("")}
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DynamicColumnFilter;
