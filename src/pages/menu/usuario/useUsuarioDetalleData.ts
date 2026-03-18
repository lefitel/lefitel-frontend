import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
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

export function useUsuarioDetalleData(id: number): UsuarioDetalleData {
  const { sesion } = useContext(SesionContext);
  const [usuario, setUsuario] = useState<UsuarioInterface | null>(null);
  const [eventos, setEventos] = useState<EventoInterface[]>([]);
  const [bitacora, setBitacora] = useState<BitacoraInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, e, b] = await Promise.all([
        searchUsuario(id, sesion.token),
        getEvento_usuario(id, sesion.token),
        getBitacora(id, sesion.token, 50),
      ]);
      setUsuario(u);
      setEventos([...e].sort((a, b) => {
        if (a.priority !== b.priority) return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }));
      setBitacora(b);
    } catch {
      toast.error("Error al cargar los datos del usuario");
    } finally {
      setLoading(false);
    }
  }, [id, sesion.token]);

  useEffect(() => { load(); }, [load]);

  return { usuario, eventos, bitacora, loading, load };
}
