import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { createMaterial, deleteMaterial, desarchivarMaterial, editMaterial, getMaterial } from "../../../api/Material.api";
import { MaterialInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
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

const MaterialSec = ({ innerTab }: Props) => {
    const { sesion } = useContext(SesionContext);
    const rol = sesion.usuario.id_rol;

    const [list, setList] = useState<MaterialInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<MaterialInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);
    const [selected, setSelected] = useState<MaterialInterface | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<MaterialInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const load = useCallback(() => {
        setLoading(true);
        getMaterial(sesion.token)
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar materiales"); setList(null); })
            .finally(() => setLoading(false));
    }, [sesion.token]);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getMaterial(sesion.token, true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar materiales archivados"); setArchivedList(null); })
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
            const result = await desarchivarMaterial(unarchiveTarget.id as number, sesion.token);
            if (result === 200) {
                toast.success("Material desarchivado");
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

    const openEdit = useCallback((row: MaterialInterface) => {
        setSelected(row);
        setName(row.name);
        setDescription(row.description);
        setSheetOpen(true);
    }, []);

    const openAdd = () => {
        setSelected(null);
        setName("");
        setDescription("");
        setSheetOpen(true);
    };

    const handleClose = () => { setSheetOpen(false); setSelected(null); };

    const handleSave = async () => {
        if (!name.trim() || !description.trim()) return toast.warning("Nombre y descripción son requeridos");
        setSaving(true);
        const payload: MaterialInterface = { ...selected, name, description };
        const result = await (selected?.id ? editMaterial(payload, sesion.token) : createMaterial(payload, sesion.token));
        if (Number(result) === 200 || Number(result) === 201) {
            toast.success(selected?.id ? "Material actualizado" : "Material creado");
            handleClose();
            load();
        } else {
            toast.error("No se pudo guardar");
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!selected?.id) return;
        setDeleting(true);
        const result = await deleteMaterial(selected.id as number, sesion.token);
        if (Number(result) === 200) {
            toast.success("Material archivado");
            setDeleteOpen(false);
            handleClose();
            load();
        } else {
            toast.error("No se pudo archivar");
        }
        setDeleting(false);
    };

    const columns = useMemo<ColumnDef<MaterialInterface>[]>(() => [
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "description", header: "Descripción" },
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

    const archivedColumns = useMemo<ColumnDef<MaterialInterface>[]>(() => [
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "description", header: "Descripción" },
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
                <DataTable
                    data={list}
                    loading={loading}
                    columns={columns}
                    onRetry={load}
                    hasPaginated={false}
                    actions={
                        can(rol, "parametros", "crear") ? (
                            <Button className="gap-2" onClick={openAdd}>
                                <PlusIcon className="h-4 w-4" />
                                Nuevo
                            </Button>
                        ) : <></>
                    }
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
                        <Button variant="outline" size="icon" onClick={loadArchived} disabled={loadingArchived}>
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
                                <SheetTitle>{selected?.id ? "Editar Material" : "Nuevo Material"}</SheetTitle>
                                <SheetDescription>Completa los campos y guarda los cambios.</SheetDescription>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="mat-name">Nombre</Label>
                                    <Input id="mat-name" value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="mat-desc">Descripción</Label>
                                    <Input id="mat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
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
                                <AlertDialogTitle>¿Archivar material?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    El material <strong>{selected?.name}</strong> quedará archivado y dejará de aparecer en las listas.
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
                        <AlertDialogTitle>¿Desarchivar material?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El material <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
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

export default MaterialSec;
