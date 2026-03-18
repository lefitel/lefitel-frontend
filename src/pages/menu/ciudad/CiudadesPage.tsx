import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { deleteCiudad, desarchivarCiudad, getCiudad } from "../../../api/Ciudad.api";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Button } from "../../../components/ui/button";
import { MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import AddCiudadSheet from "../../../components/dialogs/add/AddCiudadSheet";
import EditCiudadSheet from "../../../components/dialogs/edits/EditCiudadSheet";
import DataTable from "../../../components/table/DataTable";
import PermissionGuard from "../../../components/PermissionGuard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";

type Tab = "activos" | "archivados";

function CiudadAvatar({ name, image, faded, onImageClick }: {
  name: string;
  image: string | null | undefined;
  faded?: boolean;
  onImageClick: (src: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgSrc = image ? `${url}${image}` : null;
  return (
    <Avatar
      className={`${faded ? "opacity-60" : ""}${loaded ? " cursor-zoom-in" : ""}`}
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

export default function CiudadesPage() {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const [ciudades, setCiudades] = useState<CiudadInterface[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [archivedCiudades, setArchivedCiudades] = useState<CiudadInterface[] | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [tab, setTab] = useState<Tab>("activos");
  const [editCiudad, setEditCiudad] = useState<CiudadInterface | null>(null);
  const [deleteCiudadTarget, setDeleteCiudadTarget] = useState<CiudadInterface | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unarchiveTarget, setUnarchiveTarget] = useState<CiudadInterface | null>(null);
  const [unarchiving, setUnarchiving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleUnarchive = async () => {
    if (!unarchiveTarget) return;
    setUnarchiving(true);
    try {
      const result = await desarchivarCiudad(unarchiveTarget.id as number, sesion.token);
      if (result === 200) {
        toast.success("Ciudad desarchivada");
        setUnarchiveTarget(null);
        setArchivedCiudades(null); // fuerza reload al volver al tab
        load();
      } else {
        toast.error("No se pudo desarchivar la ciudad");
      }
    } finally {
      setUnarchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCiudadTarget) return;
    setDeleting(true);
    try {
      const result = await deleteCiudad(deleteCiudadTarget.id as number, sesion.token);
      if (result === 200) {
        toast.success("Ciudad archivada");
        setDeleteCiudadTarget(null);
        load();
      } else {
        toast.error("No se pudo archivar la ciudad");
      }
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    getCiudad(sesion.token)
      .then((data) => setCiudades(data))
      .catch(() => { toast.error("Error al cargar las ciudades"); setCiudades(null); })
      .finally(() => setLoading(false));
  }, [sesion.token]);

  const loadArchived = useCallback(() => {
    setLoadingArchived(true);
    getCiudad(sesion.token, true)
      .then((data) => setArchivedCiudades(data))
      .catch(() => { toast.error("Error al cargar ciudades archivadas"); setArchivedCiudades(null); })
      .finally(() => setLoadingArchived(false));
  }, [sesion.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "archivados" && archivedCiudades === null) loadArchived();
  }, [tab, archivedCiudades, loadArchived]);

  const columns = useMemo<ColumnDef<CiudadInterface>[]>(() => [
    {
      accessorKey: "image",
      header: "Foto",
      enableSorting: false,
      cell: ({ row }) => (
        <CiudadAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
      ),
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <button
          className="font-medium text-sm text-primary hover:underline text-left"
          onClick={(e) => { e.stopPropagation(); navigate(`/ciudades/${row.original.id}`); }}
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Registrada",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString("es-ES")
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Última edición",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.updatedAt
            ? new Date(row.original.updatedAt).toLocaleDateString("es-ES")
            : "—"}
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
              <DropdownMenuItem onClick={() => navigate(`/ciudades/${row.original.id}`)}>
                Ver detalle
              </DropdownMenuItem>
              {can(sesion.usuario.id_rol, "ciudades", "editar") && (
                <DropdownMenuItem onClick={() => setEditCiudad(row.original)}>
                  Editar
                </DropdownMenuItem>
              )}
              {can(sesion.usuario.id_rol, "ciudades", "archivar") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteCiudadTarget(row.original)}
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
  ], [navigate, sesion.usuario.id_rol]);

  const archivedColumns = useMemo<ColumnDef<CiudadInterface>[]>(() => [
    {
      accessorKey: "image",
      header: "Foto",
      enableSorting: false,
      cell: ({ row }) => (
        <CiudadAvatar name={row.original.name} image={row.original.image} faded onImageClick={setLightboxSrc} />
      ),
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <span className="font-medium text-sm text-muted-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "deletedAt",
      header: "Archivada el",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {row.original.deletedAt
            ? new Date(row.original.deletedAt).toLocaleDateString("es-ES")
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end pr-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUnarchiveTarget(row.original)}
          >
            Desarchivar
          </Button>
        </div>
      ),
    },
  ], []);

  const ciudadesList = ciudades ?? [];

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}
      className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ciudades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nodos de red — {loading ? "…" : ciudadesList.length} ciudades registradas
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="archivados">Archivados</TabsTrigger>
        </TabsList>
      </div>

      {/* ── Tab Activos ── */}
      <TabsContent value="activos">
        <DataTable
          data={ciudades}
          loading={loading}
          columns={columns}
          onRetry={load}
          actions={<>
            {can(sesion.usuario.id_rol, "ciudades", "crear") && (
              <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setOpenAdd(true)}>
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Ciudad</span>
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </>}
        />
      </TabsContent>

      {/* ── Tab Archivados ── */}
      <TabsContent value="archivados">
        <DataTable
          data={archivedCiudades}
          loading={loadingArchived}
          columns={archivedColumns}
          onRetry={loadArchived}
          actions={
            <Button variant="outline" size="icon" onClick={loadArchived} disabled={loadingArchived}>
              <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
            </Button>
          }
        />
      </TabsContent>

      <PermissionGuard module="ciudades" action="crear" open={openAdd} onOpenChange={setOpenAdd}>
        <AddCiudadSheet open={openAdd} setOpen={setOpenAdd} onSuccess={load} />
      </PermissionGuard>
      <PermissionGuard module="ciudades" action="editar" open={!!editCiudad} onOpenChange={(v) => { if (!v) setEditCiudad(null); }}>
        <EditCiudadSheet
          ciudad={editCiudad}
          open={!!editCiudad}
          setOpen={(v) => { if (!v) setEditCiudad(null); }}
          onSuccess={load}
        />
      </PermissionGuard>

      <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desarchivar ciudad?</AlertDialogTitle>
            <AlertDialogDescription>
              La ciudad <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
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

      <AlertDialog open={!!deleteCiudadTarget} onOpenChange={(v) => { if (!v) setDeleteCiudadTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar ciudad?</AlertDialogTitle>
            <AlertDialogDescription>
              La ciudad <strong>{deleteCiudadTarget?.name}</strong> quedará archivada y dejará de aparecer en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Archivando..." : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageLightbox
        src={lightboxSrc ?? ""}
        open={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </Tabs>
  );
}
