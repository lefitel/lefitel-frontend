import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Col } from "../../../components/table/tableFeatures";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { desarchivarTramo, getTramosArchivados, type TramoConCifras } from "../../../api/Tramo.api";
import { mensajeDeError } from "../../../api/descarga";
import { Button } from "../../../components/ui/button";
import { RefreshCwIcon } from "lucide-react";
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
import DataTable from "../../../components/table/DataTable";
import { rowNumberColumn } from "../../../components/table/rowNumberColumn";
import { HeaderSlot } from "../../../components/HeaderSlot";
import EstadoTramos from "./EstadoTramos";

/**
 * The archived tramos, as a list. The live ones are not listed here or
 * anywhere like it: they are worked on the map (`red/RedPage`), which is the
 * other half of the Activos/Archivados pair in the header. An archived tramo
 * has no line to draw, so all there is to do with one is bring it back.
 */
export default function TramosArchivadosPage() {
  const { sesion } = useContext(SesionContext);
  const puedeArchivar = can(sesion.usuario.id_rol, "tramos", "archivar");
  const [tramos, setTramos] = useState<TramoConCifras[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objetivo, setObjetivo] = useState<TramoConCifras | null>(null);
  const [desarchivando, setDesarchivando] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTramosArchivados()
      .then((data) => setTramos(data))
      .catch(() => { toast.error("Error al cargar tramos archivados"); setTramos(null); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const desarchivar = async () => {
    if (!objetivo) return;
    setDesarchivando(true);
    try {
      await desarchivarTramo(objetivo.id);
      toast.success("Tramo desarchivado");
      setObjetivo(null);
      load();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo desarchivar el tramo"));
    } finally {
      setDesarchivando(false);
    }
  };

  const columns = useMemo<Col<TramoConCifras>[]>(() => [
    rowNumberColumn(),
    {
      accessorKey: "nombre",
      header: "Tramo",
      enableSorting: false,
      // Text, not a link: an archived tramo is not on the map to be opened.
      cell: ({ row }) => <span className="font-medium text-sm text-muted-foreground">{row.original.nombre}</span>,
    },
    {
      id: "departamento",
      accessorFn: (t) => t.departamento?.name ?? "",
      header: "Departamento",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.departamento?.name ?? "Sin departamento"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => puedeArchivar ? (
        <div className="flex justify-end pr-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setObjetivo(row.original)}>
            Desarchivar
          </Button>
        </div>
      ) : null,
    },
  ], [puedeArchivar]);

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
      <h1 className="sr-only">Tramos archivados</h1>
      <HeaderSlot>
        <EstadoTramos actual="archivados" />
      </HeaderSlot>

      <DataTable
        data={tramos}
        loading={loading}
        columns={columns}
        onRetry={load}
        actions={
          <Button variant="outline" size="icon-sm" aria-label="Refrescar" onClick={load} disabled={loading}>
            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <AlertDialog open={!!objetivo} onOpenChange={(v) => { if (!v) setObjetivo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desarchivar tramo?</AlertDialogTitle>
            <AlertDialogDescription>
              El tramo <strong>{objetivo?.nombre}</strong> volverá a aparecer en el mapa de tramos activos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desarchivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={desarchivando} onClick={desarchivar}>
              {desarchivando ? "Desarchivando..." : "Desarchivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
