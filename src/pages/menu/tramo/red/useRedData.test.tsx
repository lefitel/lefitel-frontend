import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const getTramos = vi.fn();
const getOpcionesTramo = vi.fn();
const getPostesDelTramo = vi.fn();
const toastError = vi.fn();

vi.mock("../../../../api/Tramo.api", () => ({
  getTramos: (...a: unknown[]) => getTramos(...a),
  getOpcionesTramo: (...a: unknown[]) => getOpcionesTramo(...a),
}));
vi.mock("../../../../api/Poste.api", () => ({ getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a) }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

const { useRedData, usePostesDelTramo } = await import("./useRedData");

const tramo = (id: number) => ({
  id, nombre: `T${id}`, id_departamento: null, departamento: null, archivado: false,
  ciudades: [{ id: 1, name: "A", lat: 1, lng: 1 }, { id: 2, name: "B", lat: 2, lng: 2 }],
});
const opciones = {
  ciudad: [{ id: 1, name: "A", lat: 1, lng: 1 }, { id: 2, name: "B", lat: 2, lng: 2 }],
  departamento: [{ id: 5, name: "Cochabamba" }],
};
const poste = (id: number) => ({ id, name: `P-${id}` }) as unknown as PosteInterface;

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRedData", () => {
  it("goes from cargando to lista with the tramos, cities and departments", async () => {
    getTramos.mockResolvedValue([tramo(1)]);
    getOpcionesTramo.mockResolvedValue(opciones);
    const { result } = renderHook(() => useRedData());

    expect(result.current.estado).toBe("cargando");
    await waitFor(() => expect(result.current.estado).toBe("lista"));
    expect(result.current.tramos.map((t) => t.id)).toEqual([1]);
    expect(result.current.ciudades.map((c) => c.id)).toEqual([1, 2]);
    expect(result.current.departamentos).toEqual([{ id: 5, name: "Cochabamba" }]);
  });

  it("goes to fallo, with a toast, when the options fail", async () => {
    getTramos.mockResolvedValue([tramo(1)]);
    getOpcionesTramo.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useRedData());

    await waitFor(() => expect(result.current.estado).toBe("fallo"));
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("reloads without passing through cargando and resolves once both requests settled", async () => {
    getTramos.mockResolvedValueOnce([tramo(1)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const estados: string[] = [];
    const { result } = renderHook(() => {
      const r = useRedData();
      estados.push(r.estado);
      return r;
    });
    await waitFor(() => expect(result.current.estado).toBe("lista"));
    estados.length = 0;

    const lentos = diferido<typeof opciones>();
    getTramos.mockResolvedValueOnce([tramo(1), tramo(2)]);
    getOpcionesTramo.mockReturnValueOnce(lentos.promesa);
    let terminada = false;
    let promesa!: Promise<void>;
    act(() => { promesa = result.current.recargar().then(() => { terminada = true; }); });
    await Promise.resolve();
    expect(terminada).toBe(false);

    await act(async () => { lentos.resolver(opciones); await promesa; });
    expect(terminada).toBe(true);
    expect(result.current.tramos.map((t) => t.id)).toEqual([1, 2]);
    expect(estados).not.toContain("cargando");
  });

  it("keeps the data on screen, shows the toast and stays lista when a reload fails", async () => {
    getTramos.mockResolvedValueOnce([tramo(1)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const { result } = renderHook(() => useRedData());
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    getTramos.mockRejectedValueOnce(new Error("boom"));
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    await act(async () => { await result.current.recargar(); });

    expect(result.current.estado).toBe("lista");
    expect(result.current.tramos.map((t) => t.id)).toEqual([1]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("recovers from fallo by going back through cargando", async () => {
    getTramos.mockRejectedValueOnce(new Error("boom"));
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const { result } = renderHook(() => useRedData());
    await waitFor(() => expect(result.current.estado).toBe("fallo"));

    const lentos = diferido<typeof opciones>();
    getTramos.mockResolvedValueOnce([tramo(3)]);
    getOpcionesTramo.mockReturnValueOnce(lentos.promesa);
    let promesa!: Promise<void>;
    act(() => { promesa = result.current.recargar(); });
    expect(result.current.estado).toBe("cargando");

    await act(async () => { lentos.resolver(opciones); await promesa; });
    expect(result.current.estado).toBe("lista");
    expect(result.current.tramos.map((t) => t.id)).toEqual([3]);
  });

  it("lets only the last reload write when an older one answers late", async () => {
    getTramos.mockResolvedValueOnce([tramo(1)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const { result } = renderHook(() => useRedData());
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    const vieja = diferido<typeof opciones>();
    getTramos.mockResolvedValueOnce([tramo(10)]);
    getOpcionesTramo.mockReturnValueOnce(vieja.promesa);
    getTramos.mockResolvedValueOnce([tramo(20)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    let primera!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => { primera = result.current.recargar(); segunda = result.current.recargar(); });
    await act(async () => { await segunda; });
    await act(async () => { vieja.resolver(opciones); await primera; });

    expect(result.current.tramos.map((t) => t.id)).toEqual([20]);
  });
});

describe("useRedData recargando", () => {
  it("is up from the call until the last reload in flight settles, older ones included", async () => {
    getTramos.mockResolvedValueOnce([tramo(1)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const { result } = renderHook(() => useRedData());
    await waitFor(() => expect(result.current.estado).toBe("lista"));
    expect(result.current.recargando).toBe(false);

    const vieja = diferido<typeof opciones>();
    const nueva = diferido<typeof opciones>();
    getTramos.mockResolvedValueOnce([tramo(10)]);
    getOpcionesTramo.mockReturnValueOnce(vieja.promesa);
    getTramos.mockResolvedValueOnce([tramo(20)]);
    getOpcionesTramo.mockReturnValueOnce(nueva.promesa);
    let primera!: Promise<void>;
    let segunda!: Promise<void>;
    act(() => { primera = result.current.recargar(); });
    expect(result.current.recargando).toBe(true);
    act(() => { segunda = result.current.recargar(); });

    // The newer one answers first: the older is still out, so the flag stays up.
    await act(async () => { nueva.resolver(opciones); await segunda; });
    expect(result.current.recargando).toBe(true);
    expect(result.current.tramos.map((t) => t.id)).toEqual([20]);

    await act(async () => { vieja.resolver(opciones); await primera; });
    expect(result.current.recargando).toBe(false);
  });

  it("comes down when the reload fails, and never shows new data with the flag still up", async () => {
    getTramos.mockResolvedValueOnce([tramo(1)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    const vistos: string[] = [];
    const { result } = renderHook(() => {
      const r = useRedData();
      vistos.push(`${r.tramos.map((t) => t.id).join(",")}|${r.recargando}`);
      return r;
    });
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    getTramos.mockRejectedValueOnce(new Error("boom"));
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    await act(async () => { await result.current.recargar(); });
    expect(result.current.recargando).toBe(false);

    getTramos.mockResolvedValueOnce([tramo(1), tramo(2)]);
    getOpcionesTramo.mockResolvedValueOnce(opciones);
    await act(async () => { await result.current.recargar(); });
    expect(vistos).not.toContain("1,2|true");
    expect(vistos.at(-1)).toBe("1,2|false");
  });
});

describe("usePostesDelTramo", () => {
  it("returns the same empty list on every render while there are no poles", () => {
    const { result, rerender } = renderHook(() => usePostesDelTramo(null, true));
    const antes = result.current.postes;

    rerender();

    expect(result.current.postes).toBe(antes);
  });

  it("keeps the poles of the second tramo when the first one answers last", async () => {
    const primero = diferido<PosteInterface[]>();
    const segundo = diferido<PosteInterface[]>();
    getPostesDelTramo.mockImplementation((id: number) => (id === 1 ? primero.promesa : segundo.promesa));
    const { result, rerender } = renderHook(({ id }) => usePostesDelTramo(id, true), { initialProps: { id: 1 } });
    rerender({ id: 2 });

    await act(async () => { segundo.resolver([poste(20)]); });
    await act(async () => { primero.resolver([poste(10)]); });

    expect(result.current.postes.map((p) => p.id)).toEqual([20]);
    expect(result.current.cargando).toBe(false);
  });

  it("asks for nothing and returns no poles when it is not enabled", () => {
    const { result } = renderHook(() => usePostesDelTramo(1, false));
    expect(getPostesDelTramo).not.toHaveBeenCalled();
    expect(result.current).toEqual({ postes: [], cargando: false });
  });

  it("asks for nothing while there is no tramo", () => {
    const { result } = renderHook(() => usePostesDelTramo(null, true));
    expect(getPostesDelTramo).not.toHaveBeenCalled();
    expect(result.current).toEqual({ postes: [], cargando: false });
  });

  it("leaves the list empty and shows a toast when the request fails", async () => {
    getPostesDelTramo.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePostesDelTramo(1, true));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.postes).toEqual([]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
