// What the incident client sends for the questions that are not the list screen's own.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { getEventosPendientesDelTramo } from "./Evento.api";

afterEach(() => {
  vi.restoreAllMocks();
});

const sobre = { data: { data: [], total: 0, page: 1, limit: "all" } };

describe("getEventosPendientesDelTramo", () => {
  it("asks the incident list for one tramo's pending rows, all of them", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    await getEventosPendientesDelTramo(14);

    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/evento\/$/);
    const params = (get.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    // The tramo is the scope of the question: a parameter of its own.
    expect(params.tramo).toBe(14);
    // "Pending" is the list's ordinary state filter, so the card and the
    // Eventos screen cannot disagree about what pending means.
    expect(params.filterColumn).toEqual(["state"]);
    expect(params.filterValue).toEqual(["pending"]);
    expect(params.limit).toBe("all");
  });
});
