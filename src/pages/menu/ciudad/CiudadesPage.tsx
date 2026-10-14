import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Col } from "../../../components/table/tableFeatures";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { deleteCiudad, desarchivarCiudad, getCiudad, type CiudadConCifras } from "../../../api/Ciudad.api";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { mensajeDeError } from "../../../api/descarga";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import CiudadSheet from "../../../components/dialogs/upsert/CiudadSheet";
import DataTable from "../../../components/table/DataTable";
import PermissionGuard from "../../../components/PermissionGuard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";
import { HeaderSlot } from "../../../components/HeaderSlot";
import { RowActionsTrigger } from "../../../components/table/RowActionsTrigger";

type Tab = "activos" | "archivados";

/** "hoy", "hace 5 días", "hace 3 semanas", "hace 4 meses" — coarser as it gets older. */
function haceCuanto(fecha: string): string {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000));
  if (dias === 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  const meses = Math.floor(dias / 30);
  if (meses < 24) return `hace ${meses} meses`;
  return `hace ${Math.floor(dias / 365)} años`;
}

/** "conecta con A, B y 3 más": two names, then a count, so the line stays one line. */
function conectaCon(nombres: string[]): string {
  if (nombres.length === 0) return "sin tramos";
  const [a, b, ...resto] = nombres;
  if (!b) return `conecta con ${a}`;
  if (resto.length === 0) return `conecta con ${a} y ${b}`;
  return `conecta con ${a}, ${b} y ${resto.length} más`;
}

