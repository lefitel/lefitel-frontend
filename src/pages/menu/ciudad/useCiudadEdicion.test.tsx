import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { CiudadInterface } from "../../../interfaces/interfaces";

const editCiudad = vi.fn();
const uploadImage = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("../../../api/Ciudad.api", () => ({ editCiudad: (...a: unknown[]) => editCiudad(...a) }));
vi.mock("../../../api/Upload.api", () => ({ uploadImage: (...a: unknown[]) => uploadImage(...a) }));
vi.mock("sonner", () => ({ toast }));

const { useCiudadEdicion } = await import("./useCiudadEdicion");

const POTOSI = { id: 11, name: "Potosí", lat: -19.58, lng: -65.75, image: "potosi.jpg" } as CiudadInterface;
const foto = () => new File(["x"], "nueva.jpg", { type: "image/jpeg" });

const montar = (ciudad: CiudadInterface | null = POTOSI) => {
  const alGuardar = vi.fn();
  const hook = renderHook(({ c }) => useCiudadEdicion(c, alGuardar), { initialProps: { c: ciudad } });
  return { ...hook, alGuardar };
};

beforeEach(() => {
  vi.clearAllMocks();
  editCiudad.mockResolvedValue(POTOSI);
  uploadImage.mockResolvedValue({ ok: true, path: "subida.jpg" });
});

describe("the draft of a city edited on its own sheet", () => {
  it("starts as the city and says nothing has changed", () => {
    const { result } = montar();

    expect([result.current.name, result.current.lat, result.current.lng]).toEqual(["Potosí", -19.58, -65.75]);
    expect(result.current.cambiado).toBe(false);
  });

  it("is changed by a name, by a position or by a photo, and discarding puts the city back", () => {
    const { result } = montar();

    act(() => result.current.setName("Potosí Nueva"));
    expect(result.current.cambiado).toBe(true);
    act(() => result.current.descartar());
    expect(result.current.cambiado).toBe(false);

    act(() => result.current.setPosicion(-19.6, -65.7));
    expect(result.current.cambiado).toBe(true);
    act(() => result.current.descartar());

    act(() => result.current.setFoto(foto()));
    expect(result.current.cambiado).toBe(true);
    act(() => result.current.descartar());
    expect([result.current.name, result.current.lat, result.current.foto]).toEqual(["Potosí", -19.58, null]);
  });

  it("does not count spaces around the name as a change", () => {
    const { result } = montar();

    act(() => result.current.setName("  Potosí "));
    expect(result.current.cambiado).toBe(false);
  });

  it("saves the three as one write, keeping the stored photo when none was chosen", async () => {
    const { result, alGuardar } = montar();

    act(() => { result.current.setName(" Villa Imperial "); result.current.setPosicion(-19.6, -65.7); });
    await act(() => result.current.guardar());

    expect(uploadImage).not.toHaveBeenCalled();
    expect(editCiudad).toHaveBeenCalledTimes(1);
    expect(editCiudad.mock.calls[0][0]).toMatchObject({ id: 11, name: "Villa Imperial", lat: -19.6, lng: -65.7, image: "potosi.jpg" });
    expect(toast.success).toHaveBeenCalledWith("Ciudad actualizada");
    expect(alGuardar).toHaveBeenCalledTimes(1);
  });

  it("uploads a chosen photo first and saves its path", async () => {
    const { result } = montar();

    act(() => result.current.setFoto(foto()));
    await act(() => result.current.guardar());

    expect(editCiudad.mock.calls[0][0]).toMatchObject({ image: "subida.jpg" });
  });

  it("refuses an empty name and a city with no position, without writing anything", async () => {
    const { result, alGuardar } = montar();

    act(() => result.current.setName("   "));
    await act(() => result.current.guardar());
    expect(result.current.errores.name).toBe("El nombre es requerido");

    act(() => { result.current.setName("Potosí"); result.current.setPosicion(0, 0); });
    await act(() => result.current.guardar());
    expect(result.current.errores.posicion).toBe("La ciudad necesita una posición");

    expect(editCiudad).not.toHaveBeenCalled();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it("clears an error once its field is corrected", async () => {
    const { result } = montar();

    act(() => result.current.setName(""));
    await act(() => result.current.guardar());
    act(() => result.current.setName("P"));

    expect(result.current.errores.name).toBeUndefined();
  });

  it("keeps the draft and says what the server said when the save is refused", async () => {
    editCiudad.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: "Ya existe una ciudad con ese nombre." } } });
    const { result, alGuardar } = montar();

    act(() => result.current.setName("Sucre"));
    await act(() => result.current.guardar());

    expect(toast.error).toHaveBeenCalledWith("Ya existe una ciudad con ese nombre.");
    expect(result.current.name).toBe("Sucre");
    expect(result.current.cambiado).toBe(true);
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it("does not write the city when the photo could not be uploaded, and does not upload it twice on a retry", async () => {
    uploadImage.mockResolvedValueOnce({ ok: false, message: "La imagen supera el máximo de 5 MB" });
    const { result } = montar();

    act(() => result.current.setFoto(foto()));
    await act(() => result.current.guardar());
    expect(toast.error).toHaveBeenCalledWith("La imagen supera el máximo de 5 MB");
    expect(editCiudad).not.toHaveBeenCalled();

    // Uploaded, then the write is refused: the retry reuses that upload.
    editCiudad.mockRejectedValueOnce(new Error("500"));
    await act(() => result.current.guardar());
    await act(() => result.current.guardar());
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(editCiudad).toHaveBeenCalledTimes(2);
  });

  it("takes the city again when it is reloaded", async () => {
    const { result, rerender } = montar();

    act(() => result.current.setName("Otra"));
    rerender({ c: { ...POTOSI, name: "Villa Imperial" } });

    await waitFor(() => expect(result.current.name).toBe("Villa Imperial"));
    expect(result.current.cambiado).toBe(false);
  });
});
