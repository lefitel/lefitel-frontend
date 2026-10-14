import { hasCoords, type LatLng } from "../../../../components/map/mapGeo";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useTrailLabel } from "../../../../components/TrailLabel";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { getPostesDelTramo, searchPoste } from "../../../../api/Poste.api";
import { CiudadInterface, PosteInterface } from "../../../../interfaces/interfaces";
import PosteSheet from "../../../../components/dialogs/upsert/PosteSheet";
import CiudadSheet from "../../../../components/dialogs/upsert/CiudadSheet";
import PermissionGuard from "../../../../components/PermissionGuard";
import { fetchOrsRoute } from "../../../../lib/orsRoute";
import { ordenarTramo } from "../../../../lib/tramoOrden";
import { extremosDibujables } from "../../../../lib/tramo";
import { usePosteDetalleData } from "./usePosteDetalleData";
import EventoSheet from "../../../../components/dialogs/upsert/EventoSheet";
import AddRevisionSheet from "../../../../components/dialogs/AddRevisionSheet";
import ResolverEventoSheet from "../../../../components/dialogs/ResolverEventoSheet";
import PosteDetalleHeader from "./PosteDetalleHeader";
import PosteDetalleInfo, { PosteDetalleFoto } from "./PosteDetalleInfo";
import PosteDetalleMap from "./PosteDetalleMap";
import PosteDetalleHistorial from "./PosteDetalleHistorial";
import PosteDetalleRail from "./PosteDetalleRail";
import { VISTA_PANEL_ID, vistaTabId, type VistaPoste } from "./posteVistas";
import PosteDetalleEventosAbiertos, { EventoActionHandlers } from "./PosteDetalleEventosAbiertos";
import { computeMetrics } from "./posteHealth";
import { Card } from "../../../../components/ui/card";

