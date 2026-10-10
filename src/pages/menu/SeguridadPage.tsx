import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Col } from "../../components/table/tableFeatures";
import { FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, MoreVerticalIcon, PlusIcon, RefreshCwIcon, MailCheckIcon, MailWarningIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";
import { SesionContext } from "../../context/SesionContext";
import { can } from "../../lib/permissions";
import { deleteUsuario, desarchivarUsuario, exportarUsuarios, getUsuario } from "../../api/Usuario.api";
import { mensajeDeError, mensajeDeErrorAsync, type FormatoDescarga } from "../../api/descarga";
import { imageUrl } from "../../lib/imageUrl";
import { UsuarioInterface } from "../../interfaces/interfaces";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import DataTable from "../../components/table/DataTable";
import UsuarioSheet from "../../components/dialogs/upsert/UsuarioSheet";
import PermissionGuard from "../../components/PermissionGuard";
import { ImageLightbox } from "../../components/ui/image-viewer";
import { maskEmail } from "../../lib/email";
import { nombreDeRol } from "../../lib/roles";
import { rowNumberColumn } from "../../components/table/rowNumberColumn";

// ─── helpers ──────────────────────────────────────────────────────────────────

function UsuarioAvatar({ name, image, onImageClick }: {
    name: string;
    image: string | null | undefined;
    onImageClick: (src: string) => void;
}) {
    const [loaded, setLoaded] = useState(false);
    const imgSrc = imageUrl(image);
    return (
        <Avatar
            className={loaded ? "cursor-zoom-in" : ""}
            onClick={loaded ? () => onImageClick(imgSrc!) : undefined}
        >
            {imgSrc && (
                <AvatarImage
                    src={imgSrc}
                    alt={name}
                    onLoad={() => setLoaded(true)}
                    onError={() => setLoaded(false)}
                />
            )}
            <AvatarFallback>{name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

const SeguridadPage = () => {
    const { sesion } = useContext(SesionContext);
    const rol = sesion.usuario.id_rol;

    const puedeAsignarRol = can(rol, "roles", "ver") && can(rol, "roles", "editar");

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    /** Which file is being built, or `null`. See the twin in the pole screen. */
    const [exportando, setExportando] = useState<FormatoDescarga | null>(null);

    const [list, setList] = useState<UsuarioInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<UsuarioInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);

    const [editUser, setEditUser] = useState<UsuarioInterface | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UsuarioInterface | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<UsuarioInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        getUsuario()
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar usuarios"); setList(null); })
            .finally(() => setLoading(false));
    }, []);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getUsuario(true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar usuarios archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        setDeleting(true);
        try {
            await deleteUsuario(deleteTarget.id as number);
            toast.success("Usuario archivado");
            setDeleteTarget(null);
            load();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo archivar"));
        } finally {
            setDeleting(false);
        }
    };

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            await desarchivarUsuario(unarchiveTarget.id as number);
            toast.success("Usuario desarchivado");
            setUnarchiveTarget(null);
            setArchivedList(null);
            load();
        } catch (error) {
            toast.error(mensajeDeError(error, "No se pudo desarchivar"));
        } finally {
            setUnarchiving(false);
        }
    };

    const navigate = useNavigate();

    const columns = useMemo<Col<UsuarioInterface>[]>(() => [
        rowNumberColumn(),
        {
            accessorKey: "image",
            header: "Foto",
            enableSorting: false,
            cell: ({ row }) => (
                <UsuarioAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
            ),
        },
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/usuarios/${row.original.id}`); }}
                >
                    {row.original.name}
                </button>
            ),
        },
        { accessorKey: "lastname", header: "Apellido" },
        { accessorKey: "user", header: "Usuario" },
        { accessorKey: "phone", header: "Teléfono" },
        {
            accessorKey: "id_rol",
            header: "Rol",
            // The role arrives with the account, and does not when it is
            // archived: then all there is to show is its number.
            cell: ({ row }) => row.original.rol ? nombreDeRol(row.original.rol) : `Rol #${row.original.id_rol}`,
        },
        {
            id: "recoveryEmail",
            header: "Correo de recuperación",
            enableSorting: false,
            /**
             * The reason this column exists: a saved-but-unverified address
             * is exactly as useless as none at all — `/password/forgot`
             * only ever acts on a verified one — and the mistake this catches
             * is invisible until the day it matters. An errata verified by
             * resend still passes as "verified" the moment it is set; it only
             * fails months later, when that mailbox closes and turns out to
             * be the only way back in. The badge is what lets an
             * administrator notice that risk across the whole staff at a
             * glance, without opening each account.
             *
             * Three states, distinguished by colour and icon and not merely
             * by text — the same visual language `PerfilPage.tsx` already
             * uses for the same three states on the account's own screen, so
             * "verified" means the same badge everywhere in the app. The
             * address itself is masked with `maskEmail`: enough for an
             * administrator to recognise it (or notice it looks wrong) without
             * this list becoming a directory of everyone's full recovery
             * address.
             */
            cell: ({ row }) => {
                const { email, email_verified_at } = row.original;
                if (!email) {
                    return (
                        <Badge variant="outline" className="text-muted-foreground shrink-0 font-normal">
                            Sin configurar
                        </Badge>
                    );
                }
                return (
                    <div className="flex items-center gap-1.5">
                        {email_verified_at ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shadow-none shrink-0 gap-1 font-normal">
                                <MailCheckIcon className="h-3 w-3" />
                                Verificado
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none shrink-0 gap-1 font-normal">
                                <MailWarningIcon className="h-3 w-3" />
                                Sin verificar
                            </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{maskEmail(email)}</span>
                    </div>
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
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                            <MoreVerticalIcon className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => navigate(`/app/usuarios/${row.original.id}`)}>
                                Ver detalle
                            </DropdownMenuItem>
                            {can(rol, "seguridad", "editar") && (
                                <DropdownMenuItem onClick={() => { setEditUser(row.original); setEditOpen(true); }}>
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {can(rol, "seguridad", "archivar") && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget(row.original)}
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
    ], [navigate, rol]);

    const archivedColumns = useMemo<Col<UsuarioInterface>[]>(() => [
        rowNumberColumn(),
        {
            accessorKey: "image",
            header: "Foto",
            enableSorting: false,
            cell: ({ row }) => (
                <UsuarioAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
            ),
        },
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "lastname", header: "Apellido" },
        { accessorKey: "user", header: "Usuario" },
        {
            accessorKey: "id_rol",
            header: "Rol",
            // The role arrives with the account, and does not when it is
            // archived: then all there is to show is its number.
            cell: ({ row }) => row.original.rol ? nombreDeRol(row.original.rol) : `Rol #${row.original.id_rol}`,
        },
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
            // Bringing an account back is the same permission as archiving
            // it, on the server as well. Offered to everybody who could see
            // the list, it asked for confirmation and then answered 403.
            cell: ({ row }) => can(rol, "seguridad", "archivar") && (
                <div className="flex justify-end pr-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUnarchiveTarget(row.original)}>
                        Desarchivar
                    </Button>
                </div>
            ),
        },
    ], [rol]);

    const hasData = !!list?.length;

    /**
     * Asks the server for the staff directory as a file.
     *
     * It sends no filters, and unlike its two siblings that is not a loss: this
     * screen filters and pages **in the browser**, so there is nothing on the
     * wire to pass on, and the button already produced the whole directory
     * rather than the filtered view. What is new is that the file says
     * "Listado completo" under its title instead of letting the reader assume
     * it was the rows they were looking at. The day this screen pages on the
     * server, the filters come here too.
     *
     * Seven columns arrive, chosen one by one on the server. The listing this
     * page reads sends seventeen — among them every account's recovery address
     * and which of them can still sign in without a second factor — and a
     * spreadsheet that gets forwarded is not a screen behind a session.
     */
    const exportar = async (formato: FormatoDescarga) => {
        if (exportando) return;
        setExportando(formato);
        try {
            const { blob, filename } = await exportarUsuarios(formato, innerTab === "archivados");
            saveAs(blob, filename);
        } catch (error) {
            toast.error(await mensajeDeErrorAsync(error, "No se pudo generar el fichero"));
        } finally {
            setExportando(null);
        }
    };

    return (
        <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gestión de usuarios del sistema</p>
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
                    onRetry={load}
                    hasPaginated={true}
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

                        <Button variant="outline" size="icon-sm" onClick={load} disabled={loading}>
                            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {/* Creating an account is also handing out a role, and
                            the server asks for that permission too — and the
                            form cannot list the roles without the one to see
                            them. Offered on `seguridad.crear` alone, the form
                            filled in whole, uploaded the photo, and was then
                            refused, with a critical line in the audit log
                            against somebody who had only used the button they
                            were given. So it is shown, held, and says what is
                            missing. */}
                        {can(rol, "seguridad", "crear") && (
                            <Button
                                className="gap-2"
                                aria-label="Nuevo Usuario"
                                onClick={() => setAddOpen(true)}
                                disabled={!puedeAsignarRol}
                                title={puedeAsignarRol
                                    ? undefined
                                    : "Crear una cuenta es también asignarle un rol: hace falta además el permiso de ver y editar roles."}
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo Usuario</span>
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
                    hasPaginated={true}
                    actions={
                        <Button variant="outline" size="icon-sm" onClick={loadArchived} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            <PermissionGuard module="seguridad" action="editar" open={editOpen} onOpenChange={setEditOpen}>
                <UsuarioSheet
                    usuario={editUser}
                    open={editOpen}
                    setOpen={setEditOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="seguridad" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <UsuarioSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El usuario <strong>{deleteTarget?.name} {deleteTarget?.lastname}</strong> quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
                            disabled={deleting}
                            onClick={handleDelete}
                        >
                            {deleting ? "Archivando..." : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El usuario <strong>{unarchiveTarget?.name} {unarchiveTarget?.lastname}</strong> volverá a aparecer en las listas activas.
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

            <ImageLightbox src={lightboxSrc ?? ""} open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </div>
    );
};

export default SeguridadPage;
