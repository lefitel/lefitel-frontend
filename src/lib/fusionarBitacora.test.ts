import { describe, it, expect } from "vitest";
import { fusionarBitacora } from "./fusionarBitacora";
import type { BitacoraInterface, UsuarioInterface } from "../interfaces/interfaces";

const fila = (id: number, over: Partial<BitacoraInterface> = {}): BitacoraInterface =>
  ({ id, action: "LOGIN", detail: `línea ${id}`, entity: "Usuario", id_usuario: 7, ...over });

/** A read as the API answers it: `total` is what exists, `data` what came. */
const lectura = (ids: number[], total = ids.length) =>
  ({ data: ids.map((id) => fila(id)), total, page: 1, limit: 50 as const });

const ids = (filas: BitacoraInterface[]) => filas.map((f) => f.id);

describe("fusionarBitacora", () => {
  it("shows a line both reads returned once, newest first", () => {
    expect(ids(fusionarBitacora([lectura([9, 7, 4]), lectura([8, 7, 2])]))).toEqual([9, 8, 7, 4, 2]);
  });

  it("stops where a truncated read stopped, instead of showing a timeline with gaps", () => {
    // The first read has more than it sent and reaches back only to 6. Below
    // that its lines are unknown, so 3 and 1 from the other read are held back:
    // shown, they would say nothing else happened in between.
    const cortada = lectura([9, 8, 6], 40);
    const entera = lectura([7, 3, 1]);

    expect(ids(fusionarBitacora([cortada, entera]))).toEqual([9, 8, 7, 6]);
  });

  it("keeps everything when no read was truncated", () => {
    expect(ids(fusionarBitacora([lectura([5, 1]), lectura([])]))).toEqual([5, 1]);
  });

  it("keeps the copy that says who did it", () => {
    const autora = { id: 3, name: "Ana", lastname: "Paz" } as UsuarioInterface;
    const sinAutor = { ...lectura([]), data: [fila(4)], total: 1 };
    const conAutor = { ...lectura([]), data: [fila(4, { usuario: autora })], total: 1 };

    expect(fusionarBitacora([sinAutor, conAutor])[0].usuario).toBe(autora);
    expect(fusionarBitacora([conAutor, sinAutor])[0].usuario).toBe(autora);
  });
});
