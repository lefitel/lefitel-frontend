// The rules of the scheduled-reports screen that are not React: how a schedule
// reads, what its form holds while it is being typed, and what is still wrong
// with it. Pure, so the form's behaviour is tested without rendering one.

import type {
  EstadoDeEjecucion,
  FormatoProgramado,
  Frecuencia,
  Programacion,
  ProgramacionPedida,
} from "../api/Programacion.api";

/** The server's ceiling on recipients of one schedule, accounts and addresses together. */
export const MAX_DESTINATARIOS = 10;

/** ISO weekdays, Monday first — the order the server counts in. */
export const DIAS_DE_LA_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const;

export const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: "diaria", label: "Cada día" },
  { value: "semanal", label: "Cada semana" },
  { value: "mensual", label: "Cada mes" },
];

/** 1–28: a day every month has. */
export const DIAS_DEL_MES = Array.from({ length: 28 }, (_, i) => i + 1);

export const HORAS = Array.from({ length: 24 }, (_, i) => i);

export const horaComoTexto = (hora: number): string => `${String(hora).padStart(2, "0")}:00`;

/** "Cada día, 06:00" · "Lunes, 07:00" · "Día 1, 08:00". */
export function cuandoSeEnvia(p: Pick<Programacion, "frecuencia" | "dia_semana" | "dia_mes" | "hora">): string {
  const hora = horaComoTexto(p.hora);
  if (p.frecuencia === "semanal") {
    const dia = DIAS_DE_LA_SEMANA.find((d) => d.value === p.dia_semana)?.label ?? "Cada semana";
    return `${dia}, ${hora}`;
  }
  if (p.frecuencia === "mensual") return `Día ${p.dia_mes ?? "?"}, ${hora}`;
  return `Cada día, ${hora}`;
}

/**
 * Why a schedule is paused, in a sentence for its owner.
 *
 * A reason this screen does not know is shown as the server sent it rather
 * than hidden: a new one arriving before this list is updated should read
 * oddly, not vanish.
 */
export function motivoDePausa(motivo: string | null): string {
  switch (motivo) {
    case null:
    case "manual":
      return "En pausa";
    case "fallos":
      return "En pausa: falló 3 veces seguidas";
    case "sin_permiso":
      return "En pausa: quien lo programó ya no tiene permiso";
    case "dueno_inactivo":
      return "En pausa: la cuenta de quien lo programó está archivada";
    case "informe_archivado":
      return "En pausa: el informe está archivado";
    case "sin_destinatarios":
      return "En pausa: no queda ningún destinatario";
    default:
      return `En pausa: ${motivo}`;
  }
}

export type Tono = "bien" | "aviso" | "mal" | "neutro";

/** How a run ended, as the words and the colour the table and the history use. */
export const ESTADO_DE_EJECUCION: Record<EstadoDeEjecucion, { etiqueta: string; tono: Tono }> = {
  enviado: { etiqueta: "Enviado", tono: "bien" },
  vacio: { etiqueta: "Sin resultados", tono: "aviso" },
  demasiado_grande: { etiqueta: "Demasiado grande", tono: "aviso" },
  fallido: { etiqueta: "Falló", tono: "mal" },
  omitido: { etiqueta: "Omitido", tono: "neutro" },
  en_curso: { etiqueta: "Enviando…", tono: "neutro" },
};

// ─── The form ────────────────────────────────────────────────────────────────

/** What the form holds while it is being filled in. Addresses are still text. */
export interface Borrador {
  id_reporte: number | null;
  frecuencia: Frecuencia;
  dia_semana: number;
  dia_mes: number;
  hora: number;
  formato: FormatoProgramado;
  con_fotos: boolean;
  activa: boolean;
  usuarios: number[];
  /** As typed: separated by commas, semicolons, spaces or new lines. */
  correos: string;
}

export const BORRADOR_VACIO: Borrador = {
  id_reporte: null,
  frecuencia: "semanal",
  dia_semana: 1,
  dia_mes: 1,
  hora: 7,
  formato: "excel",
  con_fotos: false,
  activa: true,
  usuarios: [],
  correos: "",
};

/**
 * The form for an existing schedule.
 *
 * An address that unsubscribed is left out of the box on purpose: it stays on
 * the schedule whatever is saved — the server never removes it — and showing
 * it as editable text would suggest it can be written to again.
 */
export function borradorDe(p: Programacion): Borrador {
  return {
    id_reporte: p.id_reporte,
    frecuencia: p.frecuencia,
    dia_semana: p.dia_semana ?? BORRADOR_VACIO.dia_semana,
    dia_mes: p.dia_mes ?? BORRADOR_VACIO.dia_mes,
    hora: p.hora,
    formato: p.formato,
    con_fotos: p.con_fotos,
    activa: p.activa,
    usuarios: p.destinatarios.usuarios.map((u) => u.id_usuario),
    correos: p.destinatarios.correos.filter((c) => !c.deBaja).map((c) => c.email).join(", "),
  };
}

/** One address: something, an at sign, something with a dot. The server's own rule. */
const FORMA_DE_CORREO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The addresses typed into the box: trimmed, lower-cased, without repeats. */
export function correosDe(texto: string): { validos: string[]; malos: string[] } {
  const trozos = [...new Set(texto.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return {
    validos: trozos.filter((t) => FORMA_DE_CORREO.test(t)),
    malos: trozos.filter((t) => !FORMA_DE_CORREO.test(t)),
  };
}

export const totalDeDestinatarios = (b: Borrador): number => b.usuarios.length + correosDe(b.correos).validos.length;

/** The required things still missing, by the name the form shows for each. */
export function faltan(b: Borrador): string[] {
  const falta: string[] = [];
  if (b.id_reporte === null) falta.push("Informe");
  if (totalDeDestinatarios(b) === 0) falta.push("Destinatarios");
  return falta;
}

/** What stops the form from being sent even with everything filled in. `null` when nothing does. */
export function problemaDe(b: Borrador): string | null {
  const { malos } = correosDe(b.correos);
  if (malos.length > 0) {
    return `${malos.length === 1 ? "No es una dirección válida" : "No son direcciones válidas"}: ${malos.join(", ")}`;
  }
  const total = totalDeDestinatarios(b);
  if (total > MAX_DESTINATARIOS) return `Un envío admite como máximo ${MAX_DESTINATARIOS} destinatarios, y este tiene ${total}.`;
  return null;
}

/** The request the form stands for. Only called once `faltan` and `problemaDe` are clear. */
export function pedidaDe(b: Borrador): ProgramacionPedida {
  return {
    id_reporte: b.id_reporte as number,
    frecuencia: b.frecuencia,
    // Each day belongs to its frequency and to no other; the server refuses a
    // weekly schedule that also names a day of the month.
    dia_semana: b.frecuencia === "semanal" ? b.dia_semana : null,
    dia_mes: b.frecuencia === "mensual" ? b.dia_mes : null,
    hora: b.hora,
    formato: b.formato,
    con_fotos: b.formato === "excel" && b.con_fotos,
    activa: b.activa,
    destinatarios: { usuarios: b.usuarios, correos: correosDe(b.correos).validos },
  };
}

/** The request that flips a schedule between running and paused and changes nothing else. */
export function pedidaConActiva(p: Programacion, activa: boolean): ProgramacionPedida {
  return { ...pedidaDe(borradorDe(p)), activa };
}
