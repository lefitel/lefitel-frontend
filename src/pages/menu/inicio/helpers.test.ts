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
import { daysOpen, openedAgo } from "./helpers";

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
