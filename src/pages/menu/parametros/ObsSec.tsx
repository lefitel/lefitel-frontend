import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { CheckIcon, ChevronDownIcon, MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { createObs, deleteObs, desarchivarObs, editObs, getObs, getObsStats, ObsStats } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { ParametrosKpiCards } from "./ParametrosKpiCards";
import { ListIcon, AlertOctagonIcon, AlertTriangleIcon } from "lucide-react";
import { ObsInterface, TipoObsInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Combobox } from "../../../components/ui/combobox";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { CRITICALITY_LEVELS } from "../../../lib/criticality";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "../../../components/ui/sheet";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import DataTable from "../../../components/table/DataTable";
import { InnerTab } from "./index";

interface Props { innerTab: InnerTab; }

const ObsSec = ({ innerTab }: Props) => {
    const { sesion } = useContext(SesionContext);
    const rol = sesion.usuario.id_rol;

    const [list, setList] = useState<ObsInterface[] | null>(null);
    const [tipoObsList, setTipoObsList] = useState<TipoObsInterface[]>([]);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<ObsInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);
    const [selected, setSelected] = useState<ObsInterface | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<ObsInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [idTipoObs, setIdTipoObs] = useState<number>(0);
    const [criticality, setCriticality] = useState<number | null>(null);
    const [stats, setStats] = useState<ObsStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [savingCriticalityIds, setSavingCriticalityIds] = useState<Set<number>>(new Set());

    const loadStats = useCallback(() => {
        setStatsLoading(true);
        getObsStats(sesion.token)
            .then(setStats)
            .catch(() => setStats(null))
            .finally(() => setStatsLoading(false));
    }, [sesion.token]);

    useEffect(() => { loadStats(); }, [loadStats]);

    const load = useCallback(() => {
        setLoading(true);
        getObs(sesion.token)
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar observaciones"); setList(null); })
            .finally(() => setLoading(false));
    }, [sesion.token]);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getObs(sesion.token, true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar observaciones archivadas"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, [sesion.token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            const result = await desarchivarObs(unarchiveTarget.id as number, sesion.token);
            if (result === 200) {
                toast.success("Observación desarchivada");
                setUnarchiveTarget(null);
                setArchivedList(null);
                load();
            } else {
                toast.error("No se pudo desarchivar");
            }
        } finally {
            setUnarchiving(false);
        }
    };

    const loadTipoObs = useCallback(async () => {
        const data = await getTipoObs(sesion.token);
        setTipoObsList(data ?? []);
    }, [sesion.token]);

    useEffect(() => { loadTipoObs(); }, [loadTipoObs]);

    const [savingTipoObsIds, setSavingTipoObsIds] = useState<Set<number>>(new Set());

    const handleTipoObsChange = useCallback(async (obs: ObsInterface, newTipoId: number) => {
        if (!obs.id || obs.id_tipoObs === newTipoId) return;
        const newTipo = tipoObsList.find((t) => t.id === newTipoId);
        if (!newTipo) return;

        setSavingTipoObsIds((prev) => new Set(prev).add(obs.id as number));
        // Optimistic update
        setList((curr) => (curr ?? []).map((o) =>
            o.id === obs.id ? { ...o, id_tipoObs: newTipoId, tipoObs: newTipo } : o
        ));

        const payload: ObsInterface = { ...obs, id_tipoObs: newTipoId };
        const result = await editObs(payload, sesion.token);
        setSavingTipoObsIds((prev) => { const next = new Set(prev); next.delete(obs.id as number); return next; });

        if (Number(result) === 200 || Number(result) === 201) {
            toast.success("Tipo actualizado");
        } else {
            toast.error("No se pudo actualizar");
            setList((curr) => (curr ?? []).map((o) =>
                o.id === obs.id ? { ...o, id_tipoObs: obs.id_tipoObs, tipoObs: obs.tipoObs } : o
            ));
        }
    }, [sesion.token, tipoObsList]);

    const tipoObsOptions = useMemo(() =>
        tipoObsList.map((t) => ({ value: String(t.id), label: t.name })),
        [tipoObsList]
    );

    const openEdit = useCallback((row: ObsInterface) => {
        setSelected(row);
        setName(row.name);
        setDescription(row.description);
        setIdTipoObs(row.id_tipoObs);
        setCriticality(row.criticality ?? null);
        loadTipoObs();
        setSheetOpen(true);
    }, [loadTipoObs]);

    const openAdd = () => {
        setSelected(null);
        setName("");
        setDescription("");
        setIdTipoObs(0);
        setCriticality(null);
        loadTipoObs();
        setSheetOpen(true);
    };

    const handleClose = () => { setSheetOpen(false); setSelected(null); };

    const handleCriticalityChange = useCallback(async (obs: ObsInterface, newLevel: number | null) => {
        if (!obs.id) return;
        if (obs.criticality === newLevel || (obs.criticality == null && newLevel == null)) return;

        setSavingCriticalityIds((prev) => new Set(prev).add(obs.id as number));
        // Optimistic update
        setList((curr) => (curr ?? []).map((o) => o.id === obs.id ? { ...o, criticality: newLevel } : o));

        const payload: ObsInterface = { ...obs, criticality: newLevel };
        const result = await editObs(payload, sesion.token);
        setSavingCriticalityIds((prev) => { const next = new Set(prev); next.delete(obs.id as number); return next; });

        if (Number(result) === 200 || Number(result) === 201) {
            toast.success("Criticidad actualizada");
            loadStats();
        } else {
            toast.error("No se pudo actualizar");
            // Revert
            setList((curr) => (curr ?? []).map((o) => o.id === obs.id ? { ...o, criticality: obs.criticality } : o));
        }
    }, [sesion.token, loadStats]);

    const handleSave = async () => {
        if (!name.trim() || !description.trim()) return toast.warning("Nombre y descripción son requeridos");
        if (!idTipoObs) return toast.warning("Selecciona un tipo de observación");
        setSaving(true);
        const payload: ObsInterface = { ...selected, name, description, id_tipoObs: idTipoObs, criticality };
        const result = await (selected?.id ? editObs(payload, sesion.token) : createObs(payload, sesion.token));
        if (Number(result) === 200 || Number(result) === 201) {
            toast.success(selected?.id ? "Observación actualizada" : "Observación creada");
            handleClose();
            load();
            loadStats();
        } else {
            toast.error("No se pudo guardar");
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!selected?.id) return;
        setDeleting(true);
        const result = await deleteObs(selected.id as number, sesion.token);
        if (Number(result) === 200) {
            toast.success("Observación archivada");
            setDeleteOpen(false);
            handleClose();
            load();
            loadStats();
        } else {
            toast.error("No se pudo archivar");
        }
        setDeleting(false);
    };

    const columns = useMemo<ColumnDef<ObsInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row, table }) => {
                const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
                const { pageIndex, pageSize } = table.getState().pagination;
                return <span className="text-xs text-muted-foreground">{pageIndex * pageSize + visibleIndex + 1}</span>;
            },
        },
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "description", header: "Descripción" },
        {
            id: "tipoObs",
            header: "Tipo",
            accessorFn: (row) => row.tipoObs?.name ?? "",
            cell: ({ row }) => {
                const canEdit = can(rol, "parametros", "editar");
                const isSaving = savingTipoObsIds.has(row.original.id as number);
                const name = row.original.tipoObs?.name ?? "—";

                if (!canEdit) {
                    return <span className="text-sm text-muted-foreground">{name}</span>;
                }

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border bg-muted/50 text-foreground border-border hover:bg-muted cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Click para cambiar tipo"
                        >
                            {name}
                            <ChevronDownIcon className="h-3 w-3 opacity-60" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                            {tipoObsList.map((t) => (
                                <DropdownMenuItem
                                    key={t.id}
                                    onClick={(e) => { e.stopPropagation(); handleTipoObsChange(row.original, t.id as number); }}
                                    className="gap-2"
                                >
                                    {row.original.id_tipoObs === t.id ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                                    {t.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
        {
            id: "criticality",
            header: "Criticidad",
            accessorFn: (row) => row.criticality ?? 99,
            cell: ({ row }) => {
                const canEdit = can(rol, "parametros", "editar");
                const isSaving = savingCriticalityIds.has(row.original.id as number);
                return (
                    <CriticalityBadge
                        level={row.original.criticality}
                        onChange={canEdit ? (lvl) => handleCriticalityChange(row.original, lvl) : undefined}
                        disabled={isSaving}
                    />
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: "Registrado",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            accessorKey: "updatedAt",
            header: "Última edición",
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
            cell: ({ row }) => !can(rol, "parametros", "editar") ? null : (
                <div className="flex justify-end pr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                            <MoreVerticalIcon className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => openEdit(row.original)}>Editar</DropdownMenuItem>
                            {can(rol, "parametros", "archivar") && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => { setSelected(row.original); setDeleteOpen(true); }}
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
    ], [openEdit, rol, savingCriticalityIds, handleCriticalityChange, savingTipoObsIds, handleTipoObsChange, tipoObsList]);

    const archivedColumns = useMemo<ColumnDef<ObsInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row, table }) => {
                const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
                const { pageIndex, pageSize } = table.getState().pagination;
                return <span className="text-xs text-muted-foreground">{pageIndex * pageSize + visibleIndex + 1}</span>;
            },
        },
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "description", header: "Descripción" },
        {
            id: "tipoObs",
            header: "Tipo",
            accessorFn: (row) => row.tipoObs?.name ?? "",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {row.original.tipoObs?.name ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "deletedAt",
            header: "Archivada el",
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
    ], []);

    return (
        <>
            {innerTab === "activos" && (
                <ParametrosKpiCards
                    loading={statsLoading}
                    items={[
                        {
                            label: "Total observaciones",
                            value: stats?.total ?? 0,
                            hint: "Activas en el sistema",
                            icon: ListIcon,
                            tone: "default",
                        },
                        {
                            label: "Sin clasificar",
                            value: stats?.unclassified ?? 0,
                            hint: (stats?.unclassified ?? 0) > 0 ? "Asigna criticidad para mejor reporte" : "Todas clasificadas ✓",
                            icon: AlertTriangleIcon,
                            tone: (stats?.unclassified ?? 0) > 0 ? "warning" : "success",
                        },
                        {
                            label: "Críticas (niveles 1-3)",
                            value: stats?.critical ?? 0,
                            hint: "Alta urgencia operativa",
                            icon: AlertOctagonIcon,
                            tone: "danger",
                        },
                    ]}
                />
            )}
            {innerTab === "activos" && (
                <DataTable
                    data={list}
                    loading={loading}
                    columns={columns}
                    onRetry={load}
                    hasPaginated={false}
                    actions={<>
                        <Button variant="outline" size="icon-sm" onClick={load} disabled={loading}>
                            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {can(rol, "parametros", "crear") && (
                            <Button className="gap-2" onClick={openAdd}>
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Nueva</span>
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
                    onRetry={loadArchived}
                    hasPaginated={false}
                    actions={
                        <Button variant="outline" size="icon-sm" onClick={loadArchived} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            {can(rol, "parametros", "editar") && (
                <>
                    <Sheet open={sheetOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>{selected?.id ? "Editar Observación" : "Nueva Observación"}</SheetTitle>
                                <SheetDescription>Completa los campos y guarda los cambios.</SheetDescription>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="obs-name">Nombre</Label>
                                    <Input id="obs-name" value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="obs-desc">Descripción</Label>
                                    <Input id="obs-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Tipo de Observación</Label>
                                    <Combobox
                                        options={tipoObsOptions}
                                        value={idTipoObs ? String(idTipoObs) : ""}
                                        onValueChange={(v) => setIdTipoObs(Number(v))}
                                        placeholder="Seleccionar tipo..."
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Criticidad</Label>
                                    <Combobox
                                        options={[
                                            { value: "null", label: "Sin clasificar" },
                                            ...CRITICALITY_LEVELS.map((c) => ({
                                                value: String(c.level),
                                                label: `${c.level} — ${c.label}`,
                                            })),
                                        ]}
                                        value={criticality == null ? "null" : String(criticality)}
                                        onValueChange={(v) => setCriticality(v === "null" || !v ? null : Number(v))}
                                        placeholder="Seleccionar criticidad..."
                                    />
                                </div>
                            </div>
                            <SheetFooter className="flex justify-end px-4">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>Cancelar</Button>
                                    <Button size="sm" onClick={handleSave} disabled={saving}>
                                        {saving ? "Guardando..." : "Guardar"}
                                    </Button>
                                </div>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>

                    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Archivar observación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    La observación <strong>{selected?.name}</strong> quedará archivada y dejará de aparecer en las listas.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" disabled={deleting} onClick={handleDelete}>
                                    {deleting ? "Archivando..." : "Archivar"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar observación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La observación <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
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
        </>
    );
};

export default ObsSec;
