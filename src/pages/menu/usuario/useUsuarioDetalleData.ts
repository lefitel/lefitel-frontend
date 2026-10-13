import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchUsuario } from "../../../api/Usuario.api";
import { getEvento_usuario } from "../../../api/Evento.api";
import { getAllBitacora, getBitacora } from "../../../api/Bitacora.api";
import type { Paginado } from "../../../api/listado";
import { fusionarBitacora } from "../../../lib/fusionarBitacora";
import { BitacoraInterface, EventoInterface, UsuarioInterface } from "../../../interfaces/interfaces";

export interface UsuarioDetalleData {
  usuario: UsuarioInterface | null;
  eventos: EventoInterface[];
  /** What this person did and what was done to their account, as one timeline. */
  bitacora: BitacoraInterface[];
  /** The half about the account was asked for and did not arrive. */
  bitacoraIncompleta: boolean;
  loading: boolean;
  load: () => void;
}

/**
 * `verBitacora` is whether the activity log of *this* account may be read: your
 * own always, somebody else's with `bitacora.ver`. It is not asked for without
 * it — see `usePosteDetalleData` for why: one refused read rejected the whole
 * `Promise.all` and the account itself was discarded.
 *
 * `verBitacoraCuenta` is the other half of the same log: the lines whose
 * *subject* is this account, whoever wrote them — an administrator renaming it,
 * unlocking it, setting its password. They come from the general log, which
 * asks for `bitacora.ver` and makes no exception for your own record. Most of
 * them are also the person's own (every login is both), so the two reads are
 * shown as one list and not as two.
 */
export function useUsuarioDetalleData(
  id: number,
  { verBitacora, verBitacoraCuenta = false }: { verBitacora: boolean; verBitacoraCuenta?: boolean },
): UsuarioDetalleData {
  const [usuario, setUsuario] = useState<UsuarioInterface | null>(null);
  const [eventos, setEventos] = useState<EventoInterface[]>([]);
  const [bitacora, setBitacora] = useState<BitacoraInterface[]>([]);
  const [bitacoraIncompleta, setBitacoraIncompleta] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, e, propia, cuenta] = await Promise.all([
        searchUsuario(id),
        getEvento_usuario(id),
        verBitacora ? getBitacora(id, 50) : Promise.resolve(null),
        // Caught here and not below: it is an addition to a list, and losing it
        // must not cost the account, its events and the other half of the log.
        verBitacoraCuenta
          ? getAllBitacora({ entity: "Usuario", entity_id: id, limit: 50 }).catch(() => null)
          : Promise.resolve(undefined),
      ]);
      setUsuario(u);
      setEventos([...e].sort((a, b) => {
        if (a.priority !== b.priority) return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }));
      setBitacora(fusionarBitacora(
        [propia, cuenta].filter((l): l is Paginado<BitacoraInterface> => !!l),
      ));
      // `null` is the read that failed; `undefined` the one never made.
      setBitacoraIncompleta(cuenta === null);
    } catch {
      toast.error("Error al cargar los datos del usuario");
    } finally {
      setLoading(false);
    }
  }, [id, verBitacora, verBitacoraCuenta]);

  useEffect(() => { load(); }, [load]);

  return { usuario, eventos, bitacora, bitacoraIncompleta, loading, load };
}
