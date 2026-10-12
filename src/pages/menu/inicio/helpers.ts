import { MONTH_NAMES, Period } from "./types";

export function getPeriodBounds(period: Period) {
  const now = new Date();
  if (period === "fortnight") {
    const start = new Date(now);
    start.setDate(start.getDate() - 14);
    start.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 14);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end: now, prevStart, prevEnd };
  }
  if (period === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (period === "quarter") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end: now,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      prevEnd: new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59),
    };
  }
  if (period === "year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: now,
      prevStart: new Date(now.getFullYear() - 1, 0, 1),
      prevEnd: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
    };
  }
  if (period === "custom") {
    return { start: now, end: now, prevStart: now, prevEnd: now };
  }
  return {
    start: new Date(2020, 0, 1),
    end: now,
    prevStart: new Date(2020, 0, 1),
    prevEnd: now,
  };
}

export type Granularity = "day" | "week" | "month" | "quarter" | "year";

/** A slice of the chart's period: `[desde, hasta)` in milliseconds. */
export interface ChartBucket {
  label: string;
  desde: number;
  hasta: number;
}

/**
 * The most points the activity chart draws on a chart of ordinary width.
 * Chosen with the figures in front: at 60 the six weeks the dashboard opens on
 * stay daily, a year reads by week and the whole history by month until it is
 * five years deep.
 */
export const MAX_CHART_POINTS = 60;

/**
 * The ceiling on a chart at least `WIDE_CHART_MIN_WIDTH` pixels wide: 120
 * points across a thousand pixels still leave each one about eight. A 1280px
 * laptop with the sidebar open gives the chart some 1020px, so it is on the
 * wide side of the line.
 *
 * Two steps, not a ceiling proportional to the width: the grain is something
 * people read off the caption and compare across screens, and it should not
 * shift with every few pixels of a window being dragged.
 */
export const WIDE_CHART_POINTS = 120;
export const WIDE_CHART_MIN_WIDTH = 1000;

const yy = (year: number) => `'${String(year).slice(2)}`;

/**
 * Cuts `[start, end]` into the buckets the activity chart draws: the finest
 * grain — day, week, month, quarter, year — that does not pass `max` points.
 *
 * One rule for every period, so none of them has a grain of its own to fall
 * out of step: «3 meses» was cut by month and drew three points. The floor
 * follows from the ceiling — a step up divides the points by seven at most —
 * except for a range of a few days, which has no finer grain to fall to.
 *
 * The buckets are contiguous and cover exactly from the first midnight of
 * `start` to the midnight after `end`, so their counts add up to the period's
 * and nothing beyond it is drawn. Weeks are seven days from `start`, not
 * calendar weeks: a calendar week would open the chart on a partial bucket
 * that reads as a dip. Months, quarters and years are calendar ones, clipped
 * at both ends.
 *
 * Boundaries are built from calendar fields, never by adding 24 hours: across
 * a clock change that drifts an hour and moves an event into the wrong day.
 */
export function chartBuckets(start: Date, end: Date, max = MAX_CHART_POINTS): { granularity: Granularity; buckets: ChartBucket[] } {
  const y = start.getFullYear(), m = start.getMonth(), d = start.getDate();
  const first = new Date(y, m, d).getTime();
  // An end before its start is a range of one day, not of none.
  const limit = Math.max(
    new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime(),
    new Date(y, m, d + 1).getTime(),
  );
  const last = new Date(limit - 1);

  // `round`, because a day with a clock change in it is 23 or 25 hours long.
  const days = Math.round((limit - first) / 86_400_000);
  const dayLabel = (t: Date) => `${t.getDate()}/${t.getMonth() + 1}`;

  /** `count` buckets whose i-th boundary is `edge(i)`, clipped to the period. */
  const cut = (count: number, edge: (i: number) => Date, label: (from: Date) => string): ChartBucket[] =>
    Array.from({ length: count }, (_, i) => {
      const from = edge(i);
      return {
        label: label(from),
        desde: Math.max(from.getTime(), first),
        hasta: Math.min(edge(i + 1).getTime(), limit),
      };
    });

  if (days <= max) {
    return { granularity: "day", buckets: cut(days, (i) => new Date(y, m, d + i), dayLabel) };
  }

  const weeks = Math.ceil(days / 7);
  if (weeks <= max) {
    return { granularity: "week", buckets: cut(weeks, (i) => new Date(y, m, d + i * 7), dayLabel) };
  }

  const months = (last.getFullYear() - y) * 12 + (last.getMonth() - m) + 1;
  if (months <= max) {
    return {
      granularity: "month",
      buckets: cut(months, (i) => new Date(y, m + i, 1), (t) => `${MONTH_NAMES[t.getMonth()]} ${yy(t.getFullYear())}`),
    };
  }

  const q = Math.floor(m / 3);
  const quarters = (last.getFullYear() - y) * 4 + (Math.floor(last.getMonth() / 3) - q) + 1;
  if (quarters <= max) {
    return {
      granularity: "quarter",
      buckets: cut(quarters, (i) => new Date(y, (q + i) * 3, 1), (t) => `T${Math.floor(t.getMonth() / 3) + 1} ${yy(t.getFullYear())}`),
    };
  }

  return {
    granularity: "year",
    buckets: cut(last.getFullYear() - y + 1, (i) => new Date(y + i, 0, 1), (t) => String(t.getFullYear())),
  };
}

/** What the chart writes under one point: see `axisLabels`. */
export interface AxisLabel {
  /** The part of the date that changes at every point. */
  tick: string;
  /** The part the points share, on the first point that has it; `null` on the rest. */
  group: string | null;
}

/**
 * The dates under the chart's points, split over two rows.
 *
 * A whole date at every point — "12/10" — is wide, and with seventy points one
 * in five had room. So each point keeps only what tells it from its neighbour,
 * and what they share is written once beneath: the day over the month, the
 * month or the quarter over the year. A year has nothing above it to share.
 *
 * @param starts Where each bucket begins, in the order they are drawn.
 */
export function axisLabels(starts: number[], granularity: Granularity): AxisLabel[] {
  let previous: string | null = null;
  return starts.map((ms) => {
    const t = new Date(ms);
    const year = String(t.getFullYear());
    const [tick, shared] =
      granularity === "year"    ? [year, null] :
      granularity === "quarter" ? [`T${Math.floor(t.getMonth() / 3) + 1}`, year] :
      granularity === "month"   ? [MONTH_NAMES[t.getMonth()], year] :
      [String(t.getDate()), `${MONTH_NAMES[t.getMonth()]} ${yy(t.getFullYear())}`];
    const group = shared !== previous ? shared : null;
    previous = shared;
    return { tick, group };
  });
}

/**
 * Whole days since `date`, floored at zero.
 *
 * A date in the future is not "open for minus three days", and the date picker
 * offers up to ten years ahead with nothing validating it, so the dashboard
 * really did print "-3 días". That the date can be in the future at all is a
 * separate problem and belongs in the database, which has no rule against it.
 */
function daysSince(date: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

/** The span on its own, to sit in a column: "Hoy", "1 día", "5 días". */
export function daysOpen(date: Date | string): string {
  const days = daysSince(date);
  if (days === 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

/**
 * The same span as a phrase that reads by itself: "hoy", "hace 5 días".
 *
 * For the callers that wanted `hace {…}` around `daysOpen` and got "hace Hoy".
 */
export function openedAgo(date: Date | string): string {
  const days = daysSince(date);
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}
