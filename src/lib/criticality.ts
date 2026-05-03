export interface CriticalityMeta {
  level: number;
  label: string;
  /** Tailwind classes for foreground color */
  textClass: string;
  /** Tailwind classes for background color */
  bgClass: string;
  /** Tailwind classes for border color */
  borderClass: string;
}

export const CRITICALITY_LEVELS: CriticalityMeta[] = [
  { level: 1, label: "Catastrófico",        textClass: "text-red-700",    bgClass: "bg-red-500/15",     borderClass: "border-red-500/40" },
  { level: 2, label: "Ferretería suelta",   textClass: "text-orange-600", bgClass: "bg-orange-500/15",  borderClass: "border-orange-500/40" },
  { level: 3, label: "Sujeto a árbol",      textClass: "text-amber-600",  bgClass: "bg-amber-500/15",   borderClass: "border-amber-500/40" },
  { level: 4, label: "Daño estructural",    textClass: "text-yellow-700", bgClass: "bg-yellow-500/15",  borderClass: "border-yellow-500/40" },
  { level: 5, label: "Vano bajo",           textClass: "text-lime-700",   bgClass: "bg-lime-500/15",    borderClass: "border-lime-500/40" },
  { level: 6, label: "Fricción",            textClass: "text-emerald-700",bgClass: "bg-emerald-500/15", borderClass: "border-emerald-500/40" },
  { level: 7, label: "Estresado",           textClass: "text-teal-700",   bgClass: "bg-teal-500/15",    borderClass: "border-teal-500/40" },
  { level: 8, label: "Antivibradores",      textClass: "text-cyan-700",   bgClass: "bg-cyan-500/15",    borderClass: "border-cyan-500/40" },
  { level: 9, label: "Mantenimiento",       textClass: "text-blue-700",   bgClass: "bg-blue-500/15",    borderClass: "border-blue-500/40" },
];

export const UNCLASSIFIED_META: CriticalityMeta = {
  level: 0,
  label: "Sin clasificar",
  textClass: "text-muted-foreground",
  bgClass: "bg-muted",
  borderClass: "border-dashed border-muted-foreground/30",
};

export function getCriticalityMeta(level: number | null | undefined): CriticalityMeta {
  if (level == null) return UNCLASSIFIED_META;
  return CRITICALITY_LEVELS.find((c) => c.level === level) ?? UNCLASSIFIED_META;
}

/**
 * Returns the most critical level (lowest number, since 1 = catastrophic) of an event's observations.
 * Returns null if the event has no observations or all are unclassified.
 */
export function getEventCriticality(event: {
  eventoObs?: Array<{ ob?: { criticality?: number | null } | null }> | null;
}): number | null {
  const levels = (event.eventoObs ?? [])
    .map((eo) => eo.ob?.criticality)
    .filter((c): c is number => typeof c === "number");
  if (levels.length === 0) return null;
  return Math.min(...levels);
}
