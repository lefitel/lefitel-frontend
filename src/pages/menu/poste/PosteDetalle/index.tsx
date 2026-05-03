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
import PosteDetalleHealthStrip from "./PosteDetalleHealthStrip";
import PosteDetalleInfo from "./PosteDetalleInfo";
import PosteDetalleMap from "./PosteDetalleMap";
import PosteDetalleHistorial from "./PosteDetalleHistorial";
import { EventoActionHandlers } from "./PosteDetalleEventosAbiertos";

export default function PosteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const d = usePosteDetalleData(Number(id));
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);

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

  return (
    <div className="@container/card px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

      <PosteDetalleHeader
        loading={d.loading}
        poste={d.poste}
        posicionEnTramo={posicionEnTramo}
        canCreateEvento={can(sesion.usuario.id_rol, "eventos", "crear")}
        canEditPoste={can(sesion.usuario.id_rol, "postes", "editar")}
        onNuevoEvento={() => d.setAddEventoOpen(true)}
        onEditarPoste={() => d.setOpenEditPoste(true)}
        onRefrescar={d.load}
      />

      <PosteDetalleHealthStrip loading={d.loading} eventos={d.eventos} />

      {/* Info + Mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PosteDetalleInfo loading={d.loading} poste={d.poste} />
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


      <PosteDetalleHistorial
        loading={d.loading}
        poste={d.poste}
        eventos={d.eventos}
        tramoPostes={tramoPosotes}
        canEditEventos={can(sesion.usuario.id_rol, "eventos", "editar")}
        canCreateEventos={can(sesion.usuario.id_rol, "eventos", "crear")}
        onNuevoEvento={() => d.setAddEventoOpen(true)}
        onVerPoste={(id) => navigate(`/app/postes/${id}`)}
        actions={eventoActions}
      />

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
