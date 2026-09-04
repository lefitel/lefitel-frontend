import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchUsuario } from "../../../api/Usuario.api";
import { getEvento_usuario } from "../../../api/Evento.api";
import { getBitacora } from "../../../api/Bitacora.api";
import { getSessions } from "../../../api/Login.api";
import type {
  BitacoraInterface,
  EventoInterface,
  SesionActivaInterface,
  UsuarioInterface,
} from "../../../interfaces/interfaces";

/**
 * How many bitácora lines to ask for.
 *
 * More than the eight the activity section shows, because the same list is
 * also where "último acceso" comes from — the most recent `LOGIN` line — and a
 * busy morning can easily push that below the eighth row. Twenty-five is one
 * request either way; the cost of asking for it is nothing and the cost of not
 * having it is a panel that says "—" for somebody who logs in every day.
 */
const BITACORA_LIMIT = 25;

export interface PerfilData {
  usuario: UsuarioInterface | null;
  bitacora: BitacoraInterface[];
  eventos: EventoInterface[];
  sesiones: SesionActivaInterface[];
  loading: boolean;
  /** Re-read just the session list, after closing one or several. */
  recargarSesiones: () => Promise<void>;
  /**
   * Fold a saved change back into the loaded record, without refetching.
   *
   * The alternative was for the page to keep its own copy of `usuario` beside
   * this one, and that copy is what goes stale: the panel reads `image` and
   * `phone` off the record to decide which checklist items are ticked, so a
   * photo saved into a second copy would leave the ring saying it is still
   * missing until the next full load.
   */
  actualizarUsuario: (patch: Partial<UsuarioInterface>) => void;
}

/**
 * Everything `PerfilPage` needs about the person looking at it, in one place.
 *
 * Modelled on `useUsuarioDetalleData`, which does the same job for the admin
 * screen, with one deliberate difference: **only the profile itself is
 * allowed to fail loudly.**
 *
 * `useUsuarioDetalleData` puts its three calls in a `Promise.all` and shows one
 * error toast if any of them rejects. That is right there, where all three feed
 * a single "here is this user" report and a half-drawn one would mislead. It is
 * wrong here. This screen's job is to let somebody fix their own phone number
 * and set up a recovery address, and neither of those depends on the bitácora,
 * their event history, or the session list. Letting `getBitacora` answer 500
 * and take the phone number field down with it would be trading the page's
 * whole purpose for three sections that are context.
 *
 * So the three secondary calls resolve to empty and their sections render
 * nothing. `getSessions` already swallows its own failures in `Login.api.ts`;
 * the other two are caught here.
 *
 * None of the four needs a permission the caller might not have.
 * `GET /bitacora/:id_usuario` is behind `requireSelfOrPermission`, so asking
 * about yourself always passes; `GET /evento/usuario/:id` and
 * `GET /auth/sessions` are behind nothing but a session.
 */
export function usePerfilData(id: number | null | undefined): PerfilData {
  const [usuario, setUsuario] = useState<UsuarioInterface | null>(null);
  const [bitacora, setBitacora] = useState<BitacoraInterface[]>([]);
  const [eventos, setEventos] = useState<EventoInterface[]>([]);
  const [sesiones, setSesiones] = useState<SesionActivaInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const recargarSesiones = useCallback(async () => {
    setSesiones(await getSessions());
  }, []);

  const actualizarUsuario = useCallback((patch: Partial<UsuarioInterface>) => {
    setUsuario((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let vigente = true;
    setLoading(true);

    Promise.all([
      searchUsuario(id),
      // `.data` since C3: the log answers the same envelope as every other
      // listing. What the screen shows is deliberately the last few entries,
      // not all of them, so the count that comes with it is not read here.
      getBitacora(id, BITACORA_LIMIT).then((r) => r.data).catch(() => [] as BitacoraInterface[]),
      getEvento_usuario(id).catch(() => [] as EventoInterface[]),
      getSessions(),
    ])
      .then(([u, b, e, s]) => {
        // `vigente` rather than an AbortController: three of these four have no
        // way to be cancelled, and the only thing that actually goes wrong is
        // writing state after the page is gone. Dropping the write covers it.
        if (!vigente) return;
        setUsuario(u);
        setBitacora(b);
        setEventos(e);
        setSesiones(s);
      })
      .catch(() => {
        // Only `searchUsuario` can reach this: the other three were caught
        // above. So this really does mean "the profile itself did not load",
        // which is the one failure worth interrupting somebody about.
        if (vigente) toast.error("No se pudieron cargar los datos del perfil.");
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [id]);

  return { usuario, bitacora, eventos, sesiones, loading, recargarSesiones, actualizarUsuario };
}
