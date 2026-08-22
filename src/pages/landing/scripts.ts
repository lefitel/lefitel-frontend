/**
 * What happens, and when, inside each piece of the showcase.
 *
 * Timing and choreography live on the same line on purpose. They started out
 * apart — a list of milliseconds in one place, a list of cursor targets in
 * another, matched only by array index — and that arrangement has exactly one
 * failure mode: insert a beat, forget the other list, and from then on the
 * pointer clicks a button one moment before it exists. Here a step cannot drift
 * from its own timing because it is its own timing.
 *
 * `at` is measured from the moment the piece first scrolls into view. Pieces
 * play once and then hold; nothing loops, because eleven things looping on one
 * page is a fairground, not a product.
 */

export interface Step {
  /** Milliseconds from the moment the piece enters the viewport. */
  at: number;
  /** `data-target` of the element the pointer travels to, if any. */
  target?: string;
  /** Whether the pointer clicks on arrival. */
  click?: boolean;
}

export interface Script {
  duration: number;
  steps: Step[];
  /**
   * The step to hold when the viewer has asked for less movement.
   *
   * Not always the last one: freezing the event form at its end leaves an empty
   * saved state with no sign of the form that produced it. A still viewer
   * should get the picture the motion was there to build, so a piece may name
   * the frame that carries its argument.
   */
  stillStep?: number;
}

/** A piece with nothing scripted: it simply animates in and stays. */
const ONE_SHOT: Script = { duration: 1600, steps: [{ at: 0 }] };

// ── 1 · the plan ─────────────────────────────────────────────────────────────
export const PLAN_SCRIPT = ONE_SHOT;

// ── 2 · the pole card ────────────────────────────────────────────────────────
export const CARD_SCRIPT: Script = {
  duration: 1800,
  steps: [{ at: 0 }, { at: 450 }],
};

// ── 3 · narrowing the view to pending work ───────────────────────────────────
export const FILTER_SCRIPT: Script = {
  duration: 3200,
  stillStep: 2,
  steps: [
    { at: 0 },
    { at: 700, target: "view-pendientes" },
    { at: 1200, target: "view-pendientes", click: true },
    { at: 1800, target: "view-pendientes" },
  ],
};

// ── 4 · filing what was found in the street ──────────────────────────────────
export const FORM_SCRIPT: Script = {
  duration: 9600,
  stillStep: 9,
  steps: [
    { at: 0 },
    { at: 700, target: "ev-poste" },
    { at: 1200, target: "ev-poste", click: true },
    { at: 2000, target: "ev-poste" },
    { at: 2500, target: "ev-option", click: true },
    { at: 3100, target: "ev-switch" },
    { at: 3500, target: "ev-switch", click: true },
    { at: 3950, target: "ev-desc" },
    { at: 6100, target: "ev-image" },
    { at: 7400, target: "ev-chip" },
    { at: 7800, target: "ev-chip", click: true },
    { at: 8300, target: "ev-save" },
  ],
};

// ── 5 · the notice and the new row ───────────────────────────────────────────
export const SAVED_SCRIPT: Script = {
  duration: 4400,
  stillStep: 2,
  // The notice goes away on its own, the way it does in the application. Held
  // on screen it would sit over the table header for as long as the page is
  // open, which is not what the reader is being shown.
  steps: [{ at: 0 }, { at: 400 }, { at: 3200 }],
};

// ── 6 · the totals ───────────────────────────────────────────────────────────
export const KPI_SCRIPT: Script = { duration: 2200, steps: [{ at: 0 }] };

// ── 7 · activity over time ───────────────────────────────────────────────────
export const CHART_SCRIPT: Script = {
  duration: 3400,
  steps: [{ at: 0 }, { at: 1500 }],
};

// ── 8 · changing the period ──────────────────────────────────────────────────
export const PERIOD_SCRIPT: Script = {
  duration: 4200,
  stillStep: 3,
  steps: [
    { at: 0 },
    { at: 600, target: "period-trigger" },
    { at: 1000, target: "period-trigger", click: true },
    { at: 1700, target: "period-month", click: true },
    { at: 2600, target: "period-month" },
  ],
};

// ── 9 · what is still open ───────────────────────────────────────────────────
export const CRITICALS_SCRIPT = ONE_SHOT;

// ── 10 · choosing the columns of a report ────────────────────────────────────
export const COLUMNS_SCRIPT: Script = {
  duration: 5200,
  steps: [
    { at: 0 },
    { at: 500, target: "gen-f-nombre" },
    { at: 900, target: "gen-f-nombre", click: true },
    { at: 1400, target: "gen-f-tramo" },
    { at: 1800, target: "gen-f-tramo", click: true },
    { at: 2300, target: "gen-f-fecha" },
    { at: 2700, target: "gen-f-fecha", click: true },
    { at: 3200, target: "gen-f-criticidad" },
    { at: 3600, target: "gen-f-criticidad", click: true },
    { at: 4200, target: "gen-f-criticidad" },
  ],
};

// ── 11 · the condition, the answer, the file ─────────────────────────────────
export const EXPORT_SCRIPT: Script = {
  duration: 6400,
  steps: [
    { at: 0 },
    { at: 500, target: "gen-addfilter" },
    { at: 900, target: "gen-addfilter", click: true },
    { at: 1800, target: "gen-addfilter" },
    { at: 3200, target: "gen-export" },
    { at: 3600, target: "gen-export", click: true },
    { at: 4300, target: "gen-excel", click: true },
    { at: 5200, target: "gen-excel" },
  ],
};

/** Where the pointer is at a given step. */
export function beatOf(script: Script, step: number): Step {
  return script.steps[Math.min(step, script.steps.length - 1)] ?? { at: 0 };
}

/** How many clicks the script has landed by this step, so the ring replays. */
export function pressCount(script: Script, step: number): number {
  let n = 0;
  for (let i = 0; i <= step && i < script.steps.length; i++) {
    if (script.steps[i]?.click) n += 1;
  }
  return n;
}

/** Beat table for the clock. */
export const beatsOf = (script: Script) => script.steps.map((s) => s.at);
