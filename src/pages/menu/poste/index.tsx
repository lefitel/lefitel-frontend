import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SortingState } from "@tanstack/react-table";
import type { Col } from "../../../components/table/tableFeatures";
import { PlusIcon, MoreVerticalIcon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, RefreshCwIcon, ChevronRightIcon, CheckIcon } from "lucide-react";
import { saveAs } from "file-saver";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { deletePoste, desarchivarPoste, editPoste, exportarPostes, getPoste, searchPoste } from "../../../api/Poste.api";
import { mensajeDeError, mensajeDeErrorAsync, type FormatoDescarga } from "../../../api/descarga";
import { getEvento_poste } from "../../../api/Evento.api";
import { estadoTrasFallo, getOpcionesPoste, EstadoOpciones, OpcionSimple } from "../../../api/opciones.api";
import { PosteInterface } from "../../../interfaces/interfaces";
import { posteExample } from "../../../data/example";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import DataTable from "../../../components/table/DataTable";
import PosteSheet from "../../../components/dialogs/upsert/PosteSheet";
import EventoSheet from "../../../components/dialogs/upsert/EventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

const PostePage = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    const [list, setList] = useState<PosteInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const [archivedList, setArchivedList] = useState<PosteInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);
    /**
     * The Archivados tab's own paging, filters and order.
     *
     * It used to fetch every archived row and sort, filter and page them in the
     * browser. Since C3 it pages on the server like the tab beside it — and it
     * needs **its own** state for all of it: sharing the active tab's `total`
     * makes the footer announce the other tab's count the moment you switch,
     * and sharing the page number leaves you on page five of a list that now
     * has four.
     */
    const [archivedTotal, setArchivedTotal] = useState(0);
    const [archivedPage, setArchivedPage] = useState(1);
    const [archivedPageSize, setArchivedPageSize] = useState(15);
    const [archivedFilters, setArchivedFilters] = useState<{ column: string; value: string }[]>([]);
    const [archivedSorting, setArchivedSorting] = useState<SortingState>([]);

    /**
     * Which file is being built, or `null`.
     *
     * Not a boolean, because the menu names the format it is working on — and
     * not absent, which is what it was: the browser version gave no feedback at
     * all between the click and the download, so the honest reaction to a
     * three-second wait was to click again, and each click was another full
     * pass over the table.
     */
    const [exportando, setExportando] = useState<FormatoDescarga | null>(null);

    const [addOpen, setAddOpen] = useState(false);
    const [selectedPoste, setSelectedPoste] = useState<PosteInterface>(posteExample);
    const [openEdit, setOpenEdit] = useState(false);
    const [addEventoId, setAddEventoId] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<PosteInterface | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<PosteInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const [materialList, setMaterialList] = useState<OpcionSimple[]>([]);
    const [propietarioList, setPropietarioList] = useState<OpcionSimple[]>([]);
    /**
     * Why the two inline dropdowns are empty, when they are — and there are
     * three different reasons, which is why this is not a boolean.
     *
     * This load used to end in `.catch(() => {})` with a comment saying the
     * dropdowns just would not populate. That was survivable while the lists
     * came from two ungated endpoints; now they come from
     * `/api/poste/options`, which asks for `postes.ver`. **This screen is
     * itself behind `postes.ver`** — `<ModuleRoute modulo="postes">` redirects
     * without it — so the refusal is not reachable from here; what is reachable
     * is every other failure, and a silent catch turned any of them into a menu
     * that opens empty with nothing to click and nothing to explain it. The
     * refused case is handled anyway because the answer costs one branch and
     * the screen should not have to know which gate protects it.
     *
     * The fourth state is not symmetry either: without `"cargando"`, a
     * catalogue that is legitimately empty — a fresh install, everything
     * archived — leaves the menu saying "Cargando…" for ever, which is the same
     * class of lie this task removed from the pole sheet's "Sin ADSS
     * registradas".
     */
    const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");
    const [savingMaterialIds, setSavingMaterialIds] = useState<Set<number>>(new Set());
    const [savingPropietarioIds, setSavingPropietarioIds] = useState<Set<number>>(new Set());

    const rol = sesion.usuario.id_rol;
    const canAdd = can(rol, "postes", "crear");
    const canEdit = can(rol, "postes", "editar");
    const isAdmin = can(rol, "postes", "archivar");


    /**
     * Asks the server for the file the screen is showing.
     *
     * The filters and the order of **the tab you are on**, which is the whole
     * change: the old button sent not one parameter and downloaded the entire
     * table whatever the screen showed.
     *
     * The Archivados branch below is not reachable today — that tab has no
     * export menu, and never had one — and it stays because `innerTab` is real
     * state and this is the correct reading of it: the day the menu is added
     * there, a version without the branch would hand the user the active poles
     * under a heading that said Archivados. An earlier draft of this comment
     * claimed that was the old bug; it was not, because there was no button to
     * press.
     *
     * The `catch` is not decoration either. Not one of the nine buttons had one
     * — a failure produced no file, no message and no console line, and the
     * server's sentences ("la lista supera el máximo", "ya hay una exportación
     * en curso") reached nobody. `mensajeDeErrorAsync` is what digs them out of
     * the blob a failed download arrives as.
     */
    const exportar = async (formato: FormatoDescarga) => {
        if (exportando) return;
        setExportando(formato);
        const archivados = innerTab === "archivados";
        // `query.current` and not the state: it is the query the server was
        // actually asked, which is what the file has to match.
        const sort = archivados ? archivedSorting : query.current.sorting;
        try {
            const { blob, filename } = await exportarPostes(formato, {
                archived: archivados,
                filters: archivados ? archivedFilters : query.current.filters,
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

    /**
     * What the server is currently being asked for.
     *
     * A ref and not state, because `load` has to stay referentially stable —
     * three dialogs take it as their `onSuccess` — while still knowing the live
     * query. The incident screen has the same one, for the same reason.
     *
     * 🔴 Without it, `load` read its defaults from the closure of the **first**
     * render: `1, 15, [], []`. So every bare `load()` — the refresh button, and
     * what all three dialogs call after saving — quietly asked for page one,
     * unfiltered and unsorted, while `activeFilters` kept the filter and the
     * chip stayed drawn on screen. Filter, save a pole, and the table showed
     * every row under an active filter. Since the export reads the same state,
     * the file would then have been correctly filtered and the screen not:
     * the very disagreement this task exists to close, arriving from the other
     * side.
     */
    const query = useRef({
        page: 1,
        pageSize: 15,
        filters: [] as { column: string; value: string }[],
        sorting: [] as SortingState,
    });

    const load = useCallback((next: Partial<typeof query.current> = {}) => {
        const q = { ...query.current, ...next };
        query.current = q;

        const sortBy = q.sorting.map(s => s.id);
        const sortOrder = q.sorting.map(s => s.desc ? 'desc' : 'asc') as ('asc' | 'desc')[];
        setPageSize(q.pageSize);
        setLoading(true);
        getPoste({ page: q.page, limit: q.pageSize, filters: q.filters.length ? q.filters : undefined, sortBy: sortBy.length ? sortBy : undefined, sortOrder: sortOrder.length ? sortOrder : undefined })
            .then((res) => { setList(res.data); setTotal(res.total); setPage(res.page); })
            .catch(() => { toast.error("Error al cargar postes"); setList(null); })
            .finally(() => setLoading(false));
    }, []);

    const loadArchived = useCallback((
        p = 1,
        ps = 15,
        filters: { column: string; value: string }[] = [],
        sort: SortingState = [],
    ) => {
        setLoadingArchived(true);
        getPoste({
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
            .catch(() => { toast.error("Error al cargar postes archivados"); setArchivedList(null); })
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

    useEffect(() => {
        if (!canEdit) return;
        getOpcionesPoste()
            .then((opciones) => {
                setMaterialList(opciones.material);
                setPropietarioList(opciones.propietario);
                setEstadoOpciones("listas");
            })
            .catch((error) => {
                setMaterialList([]);
                setPropietarioList([]);
                setEstadoOpciones(estadoTrasFallo(error));
            });
    }, [canEdit]);

    const handleMaterialChange = useCallback(async (poste: PosteInterface, newMaterialId: number) => {
        if (!poste.id || poste.id_material === newMaterialId) return;
        // Still a guard and not a lookup: nothing outside the catalogue gets
        // written, which is what stops a stale menu from saving a deleted id.
        if (!materialList.some((m) => m.id === newMaterialId)) return;

        setSavingMaterialIds((prev) => new Set(prev).add(poste.id as number));
        // Only the id moves, here and in the rollback below. The name shown in
        // the cell is resolved from `materialList` against `id_material`, so the
        // optimistic update no longer has to fabricate a nested row — which it
        // could not do honestly any more: the catalogue hands back `{id, name}`
        // and `MaterialInterface` declares a `description` that this screen has
        // never received, because `GET /api/poste/` projects the association to
        // those same two columns.
        setList((curr) => (curr ?? []).map((p) =>
            p.id === poste.id ? { ...p, id_material: newMaterialId } : p
        ));

        const payload: PosteInterface = { ...poste, id_material: newMaterialId };
        // 🔴 El revert vive en el `catch` y el identificador de «guardando» en el
        // `finally`, y las dos cosas son necesarias desde que `editPoste`
        // propaga. Mientras se tragaba el fallo esto no tenía `try` ninguno:
        // hoy, sin él, un rechazo del servidor dejaría la fila mostrando el
        // material que no se guardó y el desplegable girando para siempre.
        try {
            await editPoste(payload);
            toast.success("Material actualizado");
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo actualizar"));
            setList((curr) => (curr ?? []).map((p) =>
                p.id === poste.id ? { ...p, id_material: poste.id_material } : p
            ));
        } finally {
            setSavingMaterialIds((prev) => { const next = new Set(prev); next.delete(poste.id as number); return next; });
        }
    }, [materialList]);

    const handlePropietarioChange = useCallback(async (poste: PosteInterface, newPropId: number) => {
        if (!poste.id || poste.id_propietario === newPropId) return;
        if (!propietarioList.some((p) => p.id === newPropId)) return;

        setSavingPropietarioIds((prev) => new Set(prev).add(poste.id as number));
        setList((curr) => (curr ?? []).map((p) =>
            p.id === poste.id ? { ...p, id_propietario: newPropId } : p
        ));

        const payload: PosteInterface = { ...poste, id_propietario: newPropId };
        // Igual que el de arriba, y por lo mismo. Ver el comentario allí.
        try {
            await editPoste(payload);
            toast.success("Propietario actualizado");
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo actualizar"));
            setList((curr) => (curr ?? []).map((p) =>
                p.id === poste.id ? { ...p, id_propietario: poste.id_propietario } : p
            ));
        } finally {
            setSavingPropietarioIds((prev) => { const next = new Set(prev); next.delete(poste.id as number); return next; });
        }
    }, [propietarioList]);

    const handleOpenEdit = useCallback(async (id: number) => {
        try {
            const p = await searchPoste(id);
            setSelectedPoste(p);
            setOpenEdit(true);
        } catch {
            toast.error("No se pudo cargar el poste");
        }
    }, []);

    const handleDelete = useCallback(async () => {
        if (!confirmDelete?.id) return;
        setDeleting(true);
        try {
            const eventos = await getEvento_poste(confirmDelete.id as number);
            if (eventos.length > 0) { toast.error("No se puede archivar: tiene eventos asociados"); return; }
            await deletePoste(confirmDelete.id as number);
            toast.success("Poste archivado");
            setConfirmDelete(null);
            load();
        } catch (error) {
            // The check above reads the pole's incidents, and since C5 that
            // read asks for `eventos.ver` while this button asks for
            // `postes.archivar`. Refused, nothing is archived — the right
            // direction — but "ocurrió un error" left somebody unable to
            // archive a pole and unable to learn why. The guard is only in the
            // browser, so failing closed is load-bearing and worth naming.
            toast.error(mensajeDeError(error, "Ocurrió un error al archivar"));
        } finally {
            setDeleting(false);
        }
    }, [confirmDelete, load]);

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            await desarchivarPoste(unarchiveTarget.id as number);
            toast.success("Poste desarchivado");
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

    const columns = useMemo<Col<PosteInterface>[]>(() => [
        rowNumberColumn({ page, pageSize }),
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/postes/${row.original.id}`); }}
                >
                    {row.original.name}
                </button>
            ),
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.ciudadA;
                const b = row.original.ciudadB;
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
            id: "coords",
            header: "Coordenadas",
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const lat = row.original.lat;
                const lng = row.original.lng;
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
            id: "material",
            header: "Material",
            cell: ({ row }) => {
                const isSaving = savingMaterialIds.has(row.original.id as number);
                // The catalogue first, the row's own association second. That
                // order is what lets the optimistic update move only the id: the
                // name follows from it. The fallback still matters — the
                // catalogue is empty while it loads, and stays empty if the
                // request was refused.
                const name = materialList.find((m) => m.id === row.original.id_material)?.name
                    ?? row.original.material?.name ?? "—";

                if (!canEdit) {
                    return <span className="text-sm">{name}</span>;
                }

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={isSaving}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border bg-muted/50 text-foreground border-border hover:bg-muted cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Click para cambiar material"
                        >
                            {name}
                            <ChevronDownIcon className="h-3 w-3 opacity-60" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                            {materialList.length === 0 && (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    {estadoOpciones === "denegado"
                                        ? "No tiene permiso para consultar los materiales."
                                        : estadoOpciones === "fallo"
                                            ? "No se pudo cargar la lista de materiales."
                                            : estadoOpciones === "cargando"
                                                ? "Cargando…"
                                                : "Sin materiales registrados."}
                                </div>
                            )}
                            {materialList.map((m) => (
                                <DropdownMenuItem
                                    key={m.id}
                                    onClick={(e) => { e.stopPropagation(); handleMaterialChange(row.original, m.id as number); }}
                                    className="gap-2"
                                >
                                    {row.original.id_material === m.id ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                                    {m.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
        {
            id: "propietario",
            header: "Propietario",
            cell: ({ row }) => {
                const isSaving = savingPropietarioIds.has(row.original.id as number);
                const name = propietarioList.find((p) => p.id === row.original.id_propietario)?.name
                    ?? row.original.propietario?.name ?? "—";

                if (!canEdit) {
                    return <span className="text-sm">{name}</span>;
                }

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={isSaving}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border bg-muted/50 text-foreground border-border hover:bg-muted cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Click para cambiar propietario"
                        >
                            {name}
                            <ChevronDownIcon className="h-3 w-3 opacity-60" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                            {propietarioList.length === 0 && (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    {estadoOpciones === "denegado"
                                        ? "No tiene permiso para consultar los propietarios."
                                        : estadoOpciones === "fallo"
                                            ? "No se pudo cargar la lista de propietarios."
                                            : estadoOpciones === "cargando"
                                                ? "Cargando…"
                                                : "Sin propietarios registrados."}
                                </div>
                            )}
                            {propietarioList.map((p) => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onClick={(e) => { e.stopPropagation(); handlePropietarioChange(row.original, p.id as number); }}
                                    className="gap-2"
                                >
                                    {row.original.id_propietario === p.id ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                                    {p.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
        {
            id: "pendientes",
            header: "Pendientes",
            enableSorting: false,
            cell: ({ row }) => {
                const count = Number((row.original as PosteInterface & { pendingEvents?: number }).pendingEvents ?? 0);
                return count > 0
                    ? <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">{count}</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>;
            },
        },
        {
            id: "usuario",
            header: "Creador",
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
            accessorKey: "date",
            header: "Fecha en campo",
            enableColumnFilter: false,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.date ? new Date(row.original.date).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
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
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                            <MoreVerticalIcon className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => navigate(`/app/postes/${row.original.id}`)}>
                                Ver detalle
                            </DropdownMenuItem>
                            {canEdit && (
                                <DropdownMenuItem onClick={() => void handleOpenEdit(row.original.id as number)}>
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {canAdd && (
                                <DropdownMenuItem onClick={() => setAddEventoId(row.original.id as number)}>
                                    Nuevo evento
                                </DropdownMenuItem>
                            )}
                            {isAdmin && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setConfirmDelete(row.original)}
                                    >
                                        Archivar
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ], [navigate, canEdit, canAdd, isAdmin, handleOpenEdit, page, pageSize, materialList, propietarioList, estadoOpciones, savingMaterialIds, savingPropietarioIds, handleMaterialChange, handlePropietarioChange]);

    const archivedColumns = useMemo<Col<PosteInterface>[]>(() => [
        { accessorKey: "name", header: "Nombre" },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.ciudadA;
                const b = row.original.ciudadB;
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
            id: "material",
            header: "Material",
            cell: ({ row }) => <span className="text-sm">{row.original.material?.name ?? "—"}</span>,
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
                    <h1 className="text-2xl font-bold tracking-tight">Postes</h1>
                    <p className="text-sm text-muted-foreground mt-1">Red de postes registrados</p>
                </div>
                <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as InnerTab)}>
                    <TabsList>
                        <TabsTrigger value="activos">Activos</TabsTrigger>
                        <TabsTrigger value="archivados">Archivados</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {innerTab === "activos" && (
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
                        onFilterChange: (filters) => load({ page: 1, filters }),
                        onSortingChange: (sorting) => load({ page: 1, sorting }),
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

                        <Button variant="outline" size="icon-sm" aria-label="Actualizar" onClick={() => load()} disabled={loading}>
                            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {canAdd && (
                            <Button className="gap-2" onClick={() => setAddOpen(true)}>
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo Poste</span>
                            </Button>
                        )}
                    </>}
                />
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
                        <Button variant="outline" size="icon-sm" aria-label="Actualizar" onClick={() => loadArchived(archivedPage, archivedPageSize, archivedFilters, archivedSorting)} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            <PermissionGuard module="postes" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <PosteSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="postes" action="editar" open={openEdit} onOpenChange={setOpenEdit}>
                <PosteSheet
                    poste={selectedPoste}
                    open={openEdit}
                    setOpen={setOpenEdit}
                    onSuccess={load}
                />
            </PermissionGuard>

            {addEventoId !== null && (
                <EventoSheet
                    posteId={addEventoId}
                    open={true}
                    setOpen={(v) => { if (!v) setAddEventoId(null); }}
                    onSuccess={load}
                />
            )}

            <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar poste?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El poste <strong>{confirmDelete?.name}</strong> quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
                            disabled={deleting}
                            onClick={() => void handleDelete()}
                        >
                            {deleting ? "Archivando…" : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar poste?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El poste <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={unarchiving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={unarchiving} onClick={handleUnarchive}>
                            {unarchiving ? "Desarchivando…" : "Desarchivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default PostePage;
