// The dialog that creates and edits a tramo: two cities and, optionally, a department.
//
// A tramo has no direction, so both city fields are called "Ciudad" and the
// order they are picked in means nothing; the server orders the pair. What the
// dialog has to get right is what happens when the pair already exists, because
// the same dialog is opened from the pole form, where "it already exists" is
// the answer the person was looking for and not a failure.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TramoSheet from "./TramoSheet";
import type { Tramo } from "../../../interfaces/interfaces";

const createTramo = vi.fn();
const editTramo = vi.fn();
const getOpcionesTramo = vi.fn();
vi.mock("../../../api/Tramo.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/Tramo.api")>()),
  createTramo: (...a: unknown[]) => createTramo(...a),
  editTramo: (...a: unknown[]) => editTramo(...a),
  getOpcionesTramo: (...a: unknown[]) => getOpcionesTramo(...a),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const CIUDADES = [
  { id: 1, name: "Olivos" },
  { id: 2, name: "Millares" },
  { id: 3, name: "Sucre" },
];
const DEPARTAMENTOS = [
  { id: 5, name: "Potosí" },
  { id: 6, name: "Chuquisaca" },
];

const tramo = (over: Partial<Tramo> = {}): Tramo => ({
  id: 9,
  nombre: "Millares – Olivos",
  ciudades: [
    { id: 2, name: "Millares", lat: null, lng: null },
    { id: 1, name: "Olivos", lat: null, lng: null },
  ],
  id_departamento: 5,
  departamento: { id: 5, name: "Potosí" },
  archivado: false,
  ...over,
});

const pintar = (props: Partial<React.ComponentProps<typeof TramoSheet>> = {}) => {
  const onSuccess = vi.fn();
  const setOpen = vi.fn();
  render(
    <TramoSheet
      open
      setOpen={setOpen}
      onSuccess={onSuccess}
      ciudades={CIUDADES}
      departamentos={DEPARTAMENTOS}
      {...props}
    />,
  );
  return { onSuccess, setOpen, user: userEvent.setup() };
};

const UNO = "Ciudad, un extremo";
const OTRO = "Ciudad, el otro extremo";

/** Opens one of the pickers and chooses an option by the name it shows. */
const elegir = async (user: ReturnType<typeof userEvent.setup>, campo: string, opcion: string) => {
  await user.click(screen.getByRole("button", { name: campo }));
  await user.click(await screen.findByRole("button", { name: opcion }));
};

const crear = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /crear tramo/i }));

/** A rejection shaped like axios's, which is what `tramoDelConflicto` reads. */
const conflicto = (message: string, t: Tramo) =>
  Promise.reject({ response: { status: 409, data: { message, tramo: t } } });

