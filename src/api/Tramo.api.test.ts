// The tramo client: what it sends, and what it reads out of a refusal.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import {
  createTramo, editTramo, getTramos, tramoDelConflicto,
} from "./Tramo.api";
import type { Tramo } from "../interfaces/interfaces";

afterEach(() => {
  vi.restoreAllMocks();
});

const TRAMO: Tramo = {
  id: 14,
  nombre: "Potosí – Sucre",
  ciudades: [
    { id: 7, name: "Potosí", lat: -19.58, lng: -65.75 },
    { id: 3, name: "Sucre", lat: -19.04, lng: -65.26 },
  ],
  id_departamento: null,
  departamento: null,
  archivado: false,
};

const sobre = { data: { data: [], total: 0, page: 1, limit: "all" } };

describe("createTramo", () => {
  it("creates with the two cities in the order they were picked, and no department key when none was chosen", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: TRAMO });

    const creado = await createTramo({ ciudades: [7, 3] });

    expect(post).toHaveBeenCalledTimes(1);
    expect(String(post.mock.calls[0][0])).toMatch(/\/api\/tramo\/$/);
    expect(post.mock.calls[0][1]).toEqual({ ciudades: [7, 3] });
    expect(Object.keys(post.mock.calls[0][1] as object)).not.toContain("id_departamento");
    expect(creado).toEqual(TRAMO);
  });
});

describe("the department", () => {
  it("sends a department only when one is set, and null to clear it on edit", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: TRAMO });
    const put = vi.spyOn(axios, "put").mockResolvedValue({ data: TRAMO });

    await createTramo({ ciudades: [7, 3], id_departamento: 5 });
    expect(post.mock.calls[0][1]).toEqual({ ciudades: [7, 3], id_departamento: 5 });

    await editTramo(14, { id_departamento: null });
    expect(String(put.mock.calls[0][0])).toMatch(/\/api\/tramo\/14$/);
    expect(put.mock.calls[0][1]).toEqual({ id_departamento: null });
  });
});

describe("getTramos", () => {
  it("asks for every live tramo, and sends no department filter", async () => {
    // An empty `departamento` is a 400 on the server, not "all of them".
    const get = vi.spyOn(axios, "get").mockResolvedValue(sobre);

    await getTramos();

    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/tramo\/$/);
    const params = (get.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    expect(Object.keys(params)).not.toContain("departamento");
    expect(params.limit).toBe("all");
  });
});

describe("tramoDelConflicto", () => {
  it("reads the tramo out of a 409, and nothing out of any other failure", () => {
    const conflicto = { response: { status: 409, data: { message: "Ya existe", tramo: TRAMO } } };
    expect(tramoDelConflicto(conflicto)).toEqual(TRAMO);

    expect(tramoDelConflicto({ response: { status: 400, data: { message: "x", tramo: TRAMO } } })).toBeNull();
    expect(tramoDelConflicto(new Error("sin red"))).toBeNull();
    expect(tramoDelConflicto({ response: { status: 409, data: { message: "tiene postes" } } })).toBeNull();
    expect(tramoDelConflicto(undefined)).toBeNull();
  });
});