export default function PosteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  // Incidents are a second permission. Without it the sheet still opens: it
  // does not ask for them and does not draw the two blocks made of them.
  const verEventos = can(sesion.usuario.id_rol, "eventos", "ver");
  const d = usePosteDetalleData(Number(id), { verEventos });
  // The trail in the app's header knows this pole by its number; this is its name.
  useTrailLabel(d.poste?.name ? `Poste ${d.poste.name}` : null);

  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPosotes, setTramoPosotes] = useState<PosteInterface[]>([]);
  const [extremos, setExtremos] = useState<LatLng[]>([]);
  const [openEditCiudad, setOpenEditCiudad] = useState(false);
  const [vista, setVista] = useState<VistaPoste>("resumen");
  const [selectedCiudad, setSelectedCiudad] = useState<CiudadInterface | null>(null);

  // The stretch is asked for once per stretch, not once per pole. It used to be
  // cleared and fetched again on every pole — its poles, and the road route
  // from the routing service — so stepping to a neighbour wiped the line and
  // drew the very same one a moment later.
  const tramoKey = d.poste?.id_tramo ?? null;

  useEffect(() => {
    setRoutePath([]);
    setTramoPosotes([]);
    setExtremos([]);

    const idTramo = d.poste?.id_tramo;
    if (!idTramo) return;
    // An end with no position stays missing in its own slot: the line is then
    // ordered and drawn from the other one alone.
    const [uno, dos] = extremosDibujables(d.poste?.tramo);

    // A stretch that answers after the person has moved to another must not
    // draw itself over the one now on screen.
    let vigente = true;
    getPostesDelTramo(idTramo)
      .then((postes) => {
        if (!vigente) return;
        const tramo = ordenarTramo(postes, uno, dos);
        setTramoPosotes(tramo.postes);
        setExtremos([tramo.inicio, tramo.fin].filter((c) => c !== null));
        return fetchOrsRoute(tramo.waypoints)
          .then((route) => { if (vigente) setRoutePath(route ?? tramo.linea); })
          .catch(() => { if (vigente) setRoutePath(tramo.linea); });
      })
      .catch(() => { if (vigente) toast.warning("No se pudo calcular la ruta del tramo."); });
    return () => { vigente = false; };
  // Keyed by the tramo: the pole itself is read only for its ends.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramoKey]);

  const located = hasCoords(d.poste);
  // The cities the line reaches, not the tramo's two cities as stored: one kept
  // at a placeholder position would stretch "Ver tramo" across half the globe.
  const boundsCoords: [number, number][] = [
    ...extremos.map((c): [number, number] => [c.lat, c.lng]),
    ...(located ? [[d.poste!.lat, d.poste!.lng] as [number, number]] : []),
    ...tramoPosotes.filter(hasCoords).map((p): [number, number] => [p.lat, p.lng]),
  ];

  const handleEditarOtroPoste = useCallback(async (posteId: number) => {
    const p = await searchPoste(posteId);
    d.setDataPoste(p);
    d.setOpenEditPoste(true);
  }, [d]);

  const eventoActions = useMemo<EventoActionHandlers>(() => ({
    onVerDetalle: (id) => navigate(`/app/eventos/${id}`),
    onEditar: (id) => d.setEditEventoId(id),
    onAddRevision: (id) => d.setAddRevisionEventoId(id),
    onResolver: (e) => d.setResolverEvento(e),
  }), [navigate, d]);

  const metrics = useMemo(
    () => (verEventos ? computeMetrics(d.eventos) : null),
    [verEventos, d.eventos]
  );

  return (
    // Two columns from `lg` up, and it is the right-hand one that scrolls: the
    // page takes exactly the height the shell leaves it, so the map stays in
    // view however long the cards grow. Below `lg` they stack and the shell scrolls.
    <div className="w-full p-page grid grid-cols-1 gap-page lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem_auto] lg:grid-rows-[minmax(0,1fr)] animate-in fade-in duration-500">

      <div className="h-64 lg:h-full min-h-0">
        <PosteDetalleMap
          loading={d.loading}
          poste={d.poste}
          eventos={d.eventos}
          tramoPosotes={tramoPosotes}
          routePath={routePath}
          boundsCoords={boundsCoords}
          onVerCiudad={(id) => navigate(`/app/ciudades/${id}`)}
          onEditarCiudad={(ciudad) => { setSelectedCiudad(ciudad); setOpenEditCiudad(true); }}
          onVerPoste={(id) => navigate(`/app/postes/${id}`)}
          onEditarOtroPoste={handleEditarOtroPoste}
          onEditarEstePoste={() => d.setOpenEditPoste(true)}
          canEditPostes={can(sesion.usuario.id_rol, "postes", "editar")}
          canEditCiudades={can(sesion.usuario.id_rol, "ciudades", "editar")}
        />
      </div>

      {/* One card for the whole panel, and nothing lifted inside it — its parts
          were cards of their own, folding ones, in a panel with room to spare.
          `block` rather than the card's own column: a flex column of a fixed
          height would squeeze them instead of letting the panel scroll.
          What it holds is chosen on the rail beside it; below `lg` the rail
          comes first, as a row, because it is what says what follows. */}
      <Card
        id={VISTA_PANEL_ID}
        role="tabpanel"
        aria-labelledby={vistaTabId(vista)}
        className="order-3 lg:order-2 shadow-sm border-muted/60 py-0 gap-0 block min-h-0 lg:overflow-y-auto"
      >
        {vista === "resumen" ? (
          <>
            <PosteDetalleFoto loading={d.loading} poste={d.poste} />
            <PosteDetalleHeader
              loading={d.loading}
              poste={d.poste}
              status={metrics?.status ?? null}
              canCreateEvento={can(sesion.usuario.id_rol, "eventos", "crear")}
              canEditPoste={can(sesion.usuario.id_rol, "postes", "editar")}
              onNuevoEvento={() => d.setAddEventoOpen(true)}
              onEditarPoste={() => d.setOpenEditPoste(true)}
            />

            {/* What the pole is, straight under its name and with no title of
                its own. It is of a fixed length, so it goes first: the open
                incidents are a list that grows, and nothing folds any more. */}
            <section aria-label="Ficha" className="px-3 pb-3">
              <PosteDetalleInfo
                loading={d.loading}
                poste={d.poste}
                metrics={metrics}
                canVerTramos={can(sesion.usuario.id_rol, "tramos", "ver")}
              />
            </section>

            {verEventos && (
              <>
                {/* Inset, not from edge to edge: a rule across the whole card
                    cut it in two. */}
                <div role="separator" className="mx-3 h-px rounded-full bg-border/60" />
                <section className="p-3">
                  <h2 className="text-sm font-semibold mb-2">
                    Eventos abiertos
                    {!!metrics?.pendientes && (
                      <span className="text-muted-foreground font-normal tabular-nums"> · {metrics.pendientes}</span>
                    )}
                  </h2>
                  <PosteDetalleEventosAbiertos
                    loading={d.loading}
                    eventos={d.eventos}
                    canEditEventos={can(sesion.usuario.id_rol, "eventos", "editar")}
                    actions={eventoActions}
                  />
                </section>
              </>
            )}
          </>
        ) : (
          <PosteDetalleHistorial
            vista={vista}
            loading={d.loading}
            poste={d.poste}
            eventos={d.eventos}
            tramoPostes={tramoPosotes}
            onVerPoste={(id) => navigate(`/app/postes/${id}`)}
            onVerEvento={eventoActions.onVerDetalle}
          />
        )}
      </Card>

      <div className="order-2 lg:order-3 min-w-0">
        <PosteDetalleRail
          vista={vista}
          onVista={setVista}
          canVerEventos={verEventos}
          canVerBitacora={can(sesion.usuario.id_rol, "bitacora", "ver")}
          resueltos={metrics?.totalResueltos ?? 0}
          vecinos={Math.max(0, tramoPosotes.filter((p) => p.id !== d.poste?.id).length)}
        />
      </div>

      {/* Sheets */}
      <EventoSheet
        posteId={Number(id)}
        open={d.addEventoOpen}
        setOpen={d.setAddEventoOpen}
        onSuccess={d.load}
      />
      <PermissionGuard module="eventos" action="editar" open={d.addRevisionEventoId !== null} onOpenChange={(v) => { if (!v) d.setAddRevisionEventoId(null); }}>
        <AddRevisionSheet
          eventoId={d.addRevisionEventoId}
          open={d.addRevisionEventoId !== null}
          setOpen={(v) => { if (!v) d.setAddRevisionEventoId(null); }}
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
        <EventoSheet
          eventoId={d.editEventoId}
          open={d.editEventoId !== null}
          setOpen={(v) => { if (!v) d.setEditEventoId(null); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      <PermissionGuard module="ciudades" action="editar" open={openEditCiudad} onOpenChange={(v) => { if (!v) setOpenEditCiudad(false); }}>
        <CiudadSheet
          ciudad={selectedCiudad}
          open={openEditCiudad}
          setOpen={(v) => { if (!v) setOpenEditCiudad(false); }}
          onSuccess={d.load}
        />
      </PermissionGuard>
      {d.dataPoste.id != null && (
        <PermissionGuard module="postes" action="editar" open={d.openEditPoste} onOpenChange={d.setOpenEditPoste}>
          <PosteSheet
            poste={d.dataPoste}
            open={d.openEditPoste}
            setOpen={d.setOpenEditPoste}
            onSuccess={d.load}
          />
        </PermissionGuard>
      )}

    </div>
  );
}
