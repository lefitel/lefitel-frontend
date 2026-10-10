import { hasCoords } from "../../../../components/map/mapGeo";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { getPosteByTramo, searchPoste } from "../../../../api/Poste.api";
import { CiudadInterface, PosteInterface } from "../../../../interfaces/interfaces";
import PosteSheet from "../../../../components/dialogs/upsert/PosteSheet";
import CiudadSheet from "../../../../components/dialogs/upsert/CiudadSheet";
import PermissionGuard from "../../../../components/PermissionGuard";
import { fetchOrsRoute } from "../../../../lib/orsRoute";
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
import CollapsibleSection from "../../../../components/CollapsibleSection";

export default function PosteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  // Incidents are a second permission. Without it the sheet still opens: it
  // does not ask for them and does not draw the two blocks made of them.
  const verEventos = can(sesion.usuario.id_rol, "eventos", "ver");
  const d = usePosteDetalleData(Number(id), { verEventos });

  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [tramoPosotes, setTramoPosotes] = useState<PosteInterface[]>([]);
  const [openEditCiudad, setOpenEditCiudad] = useState(false);
  const [vista, setVista] = useState<VistaPoste>("resumen");
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

    getPosteByTramo(d.poste.id_ciudadA, d.poste.id_ciudadB)
      .then((postes) => {
        const dx = b.lat - a.lat;
        const dy = b.lng - a.lng;
        const sorted = postes
          .filter(hasCoords)
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
        return fetchOrsRoute(waypoints)
          .then((route) => setRoutePath(route ?? fallback))
          .catch(() => setRoutePath(fallback));
      })
      .catch(() => toast.warning("No se pudo calcular la ruta del tramo."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.poste?.id]);

  const located = hasCoords(d.poste);
  const boundsCoords: [number, number][] = [
    ...(d.poste?.ciudadA?.lat && d.poste.ciudadA.lng ? [[d.poste.ciudadA.lat, d.poste.ciudadA.lng] as [number, number]] : []),
    ...(d.poste?.ciudadB?.lat && d.poste.ciudadB.lng ? [[d.poste.ciudadB.lat, d.poste.ciudadB.lng] as [number, number]] : []),
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

  const posicionEnTramo = useMemo(() => {
    if (!d.poste || tramoPosotes.length === 0) return null;
    const idx = tramoPosotes.findIndex((p) => p.id === d.poste!.id);
    if (idx < 0) return null;
    return { index: idx + 1, total: tramoPosotes.length };
  }, [d.poste, tramoPosotes]);

  // The stretch is ordered from one city to the other, so the poles either side
  // of this one in that order are the ones a crew would walk to next.
  const anterior = posicionEnTramo ? tramoPosotes[posicionEnTramo.index - 2] ?? null : null;
  const siguiente = posicionEnTramo ? tramoPosotes[posicionEnTramo.index] ?? null : null;

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

      {/* One card for the whole panel, and inside it a card for each thing
          about the pole. `block` rather than the card's own column: a flex
          column of a fixed height would squeeze them instead of letting the
          panel scroll. Its ground is tinted so the cards inside read as lifted.
          What it holds is chosen on the rail beside it; below `lg` the rail
          comes first, as a row, because it is what says what follows. */}
      <Card
        id={VISTA_PANEL_ID}
        role="tabpanel"
        aria-labelledby={vistaTabId(vista)}
        className="order-3 lg:order-2 shadow-sm border-muted/60 bg-muted/40 p-2 block space-y-2 min-h-0 lg:overflow-y-auto"
      >
        {vista === "resumen" ? (
          <>
        <Card className="py-0 gap-0 shadow-sm border-border/60 overflow-hidden">
        <PosteDetalleFoto loading={d.loading} poste={d.poste} />
        <PosteDetalleHeader
          loading={d.loading}
          poste={d.poste}
          status={metrics?.status ?? null}
          posicionEnTramo={posicionEnTramo}
          anterior={anterior}
          siguiente={siguiente}
          canCreateEvento={can(sesion.usuario.id_rol, "eventos", "crear")}
          canEditPoste={can(sesion.usuario.id_rol, "postes", "editar")}
          onNuevoEvento={() => d.setAddEventoOpen(true)}
          onEditarPoste={() => d.setOpenEditPoste(true)}
          onRefrescar={d.load}
          onVerPoste={(id) => navigate(`/app/postes/${id}`)}
        />
        </Card>

        {verEventos && (
          <CollapsibleSection title="Eventos abiertos" count={metrics?.pendientes} defaultOpen>
            <PosteDetalleEventosAbiertos
              loading={d.loading}
              eventos={d.eventos}
              canEditEventos={can(sesion.usuario.id_rol, "eventos", "editar")}
              canCreateEventos={can(sesion.usuario.id_rol, "eventos", "crear")}
              onNuevoEvento={() => d.setAddEventoOpen(true)}
              actions={eventoActions}
            />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Ficha" defaultOpen>
          <PosteDetalleInfo loading={d.loading} poste={d.poste} metrics={metrics} />
        </CollapsibleSection>

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