function CiudadAvatar({ name, image, faded, onImageClick }: {
  name: string;
  image: string | null | undefined;
  faded?: boolean;
  onImageClick: (src: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgSrc = imageUrl(image);
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
  const [ciudades, setCiudades] = useState<CiudadConCifras[] | null>(null);
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
      await desarchivarCiudad(unarchiveTarget.id as number);
      toast.success("Ciudad desarchivada");
      setUnarchiveTarget(null);
      setArchivedCiudades(null); // fuerza reload al volver al tab
      load();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo desarchivar la ciudad"));
    } finally {
      setUnarchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCiudadTarget) return;
    setDeleting(true);
    try {
      await deleteCiudad(deleteCiudadTarget.id as number);
      toast.success("Ciudad archivada");
      setDeleteCiudadTarget(null);
      load();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo archivar la ciudad"));
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    getCiudad()
      .then((data) => setCiudades(data))
      .catch(() => { toast.error("Error al cargar las ciudades"); setCiudades(null); })
      .finally(() => setLoading(false));
  }, []);

  const loadArchived = useCallback(() => {
    setLoadingArchived(true);
    getCiudad(true)
      .then((data) => setArchivedCiudades(data))
      .catch(() => { toast.error("Error al cargar ciudades archivadas"); setArchivedCiudades(null); })
      .finally(() => setLoadingArchived(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "archivados" && archivedCiudades === null) loadArchived();
  }, [tab, archivedCiudades, loadArchived]);

  // The server sends each block of figures only to a role that could read it on
  // its own screen, so the columns are drawn on the same two answers.
  const verPostes = can(sesion.usuario.id_rol, "postes", "ver");
  const verEventos = can(sesion.usuario.id_rol, "eventos", "ver");

  const nombres = useMemo(
    () => new Map((ciudades ?? []).map((c) => [c.id as number, c.name])),
    [ciudades],
  );

  const columns = useMemo<Col<CiudadConCifras>[]>(() => [
    rowNumberColumn(),
    {
      accessorKey: "name",
      header: "Ciudad",
      cell: ({ row }) => {
        const vecinas = row.original.vecinas;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <CiudadAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
            <div className="min-w-0">
              <button
                className="font-medium text-sm text-primary hover:underline text-left"
                onClick={(e) => { e.stopPropagation(); navigate(`/app/ciudades/${row.original.id}`); }}
              >
                {row.original.name}
              </button>
              {vecinas && (
                <p className="text-xs text-muted-foreground truncate max-w-72">
                  {conectaCon(vecinas.flatMap((id) => nombres.get(id) ?? []))}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    ...(verPostes ? [
      {
        id: "tramos",
        accessorFn: (c) => c.vecinas?.length ?? 0,
        header: "Tramos",
        enableColumnFilter: false,
        cell: ({ row }) => {
          const n = row.original.vecinas?.length ?? 0;
          return <span className={`text-sm tabular-nums ${n ? "" : "text-muted-foreground"}`}>{n}</span>;
        },
      },
      {
        id: "postes",
        accessorFn: (c) => c.postes ?? 0,
        header: "Postes",
        enableColumnFilter: false,
        cell: ({ row }) => {
          const n = row.original.postes ?? 0;
          return <span className={`text-sm tabular-nums ${n ? "" : "text-muted-foreground"}`}>{n}</span>;
        },
      },
    ] satisfies Col<CiudadConCifras>[] : []),
    ...(verEventos ? [
      {
        id: "pendientes",
        accessorFn: (c) => c.pendientes ?? 0,
        header: "Eventos pendientes",
        enableColumnFilter: false,
        cell: ({ row }) => {
          const { pendientes = 0, prioritarios = 0, ultimoEvento } = row.original;
          if (pendientes === 0) {
            return <span className="text-xs text-muted-foreground">{ultimoEvento ? "Sin pendientes" : "—"}</span>;
          }
          return prioritarios > 0
            ? (
              <Badge className="bg-destructive/10 text-destructive border-transparent shadow-none text-xs tabular-nums">
                {pendientes} · {prioritarios} {prioritarios === 1 ? "prioritario" : "prioritarios"}
              </Badge>
            )
            : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs tabular-nums">{pendientes}</Badge>;
        },
      },
      {
        id: "ultimoEvento",
        accessorFn: (c) => (c.ultimoEvento ? new Date(c.ultimoEvento).getTime() : 0),
        header: "Última actividad",
        enableColumnFilter: false,
        cell: ({ row }) => {
          const fecha = row.original.ultimoEvento;
          return fecha
            ? (
              <span className="text-xs whitespace-nowrap" title={new Date(fecha).toLocaleDateString("es-ES")}>
                {haceCuanto(fecha)}
              </span>
            )
            : <span className="text-xs text-muted-foreground">—</span>;
        },
      },
    ] satisfies Col<CiudadConCifras>[] : []),
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
            <RowActionsTrigger />
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => navigate(`/app/ciudades/${row.original.id}`)}>
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
  ], [navigate, sesion.usuario.id_rol, verPostes, verEventos, nombres]);

  const archivedColumns = useMemo<Col<CiudadConCifras>[]>(() => [
    rowNumberColumn(),
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

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}
      className="@container/card p-page w-full space-y-page animate-in fade-in duration-500"
    >
      <h1 className="sr-only">Ciudades</h1>
      <HeaderSlot>
        <TabsList size="sm">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="archivados">Archivados</TabsTrigger>
        </TabsList>
      </HeaderSlot>

      {/* ── Tab Activos ── */}
      <TabsContent value="activos">
        <DataTable
          data={ciudades}
          loading={loading}
          columns={columns}
          onRetry={load}
          initialColumnVisibility={{ createdAt: false, updatedAt: false }}
          initialSorting={verEventos ? [{ id: "pendientes", desc: true }] : []}
          actions={<>
            <Button variant="outline" size="icon-sm" onClick={load} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {can(sesion.usuario.id_rol, "ciudades", "crear") && (
              <Button className="gap-2" aria-label="Nueva Ciudad" onClick={() => setOpenAdd(true)}>
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Ciudad</span>
              </Button>
            )}
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
            <Button variant="outline" size="icon-sm" onClick={loadArchived} disabled={loadingArchived}>
              <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
            </Button>
          }
        />
      </TabsContent>

      <PermissionGuard module="ciudades" action="crear" open={openAdd} onOpenChange={setOpenAdd}>
        <CiudadSheet open={openAdd} setOpen={setOpenAdd} onSuccess={load} />
      </PermissionGuard>
      <PermissionGuard module="ciudades" action="editar" open={!!editCiudad} onOpenChange={(v) => { if (!v) setEditCiudad(null); }}>
        <CiudadSheet
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
              className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
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
