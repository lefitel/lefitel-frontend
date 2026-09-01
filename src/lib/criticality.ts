export interface CriticalityMeta {
  level: number;
  label: string;
  /**
   * Tailwind classes for foreground color. Each carries a lighter tone for
   * dark mode: the 600/700 weights these use on a light background all but
   * vanish against a dark one.
   */
  textClass: string;
  /** Tailwind classes for background color */
  bgClass: string;
  /** Tailwind classes for border color */
  borderClass: string;
}

export const CRITICALITY_LEVELS: CriticalityMeta[] = [
  { level: 1, label: "Catastrófico",        textClass: "text-red-700 dark:text-red-400",    bgClass: "bg-red-500/15",     borderClass: "border-red-500/40" },
  { level: 2, label: "Ferretería suelta",   textClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-500/15",  borderClass: "border-orange-500/40" },
  { level: 3, label: "Sujeto a árbol",      textClass: "text-amber-600 dark:text-amber-400",  bgClass: "bg-amber-500/15",   borderClass: "border-amber-500/40" },
  { level: 4, label: "Daño estructural",    textClass: "text-yellow-700 dark:text-yellow-400", bgClass: "bg-yellow-500/15",  borderClass: "border-yellow-500/40" },
  { level: 5, label: "Vano bajo",           textClass: "text-lime-700 dark:text-lime-400",   bgClass: "bg-lime-500/15",    borderClass: "border-lime-500/40" },
  { level: 6, label: "Fricción",            textClass: "text-emerald-700 dark:text-emerald-400",bgClass: "bg-emerald-500/15", borderClass: "border-emerald-500/40" },
  { level: 7, label: "Estresado",           textClass: "text-teal-700 dark:text-teal-400",   bgClass: "bg-teal-500/15",    borderClass: "border-teal-500/40" },
  { level: 8, label: "Antivibradores",      textClass: "text-cyan-700 dark:text-cyan-400",   bgClass: "bg-cyan-500/15",    borderClass: "border-cyan-500/40" },
  { level: 9, label: "Mantenimiento",       textClass: "text-blue-700 dark:text-blue-400",   bgClass: "bg-blue-500/15",    borderClass: "border-blue-500/40" },
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

/**
 * The bands the screens group the nine levels into, defined once.
 *
 * Every screen that filters by severity was writing these ranges out again —
 * `c >= 4 && c <= 5` here, `<= 3` there — which is how the same word came to
 * cover different rows on different screens. `value` is also the literal the
 * API expects as a filter (`evento.controller.ts` holds the matching map, and
 * `evento.list.test.ts` pins it), so the two sides of the wire cannot drift
 * apart without a test going red.
 *
 * `range: null` is "sin clasificar", which is the absence of a level rather
 * than a range of them — a distinction the SQL has to make too.
 */
export const CRITICALITY_BANDS = [
  { value: "criticas", label: "Críticas", range: [1, 3] },
  { value: "altas", label: "Altas", range: [4, 5] },
  { value: "medias", label: "Medias", range: [6, 7] },
  { value: "bajas", label: "Bajas", range: [8, 9] },
  { value: "sin", label: "Sin clasif.", range: null },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  range: readonly [number, number] | null;
}>;

export type CriticalityBand = (typeof CRITICALITY_BANDS)[number]["value"];

/** Options for a `SegmentedControl`, with "todas" in front. */
export const CRITICALITY_BAND_OPTIONS = [
  { value: "all" as const, label: "Todas" },
  ...CRITICALITY_BANDS.map((b) => ({ value: b.value, label: b.label })),
];

/** Whether a level falls in a band. `"all"` accepts everything, unclassified included. */
export function matchesCriticalityBand(
  level: number | null | undefined,
  band: CriticalityBand | "all",
): boolean {
  if (band === "all") return true;
  const found = CRITICALITY_BANDS.find((b) => b.value === band);
  if (!found) return true;
  if (found.range === null) return level == null;
  return level != null && level >= found.range[0] && level <= found.range[1];
}
