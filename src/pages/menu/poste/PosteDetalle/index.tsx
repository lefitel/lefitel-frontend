import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { getPosteByTramo, searchPoste } from "../../../../api/Poste.api";
import { CiudadInterface, EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "../../../../components/table/DataTable";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "../../../../components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { MoreVerticalIcon, PencilIcon, PlusIcon, RefreshCwIcon, ChevronRightIcon } from "lucide-react";
import EditPosteSheet from "../../../../components/dialogs/edits/EditPosteSheet";
import EditCiudadSheet from "../../../../components/dialogs/edits/EditCiudadSheet";
import PermissionGuard from "../../../../components/PermissionGuard";
import { fetchOrsRoute } from "../../../../lib/orsRoute";
import { usePosteDetalleData } from "./usePosteDetalleData";
import AddEventoSheet from "./AddEventoSheet";
import AddRevicionSheet from "./AddRevicionSheet";
import ResolverEventoSheet from "./ResolverEventoSheet";
import EditEventoSheet from "./EditEventoSheet";
import PosteDetalleKpis from "./PosteDetalleKpis";
import PosteDetalleInfo from "./PosteDetalleInfo";
import PosteDetalleMap from "./PosteDetalleMap";
import { daysOpen } from "../../inicio/helpers";

export default function PosteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const d = usePosteDetalleData(Number(id));
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);

  const [confirmReabrir, setConfirmReabrir] = useState<EventoInterface | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPosotes, setTramoPosotes] = useState<PosteInterface[]>([]);
  const [openEditCiudad, setOpenEditCiudad] = useState(false);
  const [selectedCiudad, setSelectedCiudad] = useState<CiudadInterface | null>(null);

  // Clear map state when navigating to a different poste
  useEffect(() => {
    setRoutePath([]);
    setTramoPosotes([]);
  }, [id]);

  useEffect(() => {
    if (!d.poste) return;
    const a = d.poste.ciudadA;
    const b = d.poste.ciudadB;
    if (!a?.lat || !a?.lng || !b?.lat || !b?.lng || !d.poste.lat || !d.poste.lng) return;

    getPosteByTramo(d.poste.id_ciudadA, d.poste.id_ciudadB, sesion.token)
      .then((postes) => {
        const dx = b.lat - a.lat;
        const dy = b.lng - a.lng;
        const sorted = postes
          .filter((p) => p.lat && p.lng)
          .sort(
            (p1, p2) =>
              (p1.lat - a.lat) * dx + (p1.lng - a.lng) * dy -
              ((p2.lat - a.lat) * dx + (p2.lng - a.lng) * dy)
          );

        setTramoPosotes(sorted);

        const fallback: [number, number][] = [
          [a.lat, a.lng],
          ...sorted.map((p): [number, number] => [p.lat, p.lng]),
          [b.lat, b.lng],
        ];
        const waypoints = [
          [a.lng, a.lat],
          ...sorted.map((p) => [p.lng, p.lat]),
          [b.lng, b.lat],
        ];
        const orsKey = import.meta.env.VITE_ORS_API_KEY as string;
        return fetchOrsRoute(waypoints, orsKey)
          .then((route) => setRoutePath(route ?? fallback))
          .catch(() => setRoutePath(fallback));
      })
      .catch(() => toast.warning("No se pudo calcular la ruta del tramo."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.poste?.id, sesion.token]);

  const total = d.eventos.length;
  const pendientes = d.eventos.filter((e) => !e.state).length;
  const resueltos = d.eventos.filter((e) => e.state).length;
  const tasa = total > 0 ? Math.round((resueltos / total) * 100) : 0;

  const hasCoords = (d.poste?.lat ?? 0) !== 0 && (d.poste?.lng ?? 0) !== 0;
  const boundsCoords: [number, number][] = [
    ...(d.poste?.ciudadA?.lat && d.poste.ciudadA.lng ? [[d.poste.ciudadA.lat, d.poste.ciudadA.lng] as [number, number]] : []),
    ...(d.poste?.ciudadB?.lat && d.poste.ciudadB.lng ? [[d.poste.ciudadB.lat, d.poste.ciudadB.lng] as [number, number]] : []),
    ...(hasCoords ? [[d.poste!.lat, d.poste!.lng] as [number, number]] : []),
    ...tramoPosotes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
  ];

  const handleEditarOtroPoste = useCallback(async (posteId: number) => {
    const p = await searchPoste(posteId, sesion.token);
    d.setDataPoste(p);
    d.setOpenEditPoste(true);
  }, [sesion.token, d]);

  const eventoColumns = useMemo<ColumnDef<EventoInterface>[]>(() => [
    {
      id: "descripcion",
      header: "Descripción",
      accessorKey: "description",
      cell: ({ row }) => (
        <span className="text-sm max-w-50 truncate block">{row.original.description}</span>
      ),
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorKey: "date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{daysOpen(row.original.date)}</span>
      ),
    },
    {
      id: "prioridad",
      header: "Prioridad",
      accessorKey: "priority",
      cell: ({ row }) => row.original.priority
        ? <Badge className="bg-amber-500/15 text-amber-600 border-transparent shadow-none text-xs">Alta</Badge>
        : <Badge variant="outline" className="text-xs text-muted-foreground">Normal</Badge>,
    },
    {
      id: "estado",
      header: "Estado",
      accessorKey: "state",
      cell: ({ row }) => row.original.state
        ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
        : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>,
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const evento = row.original;
        return (
          <div className="flex justify-end pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                <MoreVerticalIcon className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => navigate(`/eventos/${evento.id}`)}>
                  Ver detalle
                </DropdownMenuItem>
                {can(sesion.usuario.id_rol, "eventos", "editar") && !evento.state && (
                  <DropdownMenuItem onClick={() => d.setEditEventoId(evento.id as number)}>
                    Editar
                  </DropdownMenuItem>
                )}
                {can(sesion.usuario.id_rol, "eventos", "editar") && (
                  <>
                    <DropdownMenuSeparator />
                    {!evento.state ? (
                      <>
                        <DropdownMenuItem onClick={() => d.setAddRevicionEventoId(evento.id as number)}>
                          Agregar revisión
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => d.setResolverEvento(evento)} className="text-primary">
                          Resolver
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={() => setConfirmReabrir(evento)}>
                        Reabrir
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [d, navigate, sesion.usuario.id_rol, setConfirmReabrir]);

  return (
    <div className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {d.loading ? (
            <>
              <Skeleton className="h-7 w-40 mb-1" />
              <Skeleton className="h-4 w-56" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Poste {d.poste?.name ?? "—"}</h1>
              <p className="text-sm text-muted-foreground">
                Tramo: {d.poste?.ciudadA?.name ?? "—"} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" /> {d.poste?.ciudadB?.name ?? "—"}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {can(sesion.usuario.id_rol, "postes", "editar") && (
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => d.setOpenEditPoste(true)}
              disabled={d.loading || !d.poste}
            >
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={d.load} disabled={d.loading} className="h-8 w-8">
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <PosteDetalleKpis loading={d.loading} total={total} pendientes={pendientes} resueltos={resueltos} tasa={tasa} />

      {/* Info + Mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PosteDetalleInfo loading={d.loading} poste={d.poste} />
        <PosteDetalleMap
          loading={d.loading}
          poste={d.poste}
          tramoPosotes={tramoPosotes}
          routePath={routePath}
          boundsCoords={boundsCoords}
          onVerCiudad={(id) => navigate(`/ciudades/${id}`)}
          onEditarCiudad={(ciudad) => { setSelectedCiudad(ciudad); setOpenEditCiudad(true); }}
          onVerPoste={(id) => navigate(`/postes/${id}`)}
          onEditarOtroPoste={handleEditarOtroPoste}
          onEditarEstePoste={() => d.setOpenEditPoste(true)}
          canEditPostes={can(sesion.usuario.id_rol, "postes", "editar")}
          canEditCiudades={can(sesion.usuario.id_rol, "ciudades", "editar")}
        />
      </div>


      {/* Historial de Eventos */}
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historial de Eventos</CardTitle>
            {can(sesion.usuario.id_rol, "eventos", "crear") && (
              <Button
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                onClick={() => d.setAddEventoOpen(true)}
                disabled={d.loading || !d.poste}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Nuevo Evento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <DataTable
            data={d.eventos}
            loading={d.loading}
            columns={eventoColumns}
            hasOptions={false}
            hasPaginated={false}
            actions={<></>}
          />
        </CardContent>
      </Card>

      {/* Sheets */}
      <AddEventoSheet
        posteId={Number(id)}
        open={d.addEventoOpen}
        setOpen={d.setAddEventoOpen}
        onSuccess={d.load}
      />
      <PermissionGuard module="eventos" action="editar" open={d.addRevicionEventoId !== null} onOpenChange={(v) => { if (!v) d.setAddRevicionEventoId(null); }}>
        <AddRevicionSheet
          eventoId={d.addRevicionEventoId}
          open={d.addRevicionEventoId !== null}
          setOpen={(v) => { if (!v) d.setAddRevicionEventoId(null); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      <PermissionGuard module="eventos" action="editar" open={d.resolverEvento !== null} onOpenChange={(v) => { if (!v) d.setResolverEvento(null); }}>
        <ResolverEventoSheet
          evento={d.resolverEvento}
          open={d.resolverEvento !== null}
          setOpen={(v) => { if (!v) d.setResolverEvento(null); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      <PermissionGuard module="eventos" action="editar" open={d.editEventoId !== null} onOpenChange={(v) => { if (!v) d.setEditEventoId(null); }}>
        <EditEventoSheet
          eventoId={d.editEventoId}
          open={d.editEventoId !== null}
          setOpen={(v) => { if (!v) d.setEditEventoId(null); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      <PermissionGuard module="ciudades" action="editar" open={openEditCiudad} onOpenChange={(v) => { if (!v) setOpenEditCiudad(false); }}>
        <EditCiudadSheet
          ciudad={selectedCiudad}
          open={openEditCiudad}
          setOpen={(v) => { if (!v) setOpenEditCiudad(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      {d.dataPoste.id != null && (
        <PermissionGuard module="postes" action="editar" open={d.openEditPoste} onOpenChange={d.setOpenEditPoste}>
          <EditPosteSheet
            functionApp={d.load}
            poste={d.dataPoste}
            setPoste={d.setDataPoste}
            open={d.openEditPoste}
            setOpen={d.setOpenEditPoste}
          />
        </PermissionGuard>
      )}

      {/* Confirm reabrir */}
      <AlertDialog open={confirmReabrir !== null} onOpenChange={(o) => !o && setConfirmReabrir(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              El evento volverá a estado pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmReabrir(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmReabrir) {
                  await d.reabrirEvento(confirmReabrir);
                  setConfirmReabrir(null);
                }
              }}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
