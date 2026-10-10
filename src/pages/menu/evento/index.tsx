import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SortingState } from "@tanstack/react-table";
import type { Col } from "../../../components/table/tableFeatures";
import { PlusIcon, MoreVerticalIcon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, RefreshCwIcon, ChevronRightIcon } from "lucide-react";
import { saveAs } from "file-saver";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { deleteEvento, desarchivarEvento, editEvento, exportarEventos, getEvento, reabrirEvento } from "../../../api/Evento.api";
import { mensajeDeError, mensajeDeErrorAsync, type FormatoDescarga } from "../../../api/descarga";
import { EventoInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import {
    getEventCriticality,
    CRITICALITY_BAND_OPTIONS, type CriticalityBand,
} from "../../../lib/criticality";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import DataTable, { type ActiveFilter } from "../../../components/table/DataTable";
import AddRevisionSheet from "../../../components/dialogs/AddRevisionSheet";
import ResolverEventoSheet from "../../../components/dialogs/ResolverEventoSheet";
import EventoSheet from "../../../components/dialogs/upsert/EventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

// The three questions this screen has to be able to answer, and could not.
//
// Filtering and sorting happen on the server, so these are not view state: each
// one is a round trip. They are separate from the column filter bar because
// that bar types text, and "prioritario" is not a word anyone should have to
// spell to find four rows.
type QuickFilters = {
    estado: "all" | "pending" | "solved";
    gravedad: CriticalityBand | "all";
    prioridad: "all" | "solo";
};

const NO_QUICK_FILTERS: QuickFilters = { estado: "all", gravedad: "all", prioridad: "all" };

/** The values the API understands. `evento.list.test.ts` pins the other side. */
const quickToFilters = (q: QuickFilters): ActiveFilter[] => [
    ...(q.estado !== "all" ? [{ column: "state", value: q.estado }] : []),
    ...(q.gravedad !== "all" ? [{ column: "criticality", value: q.gravedad }] : []),
    ...(q.prioridad === "solo" ? [{ column: "priority", value: "true" }] : []),
];

const EventoPage = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    const [list, setList] = useState<EventoInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [quickFilters, setQuickFilters] = useState<QuickFilters>(NO_QUICK_FILTERS);

    const [archivedList, setArchivedList] = useState<EventoInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);
    /**
     * The Archivados tab's own paging, filters and order. See the twin comment
     * in the pole list: sharing the active tab's state makes the footer count
     * the other tab's rows and strands the user on a page that no longer exists.
     */
    const [archivedTotal, setArchivedTotal] = useState(0);
    const [archivedPage, setArchivedPage] = useState(1);
    const [archivedPageSize, setArchivedPageSize] = useState(15);
    const [archivedFilters, setArchivedFilters] = useState<{ column: string; value: string }[]>([]);
    const [archivedSorting, setArchivedSorting] = useState<SortingState>([]);

    const [editId, setEditId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
    const [revisionId, setRevisionId] = useState<number | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [reabrirId, setReabrirId] = useState<number | null>(null);
    const [reabriendo, setReabriendo] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<EventoInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const [savingPriorityIds, setSavingPriorityIds] = useState<Set<number>>(new Set());

    /** Which file is being built, or `null`. See the twin in the pole screen. */
    const [exportando, setExportando] = useState<FormatoDescarga | null>(null);

    const rol = sesion.usuario.id_rol;
    const canAdd = can(rol, "eventos", "crear");
    const canEdit = can(rol, "eventos", "editar");

    // What the server is currently being asked for. It is a ref, not state,
    // because `load` must stay referentially stable — half a dozen dialogs take
    // it as their `onSuccess` — while still knowing the live query.
    //
    // Its default parameters used to come from the closure of the first render,
    // so a bare `load()` — which is what every dialog calls after saving, and
    // what the refresh button calls — always asked for page 1, unfiltered and
    // unsorted. Resolve one event out of a filtered list and the filter was
    // gone, with nothing on screen admitting it.
    const query = useRef({
        page: 1,
        pageSize: 15,
        columnFilters: [] as ActiveFilter[],
        quick: NO_QUICK_FILTERS,
        sorting: [] as SortingState,
    });

    const load = useCallback((next: Partial<typeof query.current> = {}) => {
        const q = { ...query.current, ...next };
        query.current = q;

        const filters = [...q.columnFilters, ...quickToFilters(q.quick)];
        const sortBy = q.sorting.map(s => s.id);
        const sortOrder = q.sorting.map(s => s.desc ? 'desc' : 'asc') as ('asc' | 'desc')[];

        setPageSize(q.pageSize);
        setLoading(true);
        getEvento({ page: q.page, limit: q.pageSize, filters: filters.length ? filters : undefined, sortBy: sortBy.length ? sortBy : undefined, sortOrder: sortOrder.length ? sortOrder : undefined })
            .then((res) => { setList(res.data); setTotal(res.total); setPage(res.page); })
            .catch(() => { toast.error("Error al cargar eventos"); setList(null); })
            .finally(() => setLoading(false));
    }, []);

    /**
     * Asks the server for the file the screen is showing.
     *
     * 🔴 **This is the screen the change was for.** The three quick filters are
     * what this page exists around, they already travel to the server for the
     * list, and the export threw them away: filter to "pendientes + críticas +
     * solo prioritarias", read four rows, press Excel, and receive a file of
     * 1.514 incidents headed "Eventos del Sistema" with nothing inside saying it
     * was not what you asked for. They travel now, and the file prints them
     * under its title.
     *
     * `query.current` and not the state, for the same reason `load` reads it:
     * it is the query the server was actually asked, which is what the file has
     * to match.
     */
    const exportar = async (formato: FormatoDescarga) => {
        if (exportando) return;
        setExportando(formato);
        const archivados = innerTab === "archivados";
        const q = query.current;
        const sort = archivados ? archivedSorting : q.sorting;
        const filters = archivados
            ? archivedFilters
            : [...q.columnFilters, ...quickToFilters(q.quick)];
        try {
            const { blob, filename } = await exportarEventos(formato, {
                archived: archivados,
                filters,
                sortBy: sort.map((x) => x.id),
                sortOrder: sort.map((x) => (x.desc ? "desc" : "asc")),
            });
            saveAs(blob, filename);
        } catch (error) {
            toast.error(await mensajeDeErrorAsync(error, "No se pudo generar el fichero"));
        } finally {
            setExportando(null);
        }
    };

    const applyQuickFilters = useCallback((next: Partial<QuickFilters>) => {
        const merged = { ...quickFilters, ...next };
        setQuickFilters(merged);
        load({ page: 1, quick: merged });
    }, [quickFilters, load]);

    const loadArchived = useCallback((
        p = 1,
        ps = 15,
        filters: { column: string; value: string }[] = [],
        sort: SortingState = [],
    ) => {
        setLoadingArchived(true);
        getEvento({
            archived: true,
            page: p,
            limit: ps,
            filters: filters.length ? filters : undefined,
            sortBy: sort.length ? sort.map((s) => s.id) : undefined,
            sortOrder: sort.length ? sort.map((s) => (s.desc ? "desc" : "asc")) : undefined,
        })
            .then((res) => {
                setArchivedList(res.data);
                setArchivedTotal(res.total);
                setArchivedPage(res.page);
            })
            .catch(() => { toast.error("Error al cargar eventos archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived(1, archivedPageSize, archivedFilters, archivedSorting);
    // The four values are the tab's own paging state, and including them is
    // both what the linter asks for and harmless: the guard above only lets the
    // body run while the list is still unloaded, so a later filter change
    // re-evaluates the effect and does nothing.
    }, [innerTab, archivedList, loadArchived, archivedPageSize, archivedFilters, archivedSorting]);

    const handlePriorityToggle = useCallback(async (evento: EventoInterface) => {
        if (!evento.id) return;
        const newPriority = !evento.priority;

        setSavingPriorityIds((prev) => new Set(prev).add(evento.id as number));
        setList((curr) => (curr ?? []).map((e) =>
            e.id === evento.id ? { ...e, priority: newPriority } : e
        ));

        const payload: EventoInterface = { ...evento, priority: newPriority };
        try {
            await editEvento(payload);
            toast.success(newPriority ? "Marcado como prioritario" : "Prioridad quitada");
        } catch (error) {
            // The star in the row is already lit. Reverting is what stops the
            // list claiming a priority the server refused to store.
            toast.error(mensajeDeError(error, "No se pudo actualizar"));
            setList((curr) => (curr ?? []).map((e) =>
                e.id === evento.id ? { ...e, priority: evento.priority } : e
            ));
        } finally {
            setSavingPriorityIds((prev) => { const next = new Set(prev); next.delete(evento.id as number); return next; });
        }
    }, []);

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await deleteEvento(deleteId);
            toast.success("Evento archivado.");
            load();
        } catch (error) {
            toast.error(mensajeDeError(error, "Error al archivar el evento."));
        } finally {
            setDeleting(false);
            setDeleteId(null);
        }
    };

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            await desarchivarEvento(unarchiveTarget.id as number);
            toast.success("Evento desarchivado");
            setUnarchiveTarget(null);
            // And back to the first page with it: the row just left this
            // list, so page five of four is now reachable by doing nothing.
            setArchivedList(null);
            setArchivedPage(1);
            load();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo desarchivar"));
        } finally {
            setUnarchiving(false);
        }
    };

    const columns = useMemo<Col<EventoInterface>[]>(() => [
        rowNumberColumn({ page, pageSize }),
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left line-clamp-2 max-w-xs"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/eventos/${row.original.id}`); }}
                >
                    {row.original.description}
                </button>
            ),
        },
        {
            accessorKey: "poste",
            header: "Poste",
            cell: ({ row }) => (
                <button
                    className="text-sm hover:underline text-left whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/postes/${row.original.id_poste}`); }}
                >
                    {row.original.poste?.name ?? "—"}
                </button>
            ),
        },
        {
            id: "coords",
            header: "Coordenadas",
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const lat = row.original.poste?.lat;
                const lng = row.original.poste?.lng;
                if (lat == null || lng == null) return <span className="text-xs text-muted-foreground">—</span>;
                return (
                    <a
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                    </a>
                );
            },
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.poste?.ciudadA;
                const b = row.original.poste?.ciudadB;
                return (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap">
                        {a?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${a.id}`); }}>{a.name}</button> : (a?.name ?? "—")}
                        <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0" />
                        {b?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${b.id}`); }}>{b.name}</button> : (b?.name ?? "—")}
                    </span>
                );
            },
        },
        {
            id: "propietario",
            header: "Propietario",
            // Not filterable: the server refuses a column it cannot filter by
            // (400), and since the query serialiser was fixed that refusal
            // actually arrives — `load`'s `.catch` would replace the whole table
            // with "Error al cargar los datos". Sorting stays: the shared filter
            // does map this one.
            enableColumnFilter: false,
            accessorFn: (row) => row.poste?.propietario?.name ?? null,
            cell: ({ row }) => (
                <span className="text-sm">{row.original.poste?.propietario?.name ?? "—"}</span>
            ),
        },
        {
            accessorKey: "state",
            header: "Estado",
            enableColumnFilter: false,
            cell: ({ row }) => row.original.state
                ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
                : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>,
        },
        {
            // Severity is not stored on the event: it is the worst — lowest —
            // level among its observations, resolved the same way here, on the
            // map, in the reports and in the server's ORDER BY. The column was
            // missing entirely, which is what made an urgent event unfindable
            // on the screen an alert points at.
            id: "criticality",
            header: "Gravedad",
            enableColumnFilter: false,
            // The accessor is what makes `getCanSort()` true: a column with only
            // an `id` is a display column, and its header would not have
            // responded to a click. The ordering itself is the server's — the
            // MIN subquery in `getEvento` — but without this the request is
            // never sent.
            accessorFn: (row) => getEventCriticality(row),
            // Same badge as the other events table (`ReportGeneralSec`) and the
            // observation catalogue, so one number reads the same everywhere.
            cell: ({ row }) => <CriticalityBadge level={getEventCriticality(row.original)} compact />,
        },
        {
            id: "fechaResolucion",
            header: "Fecha resolución",
            enableColumnFilter: false,
            accessorFn: (row) => row.solucions?.[0]?.date ?? null,
            cell: ({ row }) => {
                const fecha = row.original.solucions?.[0]?.date;
                if (!fecha) return <span className="text-xs text-muted-foreground">—</span>;
                return <span className="text-xs whitespace-nowrap">{new Date(fecha).toLocaleDateString("es-ES")}</span>;
            },
        },
        {
            accessorKey: "priority",
            header: "Prior.",
            enableColumnFilter: false,
            cell: ({ row }) => {
                const e = row.original;
                const isSaving = savingPriorityIds.has(e.id as number);
                const isPriority = !!e.priority;

                if (!canEdit) {
                    return isPriority
                        ? <Badge className="bg-red-500/10 text-red-600 border-transparent shadow-none text-xs">Sí</Badge>
                        : <span className="text-xs text-muted-foreground">No</span>;
                }

                return (
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={(ev) => { ev.stopPropagation(); handlePriorityToggle(e); }}
                        title="Click para cambiar prioridad"
                        className="inline-flex items-center cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                    >
                        {isPriority
                            ? <Badge className="bg-red-500/10 text-red-600 border-transparent shadow-none text-xs hover:bg-red-500/20">Sí</Badge>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-muted/50 text-muted-foreground border-border hover:bg-muted transition-colors">No</span>}
                    </button>
                );
            },
        },
        {
            id: "ultimaRev",
            header: "Última revisión",
            // Not filterable: the server refuses a column it cannot filter by
            // (400), and since the query serialiser was fixed that refusal
            // actually arrives — `load`'s `.catch` would replace the whole table
            // with "Error al cargar los datos". Sorting stays: the shared filter
            // does map this one.
            enableColumnFilter: false,
            accessorFn: (row) => {
                const revs = row.revisions ?? [];
                if (!revs.length) return null;
                return Math.max(...revs.map((r) => new Date(r.date).getTime()));
            },
            cell: ({ row }) => {
                const revs = row.original.revisions ?? [];
                if (!revs.length) return <span className="text-xs text-muted-foreground">—</span>;
                const max = new Date(Math.max(...revs.map((r) => new Date(r.date).getTime())));
                return <span className="text-xs whitespace-nowrap">{max.toLocaleDateString("es-ES")}</span>;
            },
        },
        {
            id: "usuario",
            header: "Creador",
            // Not filterable: the server refuses a column it cannot filter by
            // (400), and since the query serialiser was fixed that refusal
            // actually arrives — `load`'s `.catch` would replace the whole table
            // with "Error al cargar los datos". Sorting stays: the shared filter
            // does map this one.
            enableColumnFilter: false,
            accessorFn: (row) => row.usuario ? `${row.usuario.name} ${row.usuario.lastname}` : null,
            cell: ({ row }) => {
                const u = row.original.usuario;
                return (
                    <span className="text-sm whitespace-nowrap">
                        {u ? `${u.name} ${u.lastname}` : "—"}
                    </span>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: "Registrado",
            enableColumnFilter: false,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            accessorKey: "updatedAt",
            header: "Última edición",
            enableColumnFilter: false,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            id: "obs",
            header: "Observaciones",
            enableSorting: false,
            cell: ({ row }) => {
                const obs = row.original.eventoObs ?? [];
                if (!obs.length) return <span className="text-xs text-muted-foreground">—</span>;
                return (
                    <span className="text-xs text-muted-foreground">
                        ({obs.length}) {obs.map((eo) => eo.ob?.name).filter(Boolean).join(", ")}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => {
                const e = row.original;
                const isPending = !e.state;
                const canAct = can(sesion.usuario.id_rol, "eventos", "editar");
                const canArchivar = can(sesion.usuario.id_rol, "eventos", "archivar");
                return (
                    <div className="flex justify-end pr-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                                <MoreVerticalIcon className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => navigate(`/app/eventos/${e.id}`)}>
                                    Ver detalle
                                </DropdownMenuItem>
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setEditId(e.id as number)}>
                                        Editar
                                    </DropdownMenuItem>
                                )}
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setRevisionId(e.id as number)}>
                                        Agregar revisión
                                    </DropdownMenuItem>
                                )}
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setResolverEvento(e)}>
                                        Resolver
                                    </DropdownMenuItem>
                                )}
                                {canAct && !isPending && (
                                    <DropdownMenuItem
                                        className="text-amber-600 focus:text-amber-600"
                                        onClick={() => setReabrirId(e.id as number)}
                                    >
                                        Des-resolver
                                    </DropdownMenuItem>
                                )}
                                {canArchivar && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => setDeleteId(e.id as number)}
                                        >
                                            Archivar
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], [sesion.usuario.id_rol, navigate, page, pageSize, canEdit, savingPriorityIds, handlePriorityToggle]);

    const archivedColumns = useMemo<Col<EventoInterface>[]>(() => [
        {
            accessorKey: "poste",
            header: "Poste",
            cell: ({ row }) => <span className="text-sm font-medium">{row.original.poste?.name ?? "—"}</span>,
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.poste?.ciudadA;
                const b = row.original.poste?.ciudadB;
                return (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap">
                        {a?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${a.id}`); }}>{a.name}</button> : (a?.name ?? "—")}
                        <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0" />
                        {b?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${b.id}`); }}>{b.name}</button> : (b?.name ?? "—")}
                    </span>
                );
            },
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => <span className="text-sm line-clamp-2 max-w-xs">{row.original.description}</span>,
        },
        {
            accessorKey: "state",
            header: "Estado",
            enableColumnFilter: false,
            cell: ({ row }) => row.original.state
                ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
                : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>,
        },
        {
            accessorKey: "deletedAt",
            header: "Archivado el",
            // Not filterable, and this is a fix rather than a preference. The
            // filter picker offers every column with an accessor, so this one
            // appeared in it — and since C3 the server answers 400 to a filter
            // column it does not know, which this is. Before C3 it answered
            // every row instead, with the filter chip drawn as active: the same
            // defect from the other side. Its three siblings that hold a date
            // (`date`, `createdAt`, `updatedAt`) were already excluded for the
            // same reason; this one was missed because it only exists on the
            // Archivados table.
            enableColumnFilter: false,
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.original.deletedAt ? new Date(row.original.deletedAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUnarchiveTarget(row.original)}>
                        Desarchivar
                    </Button>
                </div>
            ),
        },
    ], [navigate]);

    const hasData = !!list?.length;

    return (
        <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
                    <p className="text-sm text-muted-foreground mt-1">Registro de incidencias en la red</p>
                </div>
                <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as InnerTab)}>
                    <TabsList>
                        <TabsTrigger value="activos">Activos</TabsTrigger>
                        <TabsTrigger value="archivados">Archivados</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {innerTab === "activos" && (
                <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Estado</span>
                        <SegmentedControl
                            size="sm"
                            ariaLabel="Filtrar por estado"
                            options={[
                                { value: "all", label: "Todos" },
                                { value: "pending", label: "Pendientes" },
                                { value: "solved", label: "Resueltos" },
                            ]}
                            value={quickFilters.estado}
                            onValueChange={(estado) => applyQuickFilters({ estado })}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Gravedad</span>
                        <SegmentedControl
                            size="sm"
                            scrollable
                            ariaLabel="Filtrar por gravedad"
                            options={CRITICALITY_BAND_OPTIONS}
                            value={quickFilters.gravedad}
                            onValueChange={(gravedad) => applyQuickFilters({ gravedad })}
                        />
                    </div>
                    <SegmentedControl
                        size="sm"
                        ariaLabel="Filtrar por prioridad"
                        options={[
                            { value: "all", label: "Todas" },
                            { value: "solo", label: "Solo prioritarias" },
                        ]}
                        value={quickFilters.prioridad}
                        onValueChange={(prioridad) => applyQuickFilters({ prioridad })}
                    />
                    {(quickFilters.estado !== "all" || quickFilters.gravedad !== "all" || quickFilters.prioridad !== "all") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => { setQuickFilters(NO_QUICK_FILTERS); load({ page: 1, quick: NO_QUICK_FILTERS }); }}
                        >
                            Quitar filtros
                        </Button>
                    )}
                </div>

                <DataTable
                    data={list}
                    loading={loading}
                    columns={columns}
                    onRetry={() => load()}
                    hasPaginated={true}
                    initialColumnVisibility={{ createdAt: false, updatedAt: false }}
                    serverSide={{
                        total,
                        onPageChange: (p, ps) => load({ page: p, pageSize: ps }),
                        onFilterChange: (filters) => load({ page: 1, columnFilters: filters }),
                        onSortingChange: (s) => load({ page: 1, sorting: s }),
                    }}
                    actions={<>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                disabled={!hasData}
                            >
                                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="hidden sm:inline">Exportar</span>
                                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                    className="gap-2"
                                    disabled={exportando !== null}
                                    onSelect={(e) => { e.preventDefault(); void exportar("excel"); }}
                                >
                                    <FileSpreadsheetIcon className="h-4 w-4 text-emerald-600" />
                                    {exportando === "excel" ? "Generando…" : "Excel (.xlsx)"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    disabled={exportando !== null}
                                    onSelect={(e) => { e.preventDefault(); void exportar("csv"); }}
                                >
                                    <FileTextIcon className="h-4 w-4 text-blue-500" />
                                    {exportando === "csv" ? "Generando…" : "CSV"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    disabled={exportando !== null}
                                    onSelect={(e) => { e.preventDefault(); void exportar("pdf"); }}
                                >
                                    <FileIcon className="h-4 w-4 text-red-500" />
                                    {exportando === "pdf" ? "Generando…" : "PDF"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="outline" size="icon-sm" onClick={() => load()} disabled={loading}>
                            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {canAdd && (
                            <Button className="gap-2" onClick={() => setAddOpen(true)}>
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo Evento</span>
                            </Button>
                        )}
                    </>}
                />
                </>
            )}

            {innerTab === "archivados" && (
                <DataTable
                    data={archivedList}
                    loading={loadingArchived}
                    columns={archivedColumns}
                    onRetry={() => loadArchived(archivedPage, archivedPageSize, archivedFilters, archivedSorting)}
                    hasPaginated={true}
                    serverSide={{
                        total: archivedTotal,
                        onPageChange: (p, ps) => { setArchivedPage(p); setArchivedPageSize(ps); loadArchived(p, ps, archivedFilters, archivedSorting); },
                        onFilterChange: (filters) => { setArchivedFilters(filters); setArchivedPage(1); loadArchived(1, archivedPageSize, filters, archivedSorting); },
                        onSortingChange: (s) => { setArchivedSorting(s); setArchivedPage(1); loadArchived(1, archivedPageSize, archivedFilters, s); },
                    }}
                    actions={
                        <Button variant="outline" size="icon-sm" onClick={() => loadArchived(archivedPage, archivedPageSize, archivedFilters, archivedSorting)} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            <PermissionGuard module="eventos" action="editar" open={editId !== null} onOpenChange={(v) => { if (!v) setEditId(null); }}>
                <EventoSheet
                    eventoId={editId}
                    open={editId !== null}
                    setOpen={(v: boolean) => { if (!v) setEditId(null); }}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="eventos" action="editar" open={resolverEvento !== null} onOpenChange={(v) => { if (!v) setResolverEvento(null); }}>
                <ResolverEventoSheet
                    evento={resolverEvento}
                    open={resolverEvento !== null}
                    setOpen={(v) => { if (!v) setResolverEvento(null); }}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AddRevisionSheet
                eventoId={revisionId}
                open={revisionId !== null}
                setOpen={(v) => { if (!v) setRevisionId(null); }}
                onSuccess={load}
            />

            <PermissionGuard module="eventos" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <EventoSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AlertDialog open={reabrirId !== null} onOpenChange={(v) => { if (!v) setReabrirId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Des-resolver evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará la solución registrada y su fotografía, que no se podrá
                            recuperar. El evento volverá a estado pendiente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={reabriendo}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={reabriendo}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={async () => {
                                if (!reabrirId) return;
                                setReabriendo(true);
                                try {
                                    await reabrirEvento(reabrirId);
                                    toast.success("Evento reabierto");
                                    setReabrirId(null);
                                    load();
                                } catch (error) {
                                    toast.error(mensajeDeError(error, "Error al des-resolver el evento"));
                                } finally {
                                    setReabriendo(false);
                                }
                            }}
                        >
                            {reabriendo ? "Procesando..." : "Des-resolver"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El evento quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
                        >
                            {deleting ? "Archivando..." : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El evento volverá a aparecer en las listas activas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={unarchiving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={unarchiving} onClick={handleUnarchive}>
                            {unarchiving ? "Desarchivando..." : "Desarchivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default EventoPage;
