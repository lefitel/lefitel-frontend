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

    const handleColumnChange = (columnId: string) => {
        selectedColumn?.setFilterValue("");
        setSelectedColumnId(columnId);
    };

    return (
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
    );
}

export default DynamicColumnFilter;
