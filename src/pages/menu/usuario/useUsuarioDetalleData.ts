import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchUsuario } from "../../../api/Usuario.api";
import { getEvento_usuario } from "../../../api/Evento.api";
import { getBitacora } from "../../../api/Bitacora.api";
import { BitacoraInterface, EventoInterface, UsuarioInterface } from "../../../interfaces/interfaces";

export interface UsuarioDetalleData {
  usuario: UsuarioInterface | null;
  eventos: EventoInterface[];
  bitacora: BitacoraInterface[];
  loading: boolean;
  load: () => void;
}

/**
 * `verBitacora` is whether the activity log of *this* account may be read: your
 * own always, somebody else's with `bitacora.ver`. It is not asked for without
 * it — see `usePosteDetalleData` for why: one refused read rejected the whole
 * `Promise.all` and the account itself was discarded.
 */
export function useUsuarioDetalleData(id: number, { verBitacora }: { verBitacora: boolean }): UsuarioDetalleData {
  const [usuario, setUsuario] = useState<UsuarioInterface | null>(null);
  const [eventos, setEventos] = useState<EventoInterface[]>([]);
  const [bitacora, setBitacora] = useState<BitacoraInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, e, b] = await Promise.all([
        searchUsuario(id),
        getEvento_usuario(id),
        verBitacora ? getBitacora(id, 50) : Promise.resolve({ data: [] as BitacoraInterface[] }),
      ]);
      setUsuario(u);
      setEventos([...e].sort((a, b) => {
        if (a.priority !== b.priority) return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }));
      setBitacora(b.data);
    } catch {
      toast.error("Error al cargar los datos del usuario");
    } finally {
      setLoading(false);
    }
  }, [id, verBitacora]);

  useEffect(() => { load(); }, [load]);

  return { usuario, eventos, bitacora, loading, load };
}
