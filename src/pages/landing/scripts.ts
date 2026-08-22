/**
 * What happens, and when, in each of the four scenes.
 *
 * Timing and choreography live on the same line on purpose. They started out
 * apart — a list of milliseconds in one place, a list of cursor targets in
 * another, matched only by array index — and that arrangement has exactly one
 * failure mode: insert a beat, forget the other list, and from then on the
 * pointer clicks a button one moment before it exists. Here a step cannot drift
 * from its own timing because it is its own timing.
 *
 * `at` is measured from the moment the scene becomes visible. `duration` is the
 * whole scene including the pause at the end, and it is also how long the tab
 * holds before the showcase moves on.
 */

export interface Step {
  /** Milliseconds from the start of the scene. The first step must be 0. */
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
   * Not always the last one. Freezing the event scene at its end leaves a
   * register with one new row in it and no sign of the form that produced it,
   * which is the least informative frame in the whole sequence. A still
   * viewer should get the picture the motion was there to build, so each
   * scene names the frame that carries its argument.
   */
  stillStep?: number;
}

/** Poles land on the plan, one is opened, the view narrows to pending work. */
export const MAP_SCRIPT: Script = {
  duration: 10200,
  stillStep: 2, // the opened pole, with every pin still on the plan
  steps: [
    { at: 0 },
    { at: 1700, target: "map-pin" },
    { at: 3000, target: "map-pin", click: true },
    { at: 6000, target: "tab-pendientes" },
    { at: 6900, target: "tab-pendientes", click: true },
    { at: 7300, target: "tab-pendientes" },
  ],
};

/** A defect found in the street becomes a record with a photo and a severity. */
export const EVENT_SCRIPT: Script = {
  duration: 12400,
  stillStep: 10, // the form filled in, a moment before it is saved
  steps: [
    { at: 0 },
    { at: 900, target: "ev-poste" },
    { at: 1500, target: "ev-poste", click: true },
    { at: 2400, target: "ev-poste" },
    { at: 3000, target: "ev-option", click: true },
    { at: 3600, target: "ev-switch" },
    { at: 4050, target: "ev-switch", click: true },
    { at: 4500, target: "ev-desc" },
    { at: 6700, target: "ev-image" },
    { at: 8000, target: "ev-chip" },
    { at: 8400, target: "ev-chip", click: true },
    { at: 8900, target: "ev-save" },
    { at: 9400, target: "ev-save", click: true },
    { at: 10200, target: "ev-save" },
  ],
};

/** Totals and series draw in, then the period changes and everything redraws. */
export const DASH_SCRIPT: Script = {
  duration: 9400,
  stillStep: 5, // the month view, with a day called out
  steps: [
    { at: 0 },
    { at: 1600 },
    { at: 3400, target: "dash-period" },
    { at: 4000, target: "dash-period", click: true },
    { at: 4600, target: "dash-month", click: true },
    { at: 6400, target: "dash-bar" },
    { at: 8000, target: "dash-bar" },
  ],
};

/** Four columns are chosen, a condition is written, the result leaves as a file. */
export const REPORT_SCRIPT: Script = {
  duration: 11600,
  steps: [
    { at: 0 },
    { at: 700, target: "gen-f-nombre" },
    { at: 1150, target: "gen-f-nombre", click: true },
    { at: 1750, target: "gen-f-tramo" },
    { at: 2150, target: "gen-f-tramo", click: true },
    { at: 2750, target: "gen-f-fecha" },
    { at: 3150, target: "gen-f-fecha", click: true },
    { at: 3750, target: "gen-f-criticidad" },
    { at: 4150, target: "gen-f-criticidad", click: true },
    { at: 4750, target: "gen-addfilter" },
    { at: 5200, target: "gen-addfilter", click: true },
    { at: 6400, target: "gen-addfilter" },
    { at: 8000, target: "gen-export" },
    { at: 8500, target: "gen-export", click: true },
    { at: 9100, target: "gen-excel", click: true },
    { at: 9900, target: "gen-excel" },
  ],
};

/** Where the pointer is at a given step, and how many clicks it has landed. */
export function beatOf(script: Script, step: number): Step {
  return script.steps[Math.min(step, script.steps.length - 1)] ?? { at: 0 };
}

export function pressCount(script: Script, step: number): number {
  let n = 0;
  for (let i = 0; i <= step && i < script.steps.length; i++) {
    if (script.steps[i]?.click) n += 1;
  }
  return n;
}
