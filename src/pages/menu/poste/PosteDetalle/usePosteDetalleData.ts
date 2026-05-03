import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../../context/SesionContext";
import { searchPoste } from "../../../../api/Poste.api";
import { getEvento_poste, reabrirEvento as reabrirEventoApi } from "../../../../api/Evento.api";
import { EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import {  posteExample } from "../../../../data/example";

export interface PosteDetalleData {
  poste: PosteInterface | null;
  dataPoste: PosteInterface;
  setDataPoste: (p: PosteInterface) => void;
  eventos: EventoInterface[];
  loading: boolean;
  load: () => void;

  // Poste edit dialog
  openEditPoste: boolean;
  setOpenEditPoste: (v: boolean) => void;

  // New evento sheet
  addEventoOpen: boolean;
  setAddEventoOpen: (v: boolean) => void;

  // Add revision sheet
  addRevisionEventoId: number | null;
  setAddRevisionEventoId: (id: number | null) => void;

  // Resolver sheet
  resolverEvento: EventoInterface | null;
  setResolverEvento: (e: EventoInterface | null) => void;

  // Edit sheet
  editEventoId: number | null;
  setEditEventoId: (id: number | null) => void;

  // Reabrir (no dialog needed — page handles confirm)
  reabrirEvento: (evento: EventoInterface) => Promise<void>;
}

export function usePosteDetalleData(id: number): PosteDetalleData {
  const { sesion } = useContext(SesionContext);
  const [poste, setPoste] = useState<PosteInterface | null>(null);
  const [dataPoste, setDataPoste] = useState<PosteInterface>(posteExample);
  const [eventos, setEventos] = useState<EventoInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const [openEditPoste, setOpenEditPoste] = useState(false);
  const [addEventoOpen, setAddEventoOpen] = useState(false);
  const [addRevisionEventoId, setAddRevisionEventoId] = useState<number | null>(null);
  const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
  const [editEventoId, setEditEventoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        searchPoste(id, sesion.token),
        getEvento_poste(id, sesion.token),
      ]);
      setPoste(p);
      setDataPoste(p);
      setEventos(e);
    } catch {
      toast.error("Error al cargar los datos del poste");
    } finally {
      setLoading(false);
    }
  }, [id, sesion.token]);

  useEffect(() => {
    setPoste(null);
    setEventos([]);
    load();
  }, [load]);

  const reabrirEvento = async (evento: EventoInterface) => {
    const status = await reabrirEventoApi(evento.id as number, sesion.token);
    if (status === 200) {
      toast.success("Evento reabierto");
      await load();
    } else {
      toast.error("Error al reabrir el evento");
    }
  };

  return {
    poste, dataPoste, setDataPoste, eventos, loading, load,
    openEditPoste, setOpenEditPoste,
    addEventoOpen, setAddEventoOpen,
    addRevisionEventoId, setAddRevisionEventoId,
    resolverEvento, setResolverEvento,
    editEventoId, setEditEventoId,
    reabrirEvento,
  };
}
