import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Col } from "../../../components/table/tableFeatures";
import { MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { createPropietario, deletePropietario, desarchivarPropietario, editPropietario, getPropietario, getPropietarioStats, PropietarioStats } from "../../../api/Propietario.api";
import { PropietarioInterface } from "../../../interfaces/interfaces";
import { ParametrosKpiCards } from "./ParametrosKpiCards";
import { Building2Icon, MapPinIcon, AlertTriangleIcon } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import FormDialog from "../../../components/dialogs/FormDialog";
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
import { useRegistroEnlazado, type RegistroEnlazado } from "./useRegistroEnlazado";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";
import { mensajeDeError } from "../../../api/descarga";

interface Props {
    innerTab: InnerTab;
    /** The record the address asks for, when it is one of this catalogue's. */
    enlace?: RegistroEnlazado;
}

const PropietarioSec = ({ innerTab, enlace }: Props) => {
    const { sesion } = useContext(SesionContext);
    const rol = sesion.usuario.id_rol;

    const [list, setList] = useState<PropietarioInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<PropietarioInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);
    const [selected, setSelected] = useState<PropietarioInterface | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<PropietarioInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const [name, setName] = useState("");
    const [stats, setStats] = useState<PropietarioStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const loadStats = useCallback(() => {
        setStatsLoading(true);
        getPropietarioStats()
            .then(setStats)
            .catch(() => setStats(null))
            .finally(() => setStatsLoading(false));
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    const load = useCallback(() => {
        setLoading(true);
        getPropietario()
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar propietarios"); setList(null); })
            .finally(() => setLoading(false));
    }, []);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getPropietario(true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar propietarios archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            await desarchivarPropietario(unarchiveTarget.id as number);
            toast.success("Propietario desarchivado");
            setUnarchiveTarget(null);
            setArchivedList(null);
            load();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo desarchivar"));
        } finally {
            setUnarchiving(false);
        }
    };

    const openEdit = useCallback((row: PropietarioInterface) => {
        setSelected(row);
        setName(row.name);
        setSheetOpen(true);
    }, []);

    useRegistroEnlazado({
        enlace, activos: list, archivados: archivedList,
        abrir: can(rol, "parametros", "editar") ? openEdit : undefined,
    });

    const openAdd = () => {
        setSelected(null);
        setName("");
        setSheetOpen(true);
    };

    const handleClose = () => { setSheetOpen(false); setSelected(null); };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        const payload: PropietarioInterface = { ...selected, name };
        try {
            await (selected?.id ? editPropietario(payload) : createPropietario(payload));
            toast.success(selected?.id ? "Propietario actualizado" : "Propietario creado");
            handleClose();
            load();
            loadStats();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo guardar"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selected?.id) return;
        setDeleting(true);
        try {
            await deletePropietario(selected.id as number);
            toast.success("Propietario archivado");
            setDeleteOpen(false);
            handleClose();
            load();
            loadStats();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo archivar"));
        } finally {
            setDeleting(false);
        }
    };

    const columns = useMemo<Col<PropietarioInterface>[]>(() => [
        rowNumberColumn(),
        { accessorKey: "name", header: "Nombre" },
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
    ], [openEdit, rol]);

    const archivedColumns = useMemo<Col<PropietarioInterface>[]>(() => [
        rowNumberColumn(),
        { accessorKey: "name", header: "Nombre" },
        {
            accessorKey: "deletedAt",
            header: "Archivado el",
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
                            label: "Total propietarios",
                            value: stats?.total ?? 0,
                            hint: "Empresas registradas",
                            icon: Building2Icon,
                            tone: "default",
                        },
                        {
                            label: "Más postes",
                            value: stats?.mostPostes?.count ?? 0,
                            hint: stats?.mostPostes?.name ?? "Sin postes asignados",
                            icon: MapPinIcon,
                            tone: "info",
                        },
                        {
                            label: "Más pendientes",
                            value: stats?.mostPendientes?.count ?? 0,
                            hint: stats?.mostPendientes?.name ?? "Sin incidencias",
                            icon: AlertTriangleIcon,
                            tone: (stats?.mostPendientes?.count ?? 0) > 0 ? "warning" : "success",
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
                                <span className="hidden sm:inline">Nuevo</span>
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
                    <FormDialog
                        open={sheetOpen}
                        onClose={handleClose}
                        size="sm"
                        title={selected?.id ? "Editar Propietario" : "Nuevo Propietario"}
                        description="Se elige al registrar un poste."
                        dirty={name !== (selected?.name ?? "")}
                        missing={[!name.trim() && "Nombre"].filter((c): c is string => !!c)}
                        saving={saving}
                        submitLabel={selected?.id ? "Guardar cambios" : "Crear propietario"}
                        onSubmit={handleSave}
                        bodyClassName="flex flex-col gap-4"
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="prop-name">Nombre <span className="text-destructive">*</span></Label>
                            <Input id="prop-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                    </FormDialog>

                    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Archivar propietario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    El propietario <strong>{selected?.name}</strong> quedará archivado y dejará de aparecer en las listas.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive-fill hover:bg-destructive-fill/90 text-white" disabled={deleting} onClick={handleDelete}>
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
                        <AlertDialogTitle>¿Desarchivar propietario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El propietario <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
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

export default PropietarioSec;
