import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { SesionContext } from "../../context/SesionContext";
import { can } from "../../lib/permissions";
import {
  deleteFile,
  deleteOrphanFiles,
  getOrphanFiles,
  getEntityImageStats,
  getBrokenImageRefs,
  clearBrokenImageRefs,
  OrphanFileInfo,
  EntityImageStats,
  BrokenRef,
} from "../../api/Files.api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { ParametrosKpiCards } from "./parametros/ParametrosKpiCards";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { url } from "../../api/url";
import { toast } from "sonner";
import {
  Trash2Icon,
  CheckCircle2Icon,
  RefreshCwIcon,
  ImageIcon,
  AlertTriangleIcon,
  HardDriveIcon,
  ZoomInIcon,
  MoreVerticalIcon,
  LinkIcon,
  ImageOffIcon,
  ImageIcon as ImageCheckIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import DataTable from "../../components/table/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

const TYPE_STYLES: Record<string, string> = {
  "Poste": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Evento": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Ciudad": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "Usuario": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Solución": "bg-green-500/10 text-green-600 border-green-500/20",
};

const TYPE_ROUTES: Partial<Record<string, (id: number) => string>> = {
  "Poste": (id) => `/app/postes/${id}`,
  "Evento": (id) => `/app/eventos/${id}`,
  "Solución": (id) => `/app/eventos/${id}`,
  "Ciudad": (id) => `/app/ciudades/${id}`,
  "Usuario": (id) => `/app/seguridad/${id}`,
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const FilesPage = () => {
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const [files, setFiles] = useState<OrphanFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [orphansDialogOpen, setOrphansDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<OrphanFileInfo | null>(null);
  const [previewFile, setPreviewFile] = useState<OrphanFileInfo | null>(null);

  const [entityStats, setEntityStats] = useState<EntityImageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [brokenRefs, setBrokenRefs] = useState<BrokenRef[]>([]);
  const [brokenLoading, setBrokenLoading] = useState(true);
  const [clearingBroken, setClearingBroken] = useState(false);
  const [clearBrokenDialogOpen, setClearBrokenDialogOpen] = useState(false);

  const load = () => {
    setLoading(true);
    getOrphanFiles(sesion.token)
      .then(setFiles)
      .catch(() => toast.error("No se pudo cargar el directorio de archivos"))
      .finally(() => setLoading(false));
  };

  const loadStats = () => {
    setStatsLoading(true);
    setBrokenLoading(true);
    getEntityImageStats(sesion.token)
      .then(setEntityStats)
      .catch(() => toast.error("No se pudo cargar estadísticas de entidades"))
      .finally(() => setStatsLoading(false));
    getBrokenImageRefs(sesion.token)
      .then(setBrokenRefs)
      .catch(() => toast.error("No se pudo cargar referencias rotas"))
      .finally(() => setBrokenLoading(false));
  };

  const handleClearBroken = async () => {
    setClearingBroken(true);
    try {
      const { cleared } = await clearBrokenImageRefs(sesion.token);
      toast.success(`${cleared} referencia${cleared !== 1 ? "s" : ""} limpiada${cleared !== 1 ? "s" : ""}`);
      setClearBrokenDialogOpen(false);
      loadStats();
    } catch {
      toast.error("No se pudieron limpiar las referencias");
    } finally {
      setClearingBroken(false);
    }
  };

  useEffect(() => {
    load();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteFile = async (name: string) => {
    setDeletingName(name);
    await deleteFile(name, sesion.token);
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setDeletingName(null);
    setFileToDelete(null);
  };

  const handleDeleteOrphans = async () => {
    setDeletingOrphans(true);
    await deleteOrphanFiles(sesion.token);
    setDeletingOrphans(false);
    setOrphansDialogOpen(false);
    load();
  };

  const orphans = files.filter((f) => f.isOrphan);
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const orphanSize = orphans.reduce((acc, f) => acc + f.size, 0);

  const columns = useMemo<ColumnDef<OrphanFileInfo>[]>(() => [
    {
      id: "preview",
      header: "Vista previa",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-center items-center py-1">
          <div className="w-12 h-12 bg-muted/50 rounded-lg overflow-hidden border shadow-sm flex items-center justify-center relative group/thumb cursor-zoom-in"
            onClick={() => setPreviewFile(row.original)}>
            <img
              src={url + row.original.name}
              alt={row.original.name}
              className="h-full w-full rounded-md object-cover transition-transform group-hover/thumb:scale-110"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = "none";
                img.nextElementSibling?.classList.remove("hidden");
              }}
            />
            <ImageIcon className="hidden h-5 w-5 text-muted-foreground/50 absolute" />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center rounded-md">
              <ZoomInIcon className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-mono text-sm max-w-65 truncate">
          <ImageIcon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <span className="truncate">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "size",
      header: "Peso",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono bg-background">
          {formatSize(row.original.size)}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Fecha creación",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("es", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      accessorKey: "isOrphan",
      header: "Estado",
      enableColumnFilter: false,
      cell: ({ row }) => {
        const file = row.original;
        if (file.isOrphan || !file.usedBy) {
          return (
            <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none border-transparent">
              Huérfano
            </Badge>
          );
        }
        const style = TYPE_STYLES[file.usedBy.type] ?? "bg-muted text-foreground border-muted";
        const routeFn = TYPE_ROUTES[file.usedBy.type];
        return (
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold truncate max-w-48 ${style} ${routeFn ? "cursor-pointer hover:brightness-110 transition-all" : ""}`}
            onClick={routeFn ? () => navigate(routeFn(file.usedBy!.id)) : undefined}
          >
            {file.usedBy.type} · {file.usedBy.name}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => !can(rol, "archivos", "archivar") ? null : (
        <div className="flex justify-end pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
              <MoreVerticalIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={deletingName === row.original.name || !row.original.isOrphan}
                onClick={() => setFileToDelete(row.original)}
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deletingName, navigate]);

  const brokenColumns = useMemo<ColumnDef<BrokenRef>[]>(() => [
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => (
        <Badge className={`shadow-none ${TYPE_STYLES[row.original.tipo] ?? "bg-muted text-foreground border-muted"}`}>
          {row.original.tipo}
        </Badge>
      ),
    },
    {
      accessorKey: "name",
      header: "Entidad",
      cell: ({ row }) => {
        const routeFn = TYPE_ROUTES[row.original.tipo];
        return routeFn ? (
          <button
            className="text-sm font-medium text-primary hover:underline text-left"
            onClick={() => navigate(routeFn(row.original.id))}
          >
            {row.original.name}
          </button>
        ) : (
          <span className="text-sm font-medium">{row.original.name}</span>
        );
      },
    },
    {
      accessorKey: "image",
      header: "Ruta en BD",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.image}</span>
      ),
    },
  ], [navigate]);

  const totalBroken = brokenRefs.length;

  return (
    <Tabs defaultValue="archivos" className="@container/card pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestor de Archivos</h1>
          <p className="text-sm text-muted-foreground mt-1">Administre el almacenamiento, depure huérfanos y revise la cobertura de imágenes.</p>
        </div>
        <TabsList>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
          <TabsTrigger value="cobertura" className="relative">
            Cobertura
            {totalBroken > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold h-4 min-w-4 px-1">
                {totalBroken}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* ── Tab Archivos ── */}
      <TabsContent value="archivos" className="space-y-6">
        <ParametrosKpiCards
          loading={loading}
          items={[
            {
              label: "Total en Disco",
              value: files.length,
              hint: `Ocupando ${formatSize(totalSize)} de volumen`,
              icon: HardDriveIcon,
              tone: "default",
            },
            {
              label: "Archivos Huérfanos",
              value: orphans.length,
              hint: `${formatSize(orphanSize)} recuperables`,
              icon: AlertTriangleIcon,
              tone: orphans.length > 0 ? "warning" : "default",
            },
            {
              label: "Archivos En Uso",
              value: files.length - orphans.length,
              hint: `${formatSize(totalSize - orphanSize)} vinculados activamente`,
              icon: CheckCircle2Icon,
              tone: "success",
            },
          ]}
        />

        <DataTable
          data={files}
          loading={loading}
          columns={columns}
          getRowId={(f) => f.name}
          onRetry={load}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={load} disabled={loading} className="gap-2 h-8">
                <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
              {orphans.length > 0 && can(rol, "archivos", "archivar") && (
                <Button variant="destructive" disabled={deletingOrphans} onClick={() => setOrphansDialogOpen(true)} className="gap-2 h-8">
                  {deletingOrphans ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">Purgar {orphans.length} huérfano{orphans.length > 1 ? "s" : ""}</span>
                </Button>
              )}
            </div>
          }
        />
      </TabsContent>

      {/* ── Tab Cobertura ── */}
      <TabsContent value="cobertura" className="space-y-6">

        {/* Cards por entidad */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Cobertura de imágenes</h2>
              <p className="text-sm text-muted-foreground">Entidades sin imagen asignada o con referencia rota en disco.</p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadStats} disabled={statsLoading || brokenLoading}>
              <RefreshCwIcon className={`h-4 w-4 ${statsLoading || brokenLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(["postes", "eventos", "ciudades", "usuarios", "soluciones"] as const).map((key) => {
              const labels: Record<string, string> = { postes: "Postes", eventos: "Eventos", ciudades: "Ciudades", usuarios: "Usuarios", soluciones: "Soluciones" };
              const stat = entityStats?.[key];
              const hasBroken = (stat?.referenciaRota ?? 0) > 0;
              return (
                <Card key={key} className={`relative shadow-sm py-0 overflow-hidden transition-all duration-300 ease-out hover:shadow-md ${hasBroken ? "border-destructive/30" : "border-muted/60"}`}>
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${hasBroken ? "bg-destructive/70" : "bg-primary/40"}`} />
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">{labels[key]}</p>
                    {statsLoading ? (
                      <div className="space-y-1.5">
                        <div className="h-7 w-12 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl font-bold"><AnimatedNumber value={stat?.total ?? 0} /></p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <ImageCheckIcon className="h-3 w-3 text-green-600/60 shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {(stat?.total ?? 0) - (stat?.sinImagen ?? 0) - (stat?.referenciaRota ?? 0)} con imagen
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ImageOffIcon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-xs text-muted-foreground">{stat?.sinImagen ?? 0} sin imagen</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className={`h-3 w-3 shrink-0 ${hasBroken ? "text-destructive" : "text-muted-foreground/60"}`} />
                            <span className={`text-xs ${hasBroken ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {stat?.referenciaRota ?? 0} ref. rota{(stat?.referenciaRota ?? 0) !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Referencias rotas */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Referencias rotas</h2>
            <p className="text-sm text-muted-foreground">
              Entidades con ruta de imagen en BD pero el archivo no existe en disco.
            </p>
          </div>
          <DataTable
            data={brokenLoading ? null : brokenRefs}
            loading={brokenLoading}
            columns={brokenColumns}
            getRowId={(r) => `${r.tipo}-${r.id}`}
            onRetry={loadStats}
            actions={
              can(rol, "archivos", "archivar") && totalBroken > 0 ? (
                <Button variant="destructive" className="gap-2 h-8" disabled={clearingBroken} onClick={() => setClearBrokenDialogOpen(true)}>
                  {clearingBroken ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">Limpiar {totalBroken}</span>
                </Button>
              ) : <></>
            }
          />
        </div>
      </TabsContent>

      {/* Lightbox */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out" onClick={() => setPreviewFile(null)}>
          <img src={url + previewFile.name} alt={previewFile.name} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Dialog: limpiar referencias rotas */}
      <AlertDialog open={clearBrokenDialogOpen} onOpenChange={setClearBrokenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar referencias rotas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se pondrá <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">image = null</code> en {totalBroken} entidad{totalBroken !== 1 ? "es" : ""} cuyo archivo ya no existe en disco. Los avatares mostrarán su inicial o un placeholder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingBroken}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" disabled={clearingBroken} onClick={handleClearBroken}>
              {clearingBroken ? "Limpiando..." : "Limpiar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: eliminar huérfanos */}
      <AlertDialog open={orphansDialogOpen} onOpenChange={setOrphansDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todos los archivos huérfanos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {orphans.length} archivos ({formatSize(orphanSize)}) que no están vinculados a ningún registro. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrphans}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: eliminar archivo individual */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open: boolean) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{fileToDelete?.name}</span>
              {fileToDelete && !fileToDelete.isOrphan && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠ Este archivo está en uso por un registro. Eliminarlo podría romper imágenes en la app.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => fileToDelete && handleDeleteFile(fileToDelete.name)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
};

export default FilesPage;
