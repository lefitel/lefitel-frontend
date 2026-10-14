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
 * The values are invented; their *shape* is not, and the difference matters. An
 * earlier version of this file had poles called `P-0472` on a "Tramo Norte · Km
 * 12,4", 11,5 metres tall and owned by an "Operadora regional". Every one of
 * those was wrong about the system it claims to show: poles are named `P472`
 * with no padding, a tramo is the stretch between two towns, there is no height
 * field at all, and the owner is the electricity company whose poles the fibre
 * is strung on, not the telecom. A mockup that gets the shape wrong teaches a
 * client to expect something the product does not do.
 *
 * What stays invented, deliberately: the pole numbers, the defects and the
 * dates. The page is public, so no real asset is ever shown with a fault
 * against it, and no operator is named beside one.
 */

export const NETWORK = {
  total: 1541,
  crit: 10,
  warn: 138,
  ok: 1266,
  idle: 127,
  cities: 86,
  tramos: 111,
  /** Poles still waiting for a crew: critical plus pending. */
  get open() {
    return this.crit + this.warn;
  },
};

/**
 * The nine-step criticality scale, which is real: it is the one in
 * `lib/criticality.ts` that the technicians read in the field. Colours are the
 * same hues, lifted for a dark surface.
 */
const LEVELS = [
  { level: 1, label: "Catastrófico", color: "oklch(0.655 0.205 25)" },
  { level: 2, label: "Ferretería suelta", color: "oklch(0.755 0.155 62)" },
  { level: 3, label: "Sujeto a árbol", color: "oklch(0.80 0.15 85)" },
  { level: 4, label: "Daño estructural", color: "oklch(0.83 0.15 95)" },
  { level: 5, label: "Vano bajo", color: "oklch(0.78 0.16 118)" },
  { level: 6, label: "Fricción", color: "oklch(0.745 0.135 162)" },
  { level: 7, label: "Estresado", color: "oklch(0.74 0.12 185)" },
  { level: 8, label: "Antivibradores", color: "oklch(0.72 0.11 205)" },
  { level: 9, label: "Mantenimiento", color: "oklch(0.66 0.11 258)" },
] as const;

const tone = (level: number) => LEVELS[level - 1]?.color ?? "oklch(0.66 0.11 258)";

/**
 * Observations, which are a different thing from criticality levels and were
 * being confused with them. An event carries an observation — "Mufla suelta" —
 * and the observation carries the level that colours it. These names are the
 * catalogue's own, generic trade vocabulary belonging to nobody.
 */
export const OBS = {
  caido: { label: "Poste caído", level: 1, color: tone(1) },
  suelto: { label: "Poste suelto en piso", level: 1, color: tone(1) },
  fibraPiso: { label: "Fibra en el piso", level: 1, color: tone(1) },
  fibraCasa: { label: "Fibra apoyada en vivienda", level: 1, color: tone(1) },
  ferreteria: { label: "Ferretería fuera de poste", level: 2, color: tone(2) },
  mufla: { label: "Mufla suelta", level: 2, color: tone(2) },
  arbol: { label: "Reserva sujeta a un árbol", level: 3, color: tone(3) },
  ladeado: { label: "Poste ladeado", level: 4, color: tone(4) },
  vano: { label: "Vano bajo", level: 5, color: tone(5) },
  friccion: { label: "Fibra haciendo fricción en poste", level: 6, color: tone(6) },
  estresado: { label: "FO estresado por cable", level: 7, color: tone(7) },
  antivibrador: { label: "Sin anti vibrador o dañado", level: 8, color: tone(8) },
  limpieza: { label: "Limpieza de postes", level: 9, color: tone(9) },
} as const;

/** The level a criticality chip shows, by number. */
export const CATASTROFICO = LEVELS[0];

/**
 * The pole the whole section follows. Named and described the way the system
 * really names and describes one, with an invented number.
 */
export const POLE = {
  id: "P472",
  tramo: "Coroico › Coripata",
  owner: "Cooperativa eléctrica",
  material: "Concreto",
  installed: "12 mar 2019",
  lastCheck: "14 ago 2026",
  openEvents: 2,
};

/** The defect filed against it, and the record that comes out. */
export const EVENT = {
  row: 1,
  obs: OBS.ferreteria,
  description: "Ferretería fuera de poste en cruceta superior, riesgo de caída sobre la vía.",
  photo: "P472-cruceta.jpg",
  date: "21 ago",
};

/** The register, newest last: the saved piece puts EVENT on top of it. */
export const REGISTER = [
  { row: 2, pole: "P384", obs: OBS.arbol, state: "Revisado", date: "19 ago" },
  { row: 3, pole: "P227", obs: OBS.estresado, state: "Solucionado", date: "19 ago" },
  { row: 4, pole: "P611", obs: OBS.caido, state: "Pendiente", date: "18 ago" },
  { row: 5, pole: "P118", obs: OBS.antivibrador, state: "Solucionado", date: "18 ago" },
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

/**
 * The ten unresolved criticals: counted on the plan, listed on the dashboard,
 * exported last. Tramos are pairs of real Bolivian towns because that is what a
 * tramo is; the pole numbers and the faults on them are made up.
 */
export const CRITICALS = [
  { row: 1, pole: "P611", tramo: "Coroico › Coripata", obs: OBS.caido, days: 3, date: "18 ago 2026" },
  { row: 2, pole: "P289", tramo: "Viacha › Desaguadero", obs: OBS.fibraPiso, days: 4, date: "17 ago 2026" },
  { row: 3, pole: "P154", tramo: "Irupana › Chulumani", obs: OBS.suelto, days: 5, date: "16 ago 2026" },
  { row: 4, pole: "P733", tramo: "Caracollo › Morochata", obs: OBS.fibraCasa, days: 6, date: "15 ago 2026" },
  { row: 5, pole: "P402", tramo: "Inquisivi › Cajuata", obs: OBS.caido, days: 6, date: "15 ago 2026" },
  { row: 6, pole: "P918", tramo: "Coroico › Coripata", obs: OBS.fibraPiso, days: 8, date: "13 ago 2026" },
  { row: 7, pole: "P67", tramo: "Viacha › Desaguadero", obs: OBS.suelto, days: 9, date: "12 ago 2026" },
  { row: 8, pole: "P525", tramo: "Irupana › Chulumani", obs: OBS.caido, days: 10, date: "11 ago 2026" },
  { row: 9, pole: "P881", tramo: "Caracollo › Morochata", obs: OBS.fibraCasa, days: 11, date: "10 ago 2026" },
  { row: 10, pole: "P243", tramo: "Inquisivi › Cajuata", obs: OBS.fibraPiso, days: 12, date: "9 ago 2026" },
];
