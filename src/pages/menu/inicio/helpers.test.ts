// How long an incident has been open, said two ways.
//
// Two defects lived here. The span was computed without a floor, so a date in
// the future — which the date picker offers, up to ten years out, with nothing
// validating it — printed "-3 días" on the dashboard. And the phrase is built
// for reading on its own ("Hoy", "5 días"), while the pole's open-incident list
// wrapped it as `hace {…}` and rendered "hace Hoy".
//
// A future date is not "open for minus three days". Zero is the honest floor:
// the incident exists and has been open no time at all. That the date can be in
// the future at all is a separate problem, and it belongs in the database, which
// today has no rule against it.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chartBuckets, daysOpen, openedAgo, MAX_CHART_POINTS, WIDE_CHART_MIN_WIDTH, WIDE_CHART_POINTS } from "./helpers";

const AHORA = new Date("2026-08-26T15:00:00");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

describe("daysOpen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("dice los días completos que lleva abierto", () => {
    expect(daysOpen(hace(5))).toBe("5 días");
    expect(daysOpen(hace(1))).toBe("1 día");
    expect(daysOpen(hace(0))).toBe("Hoy");
  });

  it("nunca cuenta hacia atrás con una fecha futura", () => {
    expect(daysOpen(new Date(AHORA.getTime() + 3 * 86_400_000))).toBe("Hoy");
  });
});

describe("openedAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it("es una frase que se lee sola", () => {
    expect(openedAgo(hace(5))).toBe("hace 5 días");
    expect(openedAgo(hace(1))).toBe("hace 1 día");
  });

  it("no dice «hace hoy»", () => {
    expect(openedAgo(hace(0))).toBe("hoy");
  });

  it("tampoco cuenta hacia atrás", () => {
    expect(openedAgo(new Date(AHORA.getTime() + 3 * 86_400_000))).toBe("hoy");
  });
});

// ── How finely the activity chart cuts its period ────────────────────────────
//
// Every period button used to carry its own grain, written by hand: «3 meses»
// was cut by month and drew three points, «Este año» twelve, and only the
// custom range adapted to its own length. One rule now serves them all — the
// finest grain that does not pass a ceiling of points — up a ladder that ends
// in quarters and years, so «Todo» coarsens by itself as the data ages.
//
// The buckets also stop at the end of the period and are clipped to it, where
// the monthly ones used to be whole natural months: a chart may not count what
// the cards above it, reading the same period, leave out.
describe("chartBuckets", () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  /** A range of `days` calendar days starting 1 January 2025. */
  const deDias = (days: number) => chartBuckets(d(2025, 1, 1), new Date(2025, 0, days));

  it("has a ceiling of sixty points", () => {
    expect(MAX_CHART_POINTS).toBe(60);
  });

  it("cuts by day while the days fit", () => {
    expect(deDias(15).granularity).toBe("day");
    expect(deDias(15).buckets).toHaveLength(15);
    expect(deDias(60).granularity).toBe("day");
    expect(deDias(60).buckets).toHaveLength(60);
  });

  it("moves to weeks one day past the ceiling, and does not drop to a handful of points", () => {
    const r = deDias(61);
    expect(r.granularity).toBe("week");
    expect(r.buckets).toHaveLength(9);
  });

  it("cuts three months by week, not into three points", () => {
    const r = chartBuckets(d(2026, 8, 1), new Date(2026, 9, 12, 16, 30));
    expect(r.granularity).toBe("week");
    expect(r.buckets).toHaveLength(11);
  });

  it("moves to months one week past the ceiling", () => {
    expect(deDias(420).granularity).toBe("week");
    expect(deDias(420).buckets).toHaveLength(60);
    expect(deDias(421).granularity).toBe("month");
  });

  it("moves to quarters past sixty months, and to years past sixty quarters", () => {
    const quarters = chartBuckets(d(2020, 1, 1), d(2026, 10, 12));
    expect(quarters.granularity).toBe("quarter");
    expect(quarters.buckets).toHaveLength(28);
    expect(quarters.buckets[0].label).toBe("T1 '20");

    const years = chartBuckets(d(2005, 6, 1), d(2026, 10, 12));
    expect(years.granularity).toBe("year");
    expect(years.buckets.map((b) => b.label).slice(0, 2)).toEqual(["2005", "2006"]);
  });

  it("clips the first and last month to the period instead of counting whole months", () => {
    const r = chartBuckets(d(2024, 3, 12), d(2026, 10, 12));
    expect(r.granularity).toBe("month");
    expect(r.buckets[0].label).toBe("Mar '24");
    expect(r.buckets[0].desde).toBe(d(2024, 3, 12).getTime());
    expect(r.buckets[1].desde).toBe(d(2024, 4, 1).getTime());
    expect(r.buckets[r.buckets.length - 1].hasta).toBe(d(2026, 10, 13).getTime());
  });

  it("covers the period exactly, with no gap and no overlap, at every grain", () => {
    const ranges: [Date, Date][] = [
      [d(2025, 1, 1), d(2025, 1, 15)],
      [d(2025, 1, 1), d(2025, 3, 2)],
      // Across both clock changes: a bucket built from a fixed 24 hours drifts here.
      [d(2025, 3, 1), d(2025, 11, 20)],
      [d(2024, 3, 12), d(2026, 10, 12)],
      [d(2020, 1, 1), d(2026, 10, 12)],
      [d(2005, 6, 1), d(2026, 10, 12)],
    ];
    for (const [start, end] of ranges) {
      const { buckets } = chartBuckets(start, end);
      expect(buckets.length).toBeLessThanOrEqual(MAX_CHART_POINTS);
      expect(buckets[0].desde).toBe(start.getTime());
      // The end day is inside the period, so the last bucket closes at the next midnight.
      expect(buckets[buckets.length - 1].hasta)
        .toBe(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime());
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i].desde).toBe(buckets[i - 1].hasta);
        expect(buckets[i].hasta).toBeGreaterThan(buckets[i].desde);
      }
    }
  });

  it("draws a single day as one point", () => {
    const r = chartBuckets(d(2026, 10, 12), new Date(2026, 9, 12, 18, 0));
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].label).toBe("12/10");
  });
});

// What limits how many points a chart can hold is its width in pixels, not a
// fixed number: sixty points on a wide monitor leave twenty pixels each and
// room to spare. So the ceiling doubles once the chart is wide enough.
describe("the ceiling of a wide chart", () => {
  it("is twice the ordinary one, from a thousand pixels on", () => {
    expect(WIDE_CHART_POINTS).toBe(MAX_CHART_POINTS * 2);
    expect(WIDE_CHART_MIN_WIDTH).toBe(1000);
  });

  it("is what lets three months be read by day", () => {
    const start = new Date(2026, 7, 1), end = new Date(2026, 9, 12);

    expect(chartBuckets(start, end, MAX_CHART_POINTS).granularity).toBe("week");
    const wide = chartBuckets(start, end, WIDE_CHART_POINTS);
    expect(wide.granularity).toBe("day");
    expect(wide.buckets).toHaveLength(73);
  });
});
