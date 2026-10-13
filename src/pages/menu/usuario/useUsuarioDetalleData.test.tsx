// The log on a person's sheet is two reads of one table: what they did, and
// what was done to their account. The second sits behind `bitacora.ver` with no
// exception for your own record, so it is the one that gets refused — and a
// refused addition must not cost the account it was being added to.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const searchUsuario = vi.fn();
const getEvento_usuario = vi.fn();
const getBitacora = vi.fn();
const getAllBitacora = vi.fn();

vi.mock("../../../api/Usuario.api", () => ({ searchUsuario: (...a: unknown[]) => searchUsuario(...a) }));
vi.mock("../../../api/Evento.api", () => ({ getEvento_usuario: (...a: unknown[]) => getEvento_usuario(...a) }));
vi.mock("../../../api/Bitacora.api", () => ({
  getBitacora: (...a: unknown[]) => getBitacora(...a),
  getAllBitacora: (...a: unknown[]) => getAllBitacora(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useUsuarioDetalleData } = await import("./useUsuarioDetalleData");
const { toast } = await import("sonner");

const linea = (id: number, id_usuario: number) =>
  ({ id, action: "LOGIN", detail: `línea ${id}`, entity: "Usuario", entity_id: 7, id_usuario });
const lectura = (data: unknown[]) => ({ data, total: data.length, page: 1, limit: 50 });

beforeEach(() => {
  vi.clearAllMocks();
  searchUsuario.mockResolvedValue({ id: 7, name: "Ana" });
  getEvento_usuario.mockResolvedValue([]);
  getBitacora.mockResolvedValue(lectura([linea(5, 7), linea(3, 7)]));
  getAllBitacora.mockResolvedValue(lectura([linea(5, 7), linea(4, 99)]));
});

describe("the log on a person's sheet", () => {
  it("is both reads as one list, each line once", async () => {
    const { result } = renderHook(() =>
      useUsuarioDetalleData(7, { verBitacora: true, verBitacoraCuenta: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAllBitacora).toHaveBeenCalledWith({ entity: "Usuario", entity_id: 7, limit: 50 });
    expect(result.current.bitacora.map((l) => l.id)).toEqual([5, 4, 3]);
    expect(result.current.bitacoraIncompleta).toBe(false);
  });

  it("does not ask the general log without the permission, and calls nothing missing", async () => {
    const { result } = renderHook(() => useUsuarioDetalleData(7, { verBitacora: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAllBitacora).not.toHaveBeenCalled();
    expect(result.current.bitacora.map((l) => l.id)).toEqual([5, 3]);
    expect(result.current.bitacoraIncompleta).toBe(false);
  });

  it("keeps the account and the person's own lines when the general log is refused", async () => {
    getAllBitacora.mockRejectedValue({ response: { status: 403 } });

    const { result } = renderHook(() =>
      useUsuarioDetalleData(7, { verBitacora: true, verBitacoraCuenta: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.usuario).toMatchObject({ id: 7 });
    expect(result.current.bitacora.map((l) => l.id)).toEqual([5, 3]);
    expect(result.current.bitacoraIncompleta).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
