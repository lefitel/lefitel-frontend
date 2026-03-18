import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo } from "react";

interface Props {
    rows: number;
    colums: number;
    hasOptions: boolean;
    hasPaginated: boolean;
}

// Deterministic random generator with a seed (so SSR and CSR match)
const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};
const randomNumber = (from: number, to: number, seed: number) => {
    return Math.floor(seededRandom(seed) * (to - from + 1)) + from;
};

const TableSkeleton: React.FC<Props> = ({ rows, colums, hasOptions, hasPaginated }) => {
    // Use a fixed seed (e.g. 42) so SSR/CSR always match
    const seed = 42;

    const optionWidths = useMemo(
        () => [
            randomNumber(20, 100, seed),
            randomNumber(20, 50, seed + 1),
        ],
        [seed]
    );
    const headerWidths = useMemo(
        () => Array.from({ length: colums }).map((_, i) => randomNumber(20, 100, seed + 10 + i)),
        [colums, seed]
    );
    const cellWidths = useMemo(
        () => Array.from({ length: rows * colums }).map((_, i) => randomNumber(20, 100, seed + 100 + i)),
        [rows, colums, seed]
    );
    const paginatedWidths = useMemo(
        () => [
            randomNumber(20, 100, seed + 500),
            randomNumber(20, 100, seed + 501),
        ],
        [seed]
    );

    let cellIndex = 0;

    return (
        <div className="flex flex-col gap-2">
            {/* Barra superior con filtros y opciones */}
            {!hasOptions ? null : (
                <div className="flex items-center justify-between gap-4">
                    <Skeleton className="h-8" style={{ width: `${optionWidths[0]}%` }} />
                    <Skeleton className="h-8" style={{ width: `${optionWidths[1]}%` }} />
                </div>
            )}
            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-muted">
                        <TableRow>
                            {Array.from({ length: colums }).map((_, i) => (
                                <TableHead key={i}>
                                    <Skeleton
                                        className="h-3 my-2 bg-muted"
                                        style={{ width: `${headerWidths[i]}%` }}
                                    />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, rowIdx) => (
                            <TableRow key={rowIdx}>
                                {Array.from({ length: colums }).map((_, colIdx) => {
                                    const width = cellWidths[cellIndex++];
                                    return (
                                        <TableCell key={colIdx}>
                                            <Skeleton
                                                className="h-3 my-0.5"
                                                style={{ width: `${width}%` }}
                                            />
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {/* Controles de paginación */}
            {!hasPaginated ? null : (
                <div className="flex items-center justify-between px-4 gap-4">
                    <Skeleton className="h-8" style={{ width: `${paginatedWidths[0]}%` }} />
                    <Skeleton className="h-8" style={{ width: `${paginatedWidths[1]}%` }} />
                </div>
            )}
        </div>
    );
};

export default TableSkeleton;