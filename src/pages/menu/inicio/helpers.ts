import { Period } from "./types";

export function getPeriodBounds(period: Period) {
  const now = new Date();
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
  return {
    start: new Date(2020, 0, 1),
    end: now,
    prevStart: new Date(2020, 0, 1),
    prevEnd: now,
  };
}

export function daysOpen(date: Date | string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}
