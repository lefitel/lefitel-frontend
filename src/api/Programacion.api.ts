import axios from "axios";
import { urlApi } from "./url";

// Scheduled reports: a saved report of the generator sent by email every day,
// week or month. The server's addresses are in English — `schedules`,
// `recipients`, `runs` — and what they carry keeps the words of the screen.

const urlGenerador = "generator/";

export type Frecuencia = "diaria" | "semanal" | "mensual";
export type FormatoProgramado = "excel" | "pdf";

/**
 * Why a schedule is not running, as the server stores it. The screen
 * translates these; a value it does not know is shown as it comes.
 */
export type MotivoDePausa =
  | "manual"
  | "fallos"
  | "sin_permiso"
  | "dueno_inactivo"
  | "informe_archivado"
  | "sin_destinatarios";

export type EstadoDeEjecucion = "en_curso" | "enviado" | "vacio" | "demasiado_grande" | "fallido" | "omitido";

/** An account on a schedule. Named, never addressed: the address stays on the server. */
export interface DestinatarioCuenta {
  id_usuario: number;
  name: string | null;
  lastname: string | null;
  /** False when the account has no verified address, so nothing reaches it. */
  tieneCorreo: boolean;
}

/** An outside address on a schedule. */
export interface DestinatarioExterno {
  email: string;
  /** It asked not to be written to. It stays listed and receives nothing. */
  deBaja: boolean;
  /** Refused too many times in a row; no longer written to. */
  rechazado: boolean;
}

export interface Programacion {
  id: number;
  id_reporte: number;
  /** `null` when the saved report no longer exists at all. */
  informe: { name: string; archivado: boolean } | null;
  /** The owner: whose permissions the report is generated under. */
  id_usuario: number;
  /** The owner's name, for whoever is looking at somebody else's schedule. */
  dueno: { name: string | null; lastname: string | null } | null;
  frecuencia: Frecuencia;
  /** ISO weekday, 1 = Monday. Set exactly when weekly. */
  dia_semana: number | null;
  /** 1–28. Set exactly when monthly. */
  dia_mes: number | null;
  /** 0–23, in Bolivia's time. */
  hora: number;
  /** 0–59. */
  minuto: number;
  formato: FormatoProgramado;
  con_fotos: boolean;
  activa: boolean;
  motivo_pausa: MotivoDePausa | string | null;
  fallos_seguidos: number;
  /** ISO instant, or `null` while paused. */
  proxima_ejecucion: string | null;
  destinatarios: { usuarios: DestinatarioCuenta[]; correos: DestinatarioExterno[] };
  ultima: { estado: EstadoDeEjecucion; programada_para: string; enviados: number; detalle: string | null } | null;
}

/** What creating or changing a schedule sends. A change sends the whole thing. */
export interface ProgramacionPedida {
  id_reporte: number;
  frecuencia: Frecuencia;
  dia_semana?: number | null;
  dia_mes?: number | null;
  hora: number;
  /** 0–59. Left out means on the dot. */
  minuto?: number;
  formato: FormatoProgramado;
  con_fotos?: boolean;
  activa?: boolean;
  destinatarios: { usuarios: number[]; correos: string[] };
}

export interface Ejecucion {
  id: number;
  id_programacion: number;
  programada_para: string;
  manual: boolean;
  estado: EstadoDeEjecucion;
  iniciada_at: string;
  terminada_at: string | null;
  filas: number | null;
  bytes: number | null;
  enviados: number;
  no_enviados: number;
  detalle: string | null;
}

/**
 * One run in the history of every schedule: the run as a schedule's own history
 * serves it, and the schedule it belongs to.
 */
export interface EjecucionDelHistorial extends Ejecucion {
  /**
   * Whether who this run was sent to was recorded. False for the runs from
   * before that record existed, which have nothing to show.
   */
  con_destinatarios: boolean;
  programacion: {
    id: number;
    formato: FormatoProgramado;
    /** The schedule was removed. Its runs stay: they are what happened. */
    eliminada: boolean;
    /** `null` when the saved report no longer exists at all. */
    informe: { id: number; name: string } | null;
    /** `null` when the owner's account cannot be found. */
    dueno: { id: number; name: string | null; lastname: string | null } | null;
  };
}

