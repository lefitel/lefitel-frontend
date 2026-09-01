import { Period } from "./types";

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
