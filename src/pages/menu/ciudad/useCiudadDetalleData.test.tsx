import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PosteInterface } from "../../../interfaces/interfaces";

const searchCiudad = vi.fn();
const getPosteByCiudad = vi.fn();

vi.mock("../../../api/Ciudad.api", () => ({ searchCiudad: (...a: unknown[]) => searchCiudad(...a) }));
vi.mock("../../../api/Poste.api", () => ({ getPosteByCiudad: (...a: unknown[]) => getPosteByCiudad(...a) }));
vi.mock("../../../api/Tramo.api", () => ({ getTramos: () => Promise.resolve([]) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { useCiudadDetalleData } = await import("./useCiudadDetalleData");

const tramo = (id: number, nombre: string) => ({
  id, nombre, id_departamento: null, departamento: null, archivado: false,
  ciudades: [{ id: 11, name: "A", lat: 1, lng: 1 }, { id: 12 + id, name: "B", lat: 2, lng: 2 }],
});
const poste = (id: number, idTramo?: number) =>
  ({ id, name: `P-${id}`, ...(idTramo ? { id_tramo: idTramo, tramo: tramo(idTramo, `T${idTramo}`) } : {}) }) as unknown as PosteInterface;

beforeEach(() => {
  vi.clearAllMocks();
  searchCiudad.mockResolvedValue({ id: 11, name: "A" });
});

describe("grouping a city's poles by tramo", () => {
  it("puts two poles of the same id_tramo in one group, in the order the poles arrived", async () => {
    getPosteByCiudad.mockResolvedValue([poste(1, 30), poste(2, 5), poste(3, 30)]);
    const { result } = renderHook(() => useCiudadDetalleData(11, { verPostes: true, verTramos: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tramos.map((g) => [g.tramo.id, g.postes.map((p) => p.id)])).toEqual([
      [30, [1, 3]],
      [5, [2]],
    ]);
  });

  it("leaves out a pole without a tramo instead of breaking the grouping", async () => {
    getPosteByCiudad.mockResolvedValue([poste(1, 30), poste(2)]);
    const { result } = renderHook(() => useCiudadDetalleData(11, { verPostes: true, verTramos: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tramos).toHaveLength(1);
    expect(result.current.postes).toHaveLength(2);
  });
});
