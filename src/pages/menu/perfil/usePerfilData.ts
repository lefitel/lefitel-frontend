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
  /** `null` when the request failed: "we could not count" is not "zero". */
  eventos: EventoInterface[] | null;
  sesiones: SesionActivaInterface[];
  loading: boolean;
  /**
   * Ask for everything again. For the one failure this hook reports — the
   * profile itself not arriving — where `loading` ends with `usuario` still
   * `null`.
   */
  recargar: () => void;
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
 * the other two are caught here. The exception is the event count: a list that
 * failed to arrive is `null` rather than `[]`, because the panel would
 * otherwise print "Eventos atendidos: 0" for somebody it could not count.
 *
 * None of the four needs a permission the caller might not have, and since C5
 * two of them say so by construction rather than by being open.
 * `GET /usuario/:id/bitacora` and `GET /usuario/:id/eventos` are both behind
 * `requireSelfOrPermission`, so asking about yourself always passes — provided
 * that middleware is reading the parameter the route really declares. That
 * defect has shipped before, and D1 turned it around: both routes moved under
 * `/api/usuario/:id`, so the middleware's default is now the right one and the
 * mistake would be **passing** the old `"id_usuario"` rather than omitting it.
 * `evento.self.test.ts` and `bitacora.self.test.ts` are the two files that
 * measure it, one per route. `GET /auth/sessions` reads the caller's id off the session and takes
 * nothing from the request, so there is no other person's list it could return.
 *
 * That is why the swallow below is a swallow and not a report: on this screen a
 * failure of the log or the sessions means the section is empty, and an empty
 * section is the truth for somebody with no log and one device. A *wrong* gate
 * would print "Eventos atendidos: 0" to a technician with four hundred, which
 * is why the server has the test where that question can actually be asked.
 */
export function usePerfilData(id: number | null | undefined): PerfilData {
  const [usuario, setUsuario] = useState<UsuarioInterface | null>(null);
  const [bitacora, setBitacora] = useState<BitacoraInterface[]>([]);
  const [eventos, setEventos] = useState<EventoInterface[] | null>(null);
  const [sesiones, setSesiones] = useState<SesionActivaInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [intento, setIntento] = useState(0);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

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
      getEvento_usuario(id).catch(() => null),
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
  }, [id, intento]);

  return { usuario, bitacora, eventos, sesiones, loading, recargar, recargarSesiones, actualizarUsuario };
}
