import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { SesionContext } from "../../context/SesionContext";
import { can } from "../../lib/permissions";
import {
  deleteFile,
  deleteOrphanFiles,
  getOrphanFiles,
  OrphanFileInfo,
} from "../../api/Files.api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
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
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import DataTable from "../../components/table/DataTable";

const TYPE_STYLES: Record<string, string> = {
  "Poste": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Evento": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Ciudad": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "Usuario": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Solución": "bg-green-500/10 text-green-600 border-green-500/20",
};

const TYPE_ROUTES: Partial<Record<string, (id: number) => string>> = {
  "Poste": (id) => `/postes/${id}`,
  "Evento": (id) => `/eventos/${id}`,
  "Solución": (id) => `/eventos/${id}`,
  "Ciudad": (id) => `/ciudades/${id}`,
  "Usuario": (id) => `/seguridad/${id}`,
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

  const load = () => {
    setLoading(true);
    getOrphanFiles(sesion.token)
      .then(setFiles)
      .catch(() => toast.error("No se pudo cargar el directorio de archivos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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

  return (
    <div className="@container/card p-6 md:p-8 w-full space-y-8 animate-in fade-in duration-500">

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestor de Archivos</h1>
        <p className="text-muted-foreground">Administre el almacenamiento en la nube, optimice espacio y depure archivos huérfanos del sistema.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total en Disco</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <HardDriveIcon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{files.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Ocupando {formatSize(totalSize)} de volumen.</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-500/20 transition-all hover:shadow-md hover:border-amber-500/40 relative overflow-hidden">
          {orphans.length > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-amber-500/80" />}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos Huérfanos</CardTitle>
            <div className={`p-2 rounded-full ${orphans.length > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
              <AlertTriangleIcon className={`h-4 w-4 ${orphans.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${orphans.length > 0 ? "text-amber-600" : "text-foreground"}`}>{orphans.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{formatSize(orphanSize)} recuperables</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/20 transition-all hover:shadow-md hover:border-primary/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary/80" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archivos En Uso</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <CheckCircle2Icon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{files.length - orphans.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{formatSize(totalSize - orphanSize)} vinculados activamente</p>
          </CardContent>
        </Card>
      </div>

      {/* DataTable */}
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
              <Button
                variant="destructive"
                disabled={deletingOrphans}
                onClick={() => setOrphansDialogOpen(true)}
                className="gap-2 h-8"
              >
                {deletingOrphans ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
                Purgar {orphans.length} huérfano{orphans.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        }
      />

      {/* Lightbox */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setPreviewFile(null)}
        >
          <img
            src={url + previewFile.name}
            alt={previewFile.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Dialog: eliminar huérfanos */}
      <AlertDialog open={orphansDialogOpen} onOpenChange={setOrphansDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todos los archivos huérfanos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {orphans.length} archivos ({formatSize(orphanSize)}) que no están
              vinculados a ningún registro. Esta acción no se puede deshacer.
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
            <AlertDialogAction onClick={() => fileToDelete && handleDeleteFile(fileToDelete.name)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FilesPage;