describe("the tramo dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOpcionesTramo.mockResolvedValue({ ciudad: CIUDADES, departamento: DEPARTAMENTOS });
  });

  it("asks for two different cities before it sends anything", async () => {
    // A stored tramo whose two ends are the same city is not something the
    // pickers can produce (each hides the city chosen in the other), but it is
    // something a damaged row could hand us. Saving it must stop at the field.
    const raro = tramo({
      ciudades: [
        { id: 1, name: "Olivos", lat: null, lng: null },
        { id: 1, name: "Olivos", lat: null, lng: null },
      ],
    });
    const { user } = pintar({ tramo: raro, ciudadesEditables: true });

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText("Elige dos ciudades distintas")).toBeInTheDocument();
    expect(editTramo).not.toHaveBeenCalled();
    expect(createTramo).not.toHaveBeenCalled();
  });

  it("asks for both cities when only one was chosen, and each picker hides the other's choice", async () => {
    const { user } = pintar();

    await elegir(user, UNO, "Olivos");
    await user.click(screen.getByRole("button", { name: OTRO }));
    // Olivos is taken by the first picker: the second does not offer it.
    expect(await screen.findByRole("button", { name: "Millares" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Olivos" })).toBeNull();
    await user.keyboard("{Escape}");

    await crear(user);

    expect(await screen.findByText("Elige dos ciudades distintas")).toBeInTheDocument();
    expect(createTramo).not.toHaveBeenCalled();
  });

  it("creates with the two cities and the department, and hands the new tramo to onSuccess", async () => {
    const nuevo = tramo({ id: 12, nombre: "Olivos – Sucre" });
    createTramo.mockResolvedValue(nuevo);
    const { user, onSuccess, setOpen } = pintar();

    await elegir(user, UNO, "Sucre");
    await elegir(user, OTRO, "Olivos");
    await elegir(user, "Departamento", "Potosí");
    await crear(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(nuevo));
    // The order they were picked in is the order they are sent: the server orders the pair.
    expect(createTramo).toHaveBeenCalledWith({ ciudades: [3, 1], id_departamento: 5 });
    expect(toast.success).toHaveBeenCalled();
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("creates with no department key when none was chosen", async () => {
    createTramo.mockResolvedValue(tramo({ id: 12, id_departamento: null, departamento: null }));
    const { user, onSuccess } = pintar();

    await elegir(user, UNO, "Olivos");
    await elegir(user, OTRO, "Sucre");
    await crear(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const enviado = createTramo.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado).toEqual({ ciudades: [1, 3] });
    expect("id_departamento" in enviado).toBe(false);
  });

  it("on a 409 with a live tramo, hands THAT tramo to onSuccess and says it already existed", async () => {
    const existente = tramo({ archivado: false });
    createTramo.mockImplementation(() => conflicto("Ese tramo ya existe.", existente));
    const { user, onSuccess, setOpen } = pintar();

    await elegir(user, UNO, "Millares");
    await elegir(user, OTRO, "Olivos");
    await crear(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(existente));
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info.mock.calls[0][0]).toMatch(/ya exist/i);
    expect(toast.info.mock.calls[0][0]).toContain(existente.nombre);
    expect(toast.error).not.toHaveBeenCalled();
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("on a 409 with an archived tramo, selects nothing and shows the server's sentence", async () => {
    const frase = "Ese tramo ya existe pero está archivado: debe desarchivarlo alguien con permiso para archivar y desarchivar tramos.";
    createTramo.mockImplementation(() => conflicto(frase, tramo({ archivado: true })));
    const { user, onSuccess, setOpen } = pintar();

    await elegir(user, UNO, "Millares");
    await elegir(user, OTRO, "Olivos");
    await crear(user);

    expect(await screen.findByText(frase)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    // Still open: the form is on screen to be changed.
    expect(screen.getByRole("button", { name: /crear tramo/i })).toBeInTheDocument();
  });

  it("when editing a tramo with poles, shows the cities and does not let them change", async () => {
    const t = tramo();
    editTramo.mockResolvedValue({ ...t, id_departamento: 6, departamento: { id: 6, name: "Chuquisaca" } });
    const { user, onSuccess } = pintar({ tramo: t, ciudadesEditables: false });

    expect(screen.getByRole("button", { name: UNO })).toBeDisabled();
    expect(screen.getByRole("button", { name: OTRO })).toBeDisabled();
    expect(screen.getByRole("button", { name: UNO })).toHaveTextContent("Millares");
    expect(screen.getByRole("button", { name: OTRO })).toHaveTextContent("Olivos");
    // The name the server gave it, not one built here.
    expect(screen.getByText(t.nombre)).toBeInTheDocument();

    await elegir(user, "Departamento", "Chuquisaca");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(editTramo).toHaveBeenCalledWith(9, { id_departamento: 6 });
  });

  it("uses the lists it was handed and does not ask for options", async () => {
    const { user } = pintar();

    await user.click(screen.getByRole("button", { name: UNO }));
    expect(await screen.findByRole("button", { name: "Sucre" })).toBeInTheDocument();

    expect(getOpcionesTramo).not.toHaveBeenCalled();
  });

  it("asks for options when it was handed none, and fills the pickers with them", async () => {
    const { user } = pintar({ ciudades: undefined, departamentos: undefined });
    await user.click(screen.getByRole("button", { name: UNO }));
    expect(await screen.findByRole("button", { name: "Sucre" })).toBeInTheDocument();
    expect(getOpcionesTramo).toHaveBeenCalledTimes(1);
  });

  it("says the lists could not be read, and does not let the form be sent", async () => {
    getOpcionesTramo.mockRejectedValue({ response: { status: 500 } });
    const { user } = pintar({ ciudades: undefined, departamentos: undefined });

    expect(await screen.findByText(/No se pudieron cargar las ciudades/)).toBeInTheDocument();
    // Nothing to choose from is not "no cities exist": the form cannot be sent.
    expect(screen.getByRole("button", { name: /crear tramo/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: UNO }));
    expect(screen.queryByRole("button", { name: "Sucre" })).toBeNull();
  });

  it("clears the department with null, not by leaving the key out", async () => {
    const t = tramo();
    editTramo.mockResolvedValue({ ...t, id_departamento: null, departamento: null });
    const { user, onSuccess } = pintar({ tramo: t, ciudadesEditables: true });

    await elegir(user, "Departamento", "Sin departamento");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(editTramo).toHaveBeenCalledWith(9, { id_departamento: null, ciudades: [2, 1] });
  });
});
