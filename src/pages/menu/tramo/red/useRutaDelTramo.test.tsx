import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { PosteInterface } from "../../../../interfaces/interfaces";
import { useRutaDelTramo } from "./useRutaDelTramo";

const fetchOrsRoute = vi.fn();
vi.mock("../../../../lib/orsRoute", () => ({ fetchOrsRoute: (...a: unknown[]) => fetchOrsRoute(...a) }));

function diferido<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((res) => { resolver = res; });
  return { promesa, resolver };
}

const CIUDADES: CiudadDeRed[] = [
  { id: 1, name: "Uno", lat: -17, lng: -65, image: null },
  { id: 2, name: "Dos", lat: -17.4, lng: -64.6, image: null },
  { id: 3, name: "Tres", lat: -17.4, lng: -64.2, image: null },
  { id: 4, name: "Sin sitio", lat: null, lng: null, image: null },
];
const tramo = (id: number, a: number, b: number): TramoConCifras => ({
  id, nombre: `${a}-${b}`, id_departamento: null, departamento: null, archivado: false,
  ciudades: [{ id: a, name: null, lat: null, lng: null }, { id: b, name: null, lat: null, lng: null }],
});
const T10 = tramo(10, 1, 2);
const T11 = tramo(11, 2, 3);
const poste = (id: number, lat: number, lng: number) => ({ id, name: `P-${id}`, lat, lng }) as unknown as PosteInterface;

const RUTA: [number, number][] = [[-17, -65], [-17.2, -64.8], [-17.4, -64.6]];
const RUTA_B: [number, number][] = [[-17.4, -64.6], [-17.4, -64.2]];
const enPuntos = (r: [number, number][]) => r.map(([lat, lng]) => ({ lat, lng }));

type Props = Parameters<typeof useRutaDelTramo>[0];
const base = (): Props => ({ tramo: T10, ciudades: CIUDADES, postes: [], cargandoPostes: false });
const pintar = (over: Partial<Props> = {}) => {
  const inicial = { ...base(), ...over };
  return renderHook((p: Props) => useRutaDelTramo(p), { initialProps: inicial });
};
const dejarPasar = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  fetchOrsRoute.mockResolvedValue(RUTA);
});

describe("asking for the route", () => {
  it("is pending until the answer arrives, then holds the route as {lat, lng} points", async () => {
    const d = diferido<[number, number][] | null>();
    fetchOrsRoute.mockReturnValue(d.promesa);
    const { result } = pintar();

    expect(result.current).toEqual({ estado: "pendiente" });
    await act(async () => { d.resolver(RUTA); await d.promesa; });

    expect(result.current).toEqual({ estado: "lista", puntos: enPuntos(RUTA) });
  });

  it("answers sinRuta when there is no route", async () => {
    fetchOrsRoute.mockResolvedValue(null);
    const { result } = pintar();

    await waitFor(() => expect(result.current).toEqual({ estado: "sinRuta" }));
  });

  it("builds the waypoints as end, poles in tramo order, end, [lng, lat], leaving out poles without coordinates", async () => {
    // Registered out of order, on the way from Uno (lng -65) to Dos (lng -64.6); one has no position.
    const postes = [poste(3, -17.3, -64.7), poste(1, -17.1, -64.9), poste(9, 0, 0), poste(2, -17.2, -64.8)];
    pintar({ postes });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    expect(fetchOrsRoute).toHaveBeenCalledWith([
      [-65, -17], [-64.9, -17.1], [-64.8, -17.2], [-64.7, -17.3], [-64.6, -17.4],
    ]);
  });

  it("asks with the two ends alone when there are no poles (a role without postes.ver)", async () => {
    pintar({ postes: [], cargandoPostes: false });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    expect(fetchOrsRoute).toHaveBeenCalledWith([[-65, -17], [-64.6, -17.4]]);
  });

  it("takes the end of an archived city from the position the tramo carries", async () => {
    const t: TramoConCifras = {
      ...tramo(12, 1, 9),
      ciudades: [{ id: 1, name: null, lat: null, lng: null }, { id: 9, name: "Archivada", lat: -17.4, lng: -64.6 }],
    };
    pintar({ tramo: t });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledWith([[-65, -17], [-64.6, -17.4]]));
  });
});

describe("when it does not ask", () => {
  it("waits for the poles to finish loading and then asks once, with them", async () => {
    const { result, rerender } = pintar({ cargandoPostes: true });
    await dejarPasar();

    expect(fetchOrsRoute).not.toHaveBeenCalled();
    expect(result.current).toEqual({ estado: "pendiente" });

    rerender({ ...base(), cargandoPostes: false, postes: [poste(1, -17.2, -64.8)] });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    expect(fetchOrsRoute).toHaveBeenCalledWith([[-65, -17], [-64.8, -17.2], [-64.6, -17.4]]);
  });

  it("does not ask for an end that has no position, and draws nothing", async () => {
    const { result } = pintar({ tramo: tramo(13, 1, 4) });
    await dejarPasar();

    expect(fetchOrsRoute).not.toHaveBeenCalled();
    expect(result.current).toEqual({ estado: "pendiente" });
  });

  it("does not ask without a tramo", async () => {
    const { result } = pintar({ tramo: undefined });
    await dejarPasar();

    expect(fetchOrsRoute).not.toHaveBeenCalled();
    expect(result.current).toEqual({ estado: "pendiente" });
  });
});

