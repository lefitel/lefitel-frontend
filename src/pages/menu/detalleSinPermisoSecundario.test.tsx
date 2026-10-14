// A detail sheet must open for a role that may see the thing itself but not
// everything the sheet can show about it.
//
// The three hooks below each asked for several things in one `Promise.all`.
// The per-module permissions made some of those requests refusable on their
// own — the incidents of a pole ask for `eventos.ver`, the poles of a city for
// `postes.ver`, somebody else's activity for `bitacora.ver` — and one refusal
// rejected the whole `Promise.all`: the answer that *had* arrived was thrown
// away, and the sheet said "Error al cargar los datos" about a pole the role
// was allowed to see. No seeded role is shaped that way; any role edited on the
// permissions screen can be.
//
// So a hook does not ask for what the role cannot have, and the tests assert
// exactly that: the request is never made, and the main record still loads.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const searchPoste = vi.fn();
const getEvento_poste = vi.fn();
const getEvento_usuario = vi.fn();
const searchCiudad = vi.fn();
const getPosteByCiudad = vi.fn();
const searchUsuario = vi.fn();
const getBitacora = vi.fn();

vi.mock("../../api/Poste.api", () => ({
  searchPoste: (...a: unknown[]) => searchPoste(...a),
  getPosteByCiudad: (...a: unknown[]) => getPosteByCiudad(...a),
}));
vi.mock("../../api/Evento.api", () => ({
  getEvento_poste: (...a: unknown[]) => getEvento_poste(...a),
  getEvento_usuario: (...a: unknown[]) => getEvento_usuario(...a),
  reabrirEvento: vi.fn(),
}));
vi.mock("../../api/Ciudad.api", () => ({ searchCiudad: (...a: unknown[]) => searchCiudad(...a) }));
vi.mock("../../api/Usuario.api", () => ({ searchUsuario: (...a: unknown[]) => searchUsuario(...a) }));
vi.mock("../../api/Bitacora.api", () => ({ getBitacora: (...a: unknown[]) => getBitacora(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { usePosteDetalleData } = await import("./poste/PosteDetalle/usePosteDetalleData");
const { useCiudadDetalleData } = await import("./ciudad/useCiudadDetalleData");
const { useUsuarioDetalleData } = await import("./usuario/useUsuarioDetalleData");
const { toast } = await import("sonner");

/** What the server answers to a request the role may not make. */
const denegado = () => Promise.reject(Object.assign(new Error("Forbidden"), { response: { status: 403 } }));

beforeEach(() => {
  vi.clearAllMocks();
  searchPoste.mockResolvedValue({ id: 40, name: "P-001" });
  searchCiudad.mockResolvedValue({ id: 11, name: "Tacna" });
  searchUsuario.mockResolvedValue({ id: 7, name: "Ana" });
  getEvento_usuario.mockResolvedValue([]);
  // The server's answer for these three, should a hook ask anyway.
  getEvento_poste.mockImplementation(denegado);
  getPosteByCiudad.mockImplementation(denegado);
  getBitacora.mockImplementation(denegado);
});

describe("a pole, for a role that may not see incidents", () => {
  it("loads the pole and never asks for its incidents", async () => {
    const { result } = renderHook(() => usePosteDetalleData(40, { verEventos: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.poste).toMatchObject({ id: 40 });
    expect(result.current.eventos).toEqual([]);
    expect(getEvento_poste).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still asks when the role may see them", async () => {
    getEvento_poste.mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => usePosteDetalleData(40, { verEventos: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.eventos).toEqual([{ id: 1 }]);
  });
});

describe("a city, for a role that may not see poles", () => {
  it("loads the city and never asks for its poles", async () => {
    const { result } = renderHook(() => useCiudadDetalleData(11, { verPostes: false, verTramos: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ciudad).toMatchObject({ id: 11 });
    expect(result.current.postes).toEqual([]);
    expect(getPosteByCiudad).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still asks when the role may see them", async () => {
    getPosteByCiudad.mockResolvedValue([{ id: 40 }]);
    const { result } = renderHook(() => useCiudadDetalleData(11, { verPostes: true, verTramos: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.postes).toEqual([{ id: 40 }]);
  });
});

describe("an account, for a role that may not read the log", () => {
  it("loads the account and never asks for its activity", async () => {
    const { result } = renderHook(() => useUsuarioDetalleData(7, { verBitacora: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usuario).toMatchObject({ id: 7 });
    expect(result.current.bitacora).toEqual([]);
    expect(getBitacora).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still asks when the role may read it", async () => {
    getBitacora.mockResolvedValue({ data: [{ id: 1 }] });
    const { result } = renderHook(() => useUsuarioDetalleData(7, { verBitacora: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bitacora).toEqual([{ id: 1 }]);
  });
});
