/**
 * Everything the section pretends to be true, in one place.
 *
 * The eleven pieces below tell one story out of order: a pole is found on the
 * plan, its defect is filed, the filed defect turns up in the totals, and the
 * totals leave as a spreadsheet. That thread is the only thing separating a
 * product tour from a bag of pretty widgets, and it breaks the moment two
 * pieces disagree about how many critical poles there are. So no piece invents
 * its own numbers: they all read from here.
 *
 * None of it is real. The tool is; the poles are not. The page is public, so no
 * defect is ever attributed to a named operator.
 */

export const NETWORK = {
  total: 1661,
  crit: 10,
  warn: 138,
  ok: 1386,
  idle: 127,
  cities: 99,
  /** Poles still waiting for a crew: critical plus pending. */
  get open() {
    return this.crit + this.warn;
  },
};

/** The pole the whole section follows. */
export const POLE = {
  id: "P-0472",
  tramo: "Tramo Norte · Km 12,4",
  owner: "Operadora regional",
  material: "Hormigón armado",
  height: "11,5 m",
  lastCheck: "14 ago 2026",
  openEvents: 2,
};

/** The defect filed against it, and the record that comes out. */
export const EVENT = {
  id: "EV-2292",
  obs: "Ferretería suelta",
  description: "Ferretería suelta en cruceta superior, riesgo de caída sobre la vía.",
  photo: "P0472-cruceta.jpg",
  date: "21 ago",
};

/** The observation vocabulary, with the colours the application gives it. */
export const OBS = {
  catastrofico: { label: "Catastrófico", color: "oklch(0.655 0.205 25)" },
  ferreteria: { label: "Ferretería suelta", color: "oklch(0.755 0.155 62)" },
  arbol: { label: "Sujeto a árbol", color: "oklch(0.80 0.15 85)" },
  estructural: { label: "Daño estructural", color: "oklch(0.80 0.15 85)" },
  vano: { label: "Vano bajo", color: "oklch(0.78 0.16 118)" },
  friccion: { label: "Fricción", color: "oklch(0.745 0.135 162)" },
  estresado: { label: "Estresado", color: "oklch(0.72 0.11 195)" },
  antivibradores: { label: "Antivibradores", color: "oklch(0.72 0.10 225)" },
  mantenimiento: { label: "Mantenimiento", color: "oklch(0.66 0.11 258)" },
} as const;

/** The register, newest last: the saved piece puts EVENT on top of it. */
export const REGISTER = [
  { id: "EV-2291", pole: "P-0384", obs: OBS.arbol, state: "Revisado", date: "19 ago" },
  { id: "EV-2290", pole: "P-0227", obs: OBS.estresado, state: "Solucionado", date: "19 ago" },
  { id: "EV-2289", pole: "P-0611", obs: OBS.catastrofico, state: "Pendiente", date: "18 ago" },
  { id: "EV-2288", pole: "P-0118", obs: OBS.antivibradores, state: "Solucionado", date: "18 ago" },
];

/** Totals for the fortnight, and for the month the period switch moves to. */
export const TOTALS = {
  fortnight: [
    { label: "Creados", value: 128, delta: 12.4, up: true },
    { label: "Revisados", value: 96, delta: 8.1, up: true },
    { label: "Solucionados", value: 74, delta: 15.2, up: true },
    { label: "Pendientes", value: 38, delta: -9.6, up: false },
  ],
  month: [
    { label: "Creados", value: 271, delta: 18.9, up: true },
    { label: "Revisados", value: 214, delta: 11.3, up: true },
    { label: "Solucionados", value: 183, delta: 22.7, up: true },
    { label: "Pendientes", value: 52, delta: -4.2, up: false },
  ],
} as const;

export const SERIES = {
  fortnight: {
    created: [6, 9, 5, 12, 8, 14, 11, 7, 13, 16, 9, 12, 10, 15],
    solved: [3, 6, 4, 8, 6, 9, 8, 5, 9, 12, 7, 9, 8, 11],
    labels: ["7 ago", "10 ago", "13 ago", "16 ago", "19 ago"],
  },
  month: {
    created: [
      4, 8, 6, 11, 7, 13, 9, 15, 10, 6, 12, 8, 14, 9, 17, 11, 7, 13, 16, 10, 8, 14, 12, 18, 9, 15,
      11, 13, 16, 12,
    ],
    solved: [
      2, 5, 4, 7, 5, 9, 6, 11, 7, 4, 8, 6, 10, 6, 12, 8, 5, 9, 11, 7, 6, 10, 9, 13, 6, 11, 8, 9, 12,
      9,
    ],
    labels: ["1 ago", "7 ago", "13 ago", "19 ago", "25 ago"],
  },
} as const;

/** The ten unresolved criticals: counted on the plan, listed here, exported last. */
export const CRITICALS = [
  { id: "EV-2289", pole: "P-0611", tramo: "Tramo Sur", days: 3, date: "18 ago 2026" },
  { id: "EV-2277", pole: "P-0289", tramo: "Tramo Sur", days: 4, date: "17 ago 2026" },
  { id: "EV-2271", pole: "P-0154", tramo: "Tramo Centro", days: 5, date: "16 ago 2026" },
  { id: "EV-2268", pole: "P-0733", tramo: "Tramo Este", days: 6, date: "15 ago 2026" },
  { id: "EV-2266", pole: "P-0402", tramo: "Tramo Norte", days: 6, date: "15 ago 2026" },
  { id: "EV-2259", pole: "P-0918", tramo: "Tramo Este", days: 8, date: "13 ago 2026" },
  { id: "EV-2254", pole: "P-0067", tramo: "Tramo Centro", days: 9, date: "12 ago 2026" },
  { id: "EV-2248", pole: "P-0525", tramo: "Tramo Sur", days: 10, date: "11 ago 2026" },
  { id: "EV-2241", pole: "P-0881", tramo: "Tramo Norte", days: 11, date: "10 ago 2026" },
  { id: "EV-2236", pole: "P-0243", tramo: "Tramo Centro", days: 12, date: "9 ago 2026" },
];
