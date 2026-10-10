import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchPoste } from "../../../../api/Poste.api";
import { getEvento_poste, reabrirEvento as reabrirEventoApi } from "../../../../api/Evento.api";
import { mensajeDeError } from "../../../../api/descarga";
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

/**
 * `verEventos` is whether this role holds `eventos.ver`, and the incidents are
 * not asked for without it.
 *
 * The two reads used to travel together whatever the role. The pole asks for
 * `postes.ver` and its incidents for `eventos.ver`, so a role with the first
 * and not the second had the incidents refused — and one refusal rejects the
 * whole `Promise.all`, throwing away the pole that had arrived. The sheet said
 * "Error al cargar los datos del poste" about a pole the role may see.
 */
export function usePosteDetalleData(id: number, { verEventos }: { verEventos: boolean }): PosteDetalleData {
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
        searchPoste(id),
        verEventos ? getEvento_poste(id) : Promise.resolve([]),
      ]);
      setPoste(p);
      setDataPoste(p);
      setEventos(e);
    } catch {
      toast.error("Error al cargar los datos del poste");
    } finally {
      setLoading(false);
    }
  }, [id, verEventos]);

  useEffect(() => {
    setPoste(null);
    setEventos([]);
    load();
  }, [load]);

  const reabrirEvento = async (evento: EventoInterface) => {
    try {
      await reabrirEventoApi(evento.id as number);
      toast.success("Evento reabierto");
      await load();
    } catch (error) {
      toast.error(mensajeDeError(error, "Error al reabrir el evento"));
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
