// A catalogue entry opened by its address — `?tab=material&id=5`, which is how
// the Bitácora links to one.
//
// The part worth a test is the order of the answers. The record is looked for
// among the active entries, then among the archived, and only then is it said
// to be gone: "ya no existe" about a record that is one tab away would be a
// wrong statement about the very thing the audit log is pointing at. And a list
// that failed to load must produce no statement at all.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRegistroEnlazado, type RegistroEnlazado } from "./useRegistroEnlazado";

const toastInfo = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo, error: toastError } }));

interface Fila { id: number; name: string }
const ACERO: Fila = { id: 5, name: "Acero" };
const MADERA: Fila = { id: 8, name: "Madera" };

const enlaceA = (id: number): RegistroEnlazado => ({
  id,
  verArchivados: vi.fn(),
  verActivos: vi.fn(),
  atendido: vi.fn(),
});

const montar = (
  enlace: RegistroEnlazado | undefined,
  activos: Fila[] | null,
  archivados: Fila[] | null = null,
  puedeEditar = true,
) => {
  const abrir = vi.fn();
  const hook = renderHook(
    (p: { activos: Fila[] | null; archivados: Fila[] | null }) =>
      useRegistroEnlazado({
        enlace, activos: p.activos, archivados: p.archivados, abrir: puedeEditar ? abrir : undefined,
      }),
    { initialProps: { activos, archivados } },
  );
  return { abrir, ...hook };
};

beforeEach(() => vi.clearAllMocks());

describe("a record named in the address", () => {
  it("waits for the list, then opens the record's form", () => {
    const enlace = enlaceA(5);
    const { abrir, rerender } = montar(enlace, null);
    expect(abrir).not.toHaveBeenCalled();

    rerender({ activos: [ACERO, MADERA], archivados: null });

    expect(abrir).toHaveBeenCalledWith(ACERO);
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
    expect(enlace.verArchivados).not.toHaveBeenCalled();
  });

  it("opens it once, however many times the list is read again", () => {
    const enlace = enlaceA(5);
    const { abrir, rerender } = montar(enlace, [ACERO]);

    rerender({ activos: [{ ...ACERO }], archivados: null });
    rerender({ activos: [{ ...ACERO }], archivados: [] });

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("asks for the archived list before saying anything, and says it is archived", () => {
    const enlace = enlaceA(8);
    const { abrir, rerender } = montar(enlace, [ACERO]);

    expect(enlace.verArchivados).toHaveBeenCalledTimes(1);
    // Nothing said yet: the archived list has not answered.
    expect(toastError).not.toHaveBeenCalled();
    expect(enlace.atendido).not.toHaveBeenCalled();

    rerender({ activos: [ACERO], archivados: [MADERA] });

    expect(toastInfo).toHaveBeenCalledWith("«Madera» está archivado");
    expect(abrir).not.toHaveBeenCalled();
    expect(enlace.verActivos).not.toHaveBeenCalled();
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("says it is gone only when it is in neither list, and goes back to the active ones", () => {
    const enlace = enlaceA(99);
    const { rerender } = montar(enlace, [ACERO]);
    rerender({ activos: [ACERO], archivados: [MADERA] });

    expect(toastError).toHaveBeenCalledWith("El registro #99 ya no existe");
    expect(enlace.verActivos).toHaveBeenCalledTimes(1);
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("says nothing while a list that failed to load is still missing", () => {
    // `null` is also what a failed read leaves. The section has already said
    // the list could not be read; "no existe" on top would be a claim about the
    // data made out of a failed request.
    const enlace = enlaceA(99);
    const { rerender } = montar(enlace, [ACERO]);
    rerender({ activos: [ACERO], archivados: null });

    expect(toastError).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(enlace.atendido).not.toHaveBeenCalled();
  });

  it("answers at once when the archived list was already there", () => {
    // The ordering that left it hanging: the active list fails or is slow, the
    // person looks at Archivados meanwhile, and then the active list arrives
    // without the record. Nothing this hook watches changes after that, so an
    // answer that waited for the next change waited for an unrelated refresh —
    // the screen switched tabs without a word and said "ya no existe" minutes
    // later.
    const enlace = enlaceA(99);
    const { rerender } = montar(enlace, null, [MADERA]);
    expect(enlace.atendido).not.toHaveBeenCalled();

    rerender({ activos: [ACERO], archivados: [MADERA] });

    expect(enlace.verArchivados).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("El registro #99 ya no existe");
    expect(enlace.verActivos).toHaveBeenCalledTimes(1);
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("finds an archived record at once, too, when that list was already there", () => {
    const enlace = enlaceA(8);
    const { rerender } = montar(enlace, null, [MADERA]);

    rerender({ activos: [ACERO], archivados: [MADERA] });

    expect(toastInfo).toHaveBeenCalledWith("«Madera» está archivado");
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("tells a role that cannot edit where the record is, instead of opening a form it does not have", () => {
    // The form is not mounted for them. Calling the section's `openEdit` anyway
    // left "form open" set with nothing on screen.
    const enlace = enlaceA(5);
    const { abrir } = montar(enlace, [ACERO, MADERA], null, false);

    expect(abrir).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0][0])).toMatch(/«Acero».*no permite/);
    expect(enlace.atendido).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all when the address names no record", () => {
    const { abrir } = montar(undefined, [ACERO], [MADERA]);

    expect(abrir).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });
});