describe("answers that arrive late, and answers already known", () => {
  it("does not draw the answer for the previous tramo on the new one", async () => {
    const lenta = diferido<[number, number][] | null>();
    fetchOrsRoute.mockReturnValueOnce(lenta.promesa).mockResolvedValueOnce(RUTA_B);
    const { result, rerender } = pintar();
    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));

    rerender({ ...base(), tramo: T11 });
    await waitFor(() => expect(result.current.estado).toBe("lista"));
    await act(async () => { lenta.resolver(RUTA); await lenta.promesa; });

    expect(result.current).toEqual({ estado: "lista", puntos: enPuntos(RUTA_B) });
  });

  it("does not ask again for a tramo whose answer is still out when the person comes back to it", async () => {
    const lenta = diferido<[number, number][] | null>();
    fetchOrsRoute.mockReturnValueOnce(lenta.promesa).mockResolvedValueOnce(RUTA_B);
    const { result, rerender } = pintar();
    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    rerender({ ...base(), tramo: T11 });
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), tramo: T10 });
    await act(async () => { lenta.resolver(RUTA); await lenta.promesa; });

    expect(fetchOrsRoute).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ estado: "lista", puntos: enPuntos(RUTA) });
  });

  it("makes no second request when the same tramo is selected again, and shows the route at once", async () => {
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), tramo: undefined });
    rerender({ ...base(), tramo: T10 });

    // At once: this very render, before any effect or answer could have run.
    expect(result.current.estado).toBe("lista");
    await dejarPasar();
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
  });

  it("asks again when a reload leaves the same tramo with different poles", async () => {
    const { result, rerender } = pintar({ postes: [poste(1, -17.2, -64.8)] });
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), postes: [poste(1, -17.2, -64.8), poste(2, -17.3, -64.7)] });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(2));
    expect(fetchOrsRoute).toHaveBeenLastCalledWith([[-65, -17], [-64.8, -17.2], [-64.7, -17.3], [-64.6, -17.4]]);
  });

  it("asks again when a reload moves one of the ends", async () => {
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), ciudades: CIUDADES.map((c) => (c.id === 1 ? { ...c, lat: -16.9 } : c)) });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(2));
  });

  it("keeps the same route object for the same answer across renders, so the frame does not change again", async () => {
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current.estado).toBe("lista"));
    const antes = result.current;

    rerender({ ...base() });

    expect(result.current).toBe(antes);
  });
});

describe("an answer without a route is not remembered like a route", () => {
  it("asks again when the same tramo is selected again after a null", async () => {
    fetchOrsRoute.mockResolvedValueOnce(null).mockResolvedValueOnce(RUTA);
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current).toEqual({ estado: "sinRuta" }));

    rerender({ ...base(), tramo: undefined });
    rerender({ ...base(), tramo: T10 });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.estado).toBe("lista"));
  });

  it("asks again when the person goes to another tramo and comes back", async () => {
    fetchOrsRoute.mockResolvedValueOnce(null).mockResolvedValueOnce(RUTA_B).mockResolvedValueOnce(RUTA);
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current).toEqual({ estado: "sinRuta" }));
    rerender({ ...base(), tramo: T11 });
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), tramo: T10 });

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(3));
  });

  it("does not ask again while the selection stays, across re-renders and a reload with identical data", async () => {
    fetchOrsRoute.mockResolvedValue(null);
    const poste1 = poste(1, -17.2, -64.8);
    const { result, rerender } = pintar({ postes: [poste1] });
    await waitFor(() => expect(result.current).toEqual({ estado: "sinRuta" }));
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);

    rerender({ ...base(), postes: [poste1] });
    // A reload: new arrays and new objects holding the same data.
    rerender({
      ...base(),
      tramo: { ...T10 },
      ciudades: CIUDADES.map((c) => ({ ...c })),
      postes: [poste(1, -17.2, -64.8)],
    });
    await dejarPasar();
    await dejarPasar();

    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ estado: "sinRuta" });
  });

  it("still asks a successful route only once", async () => {
    const { result, rerender } = pintar();
    await waitFor(() => expect(result.current.estado).toBe("lista"));

    rerender({ ...base(), tramo: undefined });
    rerender({ ...base(), tramo: T10 });
    rerender({ ...base(), ciudades: CIUDADES.map((c) => ({ ...c })) });
    await dejarPasar();

    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
  });

  it("keeps the fallback of the current tramo when a late null arrives for the previous one, with one request for it", async () => {
    const deA = diferido<[number, number][] | null>();
    const deB = diferido<[number, number][] | null>();
    fetchOrsRoute.mockReturnValueOnce(deA.promesa).mockReturnValueOnce(deB.promesa);
    const { result, rerender } = pintar();
    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));

    rerender({ ...base(), tramo: T11 });
    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(2));
    await act(async () => { deB.resolver(null); await deB.promesa; });
    expect(result.current).toEqual({ estado: "sinRuta" });
    await act(async () => { deA.resolver(null); await deA.promesa; });
    await dejarPasar();

    expect(result.current).toEqual({ estado: "sinRuta" });
    expect(fetchOrsRoute).toHaveBeenCalledTimes(2);
  });

  it("ends on the fallback, not on pending, when a null lands for a key the current selection shares", async () => {
    const deA = diferido<[number, number][] | null>();
    fetchOrsRoute.mockReturnValueOnce(deA.promesa);
    const { result, rerender } = pintar();
    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));

    // Another tramo with the same two ends: same waypoints, so no second request.
    rerender({ ...base(), tramo: tramo(99, 1, 2) });
    await dejarPasar();
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ estado: "pendiente" });

    await act(async () => { deA.resolver(null); await deA.promesa; });

    expect(result.current).toEqual({ estado: "sinRuta" });
    expect(fetchOrsRoute).toHaveBeenCalledTimes(1);
  });
});
