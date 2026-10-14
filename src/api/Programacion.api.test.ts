// The history of every schedule: what the client asks for, and what it leaves
// out of the request.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { listarDestinatariosDeEjecucion, listarHistorial } from "./Programacion.api";

afterEach(() => {
  vi.restoreAllMocks();
});

const sobre = { data: { data: [], total: 0, page: 1, limit: 15 } };

describe("listarHistorial", () => {
  it("asks the runs of every schedule, and returns the envelope as it came", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    const respuesta = await listarHistorial({});

    expect(get).toHaveBeenCalledTimes(1);
    // `runs` after `schedules/` and with no identifier in between: the
    // server reads `schedules/:id/runs` as one schedule's.
    expect(String(get.mock.calls[0][0])).toMatch(/\/generator\/schedules\/runs$/);
    expect(respuesta).toEqual(sobre.data);
  });

  it("sends nothing that was not asked for: no empty strings, no undefined keys", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    await listarHistorial({});
    await listarHistorial({ page: undefined, limit: undefined, estado: undefined, id_programacion: undefined });

    for (const llamada of get.mock.calls) {
      expect(llamada[1]).toEqual({ params: {} });
      expect(Object.keys((llamada[1] as { params: object }).params)).toEqual([]);
    }
  });

  it("sends the page, the page size and each filter under the server's names", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    await listarHistorial({ page: 2, limit: 15, estado: "fallido", id_programacion: 5 });

    expect(get.mock.calls[0][1]).toEqual({ params: { page: 2, limit: 15, estado: "fallido", id_programacion: 5 } });
  });

  it("sends only the filters that are set", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    await listarHistorial({ estado: "omitido" });
    await listarHistorial({ id_programacion: 9 });

    expect(get.mock.calls[0][1]).toEqual({ params: { estado: "omitido" } });
    expect(get.mock.calls[1][1]).toEqual({ params: { id_programacion: 9 } });
  });

  it("lets a failure through for the screen to say", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("x"));
    await expect(listarHistorial({})).rejects.toThrow("x");
  });
});

describe("listarDestinatariosDeEjecucion", () => {
  it("asks for the recipients of one run, at the address under `runs` that names it", async () => {
    const respuesta = { data: { data: [{ id: 1, tipo: "usuario", nombre: "Beto", resultado: "entregado" }], total: 1, page: 1, limit: 50 } };
    const get = vi.spyOn(axios, "get").mockResolvedValue(respuesta);

    const sobre = await listarDestinatariosDeEjecucion(90);

    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toMatch(/\/generator\/schedules\/runs\/90\/recipients$/);
    expect(sobre).toEqual(respuesta.data);
  });

  it("lets a failure through for the popover to say", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("x"));
    await expect(listarDestinatariosDeEjecucion(90)).rejects.toThrow("x");
  });
});