/** What became of one recipient of one run. */
export type ResultadoDeEntrega = "entregado" | "rechazado" | "no_enviado" | "sin_cupo";

/** One recipient of one run, as it was at that moment. */
export interface EntregaDeEjecucion {
  id: number;
  tipo: "usuario" | "externo";
  /**
   * An account's name and surname; an outside address's address. There is no
   * separate field for an address: an account's is never sent.
   */
  nombre: string;
  resultado: ResultadoDeEntrega;
}

/** An account that can be picked as a recipient. */
export interface DestinatarioPosible {
  id: number;
  name: string;
  lastname: string;
  tieneCorreo: boolean;
}

/** What "send it now" answers. */
export type ResultadoDeEnvio =
  | { tipo: "ejecutado"; estado: Exclude<EstadoDeEjecucion, "en_curso" | "omitido">; enviados: number; no_enviados: number }
  | { tipo: "pausada"; motivo: MotivoDePausa };

interface Sobre<T> {
  data: T[];
  total: number;
  page: number;
  limit: number | "all";
}

/** The caller's schedules — every schedule, for administration. Optionally those of one report. */
export const listarProgramaciones = (id_reporte?: number): Promise<Sobre<Programacion>> =>
  axios
    .get(urlApi + urlGenerador + "schedules/", { params: { limit: "all", ...(id_reporte ? { id_reporte } : {}) } })
    .then((r) => r.data);

export const crearProgramacion = (pedida: ProgramacionPedida): Promise<Programacion> =>
  axios.post(urlApi + urlGenerador + "schedules/", pedida).then((r) => r.data);

export const actualizarProgramacion = (id: number, pedida: ProgramacionPedida): Promise<Programacion> =>
  axios.put(urlApi + urlGenerador + `schedules/${id}`, pedida).then((r) => r.data);

/** Answers nothing: a 204. */
export const eliminarProgramacion = (id: number): Promise<void> =>
  axios.delete(urlApi + urlGenerador + `schedules/${id}`).then(() => undefined);

/** One real run, to the real recipients. Leaves the schedule's own timing alone. */
export const enviarProgramacionAhora = (id: number): Promise<ResultadoDeEnvio> =>
  axios.post(urlApi + urlGenerador + `schedules/${id}/run`, {}).then((r) => r.data);

export const listarEjecuciones = (id: number, page = 1): Promise<Sobre<Ejecucion>> =>
  axios.get(urlApi + urlGenerador + `schedules/${id}/runs`, { params: { page } }).then((r) => r.data);

/**
 * The runs of every schedule the caller may see, newest first. A filter that is
 * not set is not sent at all: the server answers an empty parameter with a 400,
 * never with "all".
 */
export const listarHistorial = (params: {
  page?: number;
  limit?: number;
  estado?: EstadoDeEjecucion;
  id_programacion?: number;
}): Promise<Sobre<EjecucionDelHistorial>> =>
  axios
    .get(urlApi + urlGenerador + "schedules/runs", {
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
    })
    .then((r) => r.data);

/** Who one run was sent to, and what became of each. */
export const listarDestinatariosDeEjecucion = (idEjecucion: number): Promise<Sobre<EntregaDeEjecucion>> =>
  axios.get(urlApi + urlGenerador + `schedules/runs/${idEjecucion}/recipients`).then((r) => r.data);

export const listarDestinatariosPosibles = (): Promise<Sobre<DestinatarioPosible>> =>
  axios.get(urlApi + urlGenerador + "schedules/recipients", { params: { limit: "all" } }).then((r) => r.data);

// ─── Unsubscribing — public, for an outside address ──────────────────────────
//
// Both carry the token in the body and never in the address: the server logs
// the path of every request.

/** What an unsubscribe link would stop. */
export interface DatosDeBaja {
  informe: string | null;
  programadoPor: string | null;
  /** Already unsubscribed. */
  deBaja: boolean;
}

/** Changes nothing. Rejects with 404 for a link that is no good. */
export const consultarBaja = (token: string): Promise<DatosDeBaja> =>
  axios.post(urlApi + "unsubscribe/lookup", { token }).then((r) => r.data);

/** Stops the messages. Answers nothing, and the same the second time. */
export const confirmarBaja = (token: string): Promise<void> =>
  axios.post(urlApi + "unsubscribe/", { token }).then(() => undefined);
