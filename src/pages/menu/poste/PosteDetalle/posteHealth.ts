import { EventoInterface } from "../../../../interfaces/interfaces";

export type HealthStatus = "operativo" | "atencion" | "critico";

export interface HealthMetrics {
  status: HealthStatus;
  pendientes: number;
  criticos: number;
  mttrDays: number | null;
  totalResueltos: number;
  mttrSampleSize: number;
}

/**
 * When a resolved incident was closed: the date of its solution, and failing
 * that its last write. `null` when the incident carries neither.
 */
export function resolvedAt(evento: EventoInterface): Date | null {
  const end = evento.solucions?.[0]?.date ?? evento.updatedAt;
  return end ? new Date(end) : null;
}

/** Whole days an incident took to close, or `null` when that cannot be told. */
export function daysToResolve(evento: EventoInterface): number | null {
  const end = resolvedAt(evento);
  if (!end) return null;
  const ms = end.getTime() - new Date(evento.date).getTime();
  return ms > 0 ? ms / 86_400_000 : null;
}

export function computeMetrics(eventos: EventoInterface[]): HealthMetrics {
  const abiertos = eventos.filter((e) => !e.state);
  const criticos = abiertos.filter((e) => e.priority).length;
  const pendientes = abiertos.length;

  const status: HealthStatus =
    criticos > 0 ? "critico" : pendientes > 0 ? "atencion" : "operativo";

  const resueltos = eventos.filter((e) => e.state);
  const tiempos = resueltos
    .map(daysToResolve)
    .filter((d): d is number => d !== null);

  const mttrDays =
    tiempos.length > 0
      ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10
      : null;

  return { status, pendientes, criticos, mttrDays, totalResueltos: resueltos.length, mttrSampleSize: tiempos.length };
}

export const STATUS_CONFIG: Record<
  HealthStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  operativo: {
    label: "Operativo",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  atencion: {
    label: "Atención",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  critico: {
    label: "Crítico",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
  },
};
