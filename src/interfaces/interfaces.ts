import type { Permisos } from "../lib/permissions";

export interface SesionInterface {
  usuario: UsuarioInterface;
  /**
   * Whether the server has confirmed there is a session. This is not "do we
   * have user data" — `usuario` always holds *some* shape, even the empty
   * placeholder before login — it is the server's word on it. With the
   * session cookie, the browser cannot tell on its own; this is what the
   * route gate in `App.tsx` reads instead of the old `token !== ""` check.
   */
  autenticado: boolean;
  /**
   * What this session may do, as the server says. Optional because the shape is
   * also used for the empty session before anybody logs in; absent means the
   * same as all-denied.
   */
  permisos?: Permisos;
}
export interface ReporteInterface {
  TramoInicial: number | null;
  TramoFinal: number | null;
  fechaInicial: Date;
  fechaFinal: Date;
  excludeOld?: boolean;
}
export interface AdssInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface AdssPosteInterface {
  id?: number | null;
  id_adss: number;
  id_poste: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface EventoObsInterface {
  id?: number | null;
  id_evento: number;
  id_obs: number;
  ob?: ObsInterface | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface RolInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BitacoraInterface {
  id?: number | null;
  action: string;
  detail: string;
  entity: string;
  entity_id?: number | null;
  id_usuario: number;
  usuario?: UsuarioInterface | null;
  metadata?: Record<string, unknown> | null;
  severity?: 'info' | 'warning' | 'critical' | null;
  ip_address?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
export interface MaterialInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface CiudadInterface {
  id?: number | null;
  name: string;
  image: string;
  lat: number;
  lng: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface ObsInterface {
  id?: number | null;
  name: string;
  description: string;
  id_tipoObs: number;
  /** Criticidad 1-9 (1 = catastrófico, 9 = mantenimiento). Null = sin clasificar. */
  criticality?: number | null;
  tipoObs?: TipoObsInterface | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}
export interface TipoObsInterface {
  id?: number | null;
  name: string;
  description: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface PropietarioInterface {
  id?: number | null;
  name: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface PosteInterface {
  id?: number | null;
  name: string;
  image: string;
  date: Date;
  lat: number;
  lng: number;
  id_adss: number;
  id_material: number;
  id_propietario: number;
  id_ciudadA: number;
  id_ciudadB: number;
  id_usuario: number;
  adss_ids?: number[];

  adss?: AdssInterface | null;
  material?: MaterialInterface | null;
  propietario?: PropietarioInterface | null;
  ciudadA?: CiudadInterface | null;
  ciudadB?: CiudadInterface | null;
  adsspostes?: AdssPosteInterface | null;
  usuario?: UsuarioInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface EventoInterface {
  id?: number | null;
  description: string;
  image: string;
  state: boolean;
  date: Date;
  id_poste: number;
  id_usuario: number;
  obs_ids?: number[];
  revision?: { description: string; date: Date };

  poste?: PosteInterface | null;
  solucions?: SolucionInterface[] | null;
  revisions?: RevisionInterface[] | null;
  eventoObs?: EventoObsInterface[] | null;
  usuario?: UsuarioInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  priority?: boolean;
}

export interface RevisionInterface {
  id?: number | null;
  description: string;
  date: Date;
  id_evento: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UsuarioInterface {
  id?: number | null;
  name: string;
  lastname: string;
  birthday: Date;
  image: string;
  phone: string;
  user: string;
  pass: string;
  id_rol: number;

  /**
   * The recovery address, as `GET /auth/me` and `GET /usuario/:id` both send
   * it — optional and nullable because most of this repository's mocks and
   * fixtures predate the field and never set it, and because a real account
   * without one yet answers with `null`, not an absent key.
   *
   * Not writable through `editUsuario`/`createUsuario`: the API's own
   * `EDITABLE_FIELDS`/`CREATABLE_FIELDS` whitelist in `usuario.controller.ts`
   * leaves it out on purpose, so an admin screen cannot set somebody else's
   * recovery address. The only write path is `sendVerificationEmail` in
   * `Login.api.ts`, which requires the caller's own current password and only
   * ever acts on the caller's own account.
   */
  email?: string | null;
  /**
   * When the address above was confirmed, or `null` if it never was — ISO
   * 8601, matching every other timestamp this interface already carries.
   *
   * This is the field that actually matters. A saved-but-unverified address
   * is exactly as useless as no address at all: `/password/forgot` only
   * operates on a verified one, so a screen that shows `email` without this
   * lets somebody believe their way back in is already set up when it is not.
   */
  email_verified_at?: string | null;

  rol?: RolInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface SolucionInterface {
  id?: number | null;
  description: string;
  image: string;
  date: Date;
  id_evento: number;

  evento?: EventoInterface | null;

  createdAt?: Date | null;
  updatedAt?: Date | null;
}

/**
 * One row of `GET /api/auth/sessions` — a device this account is logged in on.
 *
 * The server projects this field by field out of the `sesiones` table rather
 * than handing back the row, so what arrives here is deliberately smaller than
 * what is stored: `token_hash` never leaves the API, and neither does anything
 * a later column might add.
 *
 * `user_agent` and `ip_address` are nullable because the columns are: a session
 * row can be created by a client that sent neither. Nothing on this side may
 * assume a string is there.
 */
export interface SesionActivaInterface {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  /** Whether this row is the session the request itself was made with. */
  actual: boolean;
}
