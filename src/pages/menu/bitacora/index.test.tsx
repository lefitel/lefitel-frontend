// The author filter on the Bitácora screen, which is what task B2 was about.
//
// The screen filled that dropdown from `getUsuario()` — the staff directory,
// behind `seguridad:ver`. Every account that can open this screen today also
// holds that permission, so nothing was visibly broken; but the matrix editor
// can hand out `bitacora:ver` on its own, and the moment it does, the directory
// answers 403, the page swallowed it, and the filter offered "Todos" and nothing
// else. An empty dropdown and a refused one look identical, and the first one
// reads as "nobody has ever done anything here".
//
// So the two things asserted here are the two that were wrong: **which endpoint
// fills the list**, and **whether a failure is visible**. The first is checked
// against `Usuario.api` as well as `Bitacora.api` — a revert would go back to
// exactly that module, and asserting only that the new call happened would stay
// green with both of them firing.
//
// The archived marker is the third: those accounts are in the list on purpose
// now, because somebody reviewing old work is usually looking for a person who
// has left, and an unmarked one is indistinguishable from current staff.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BitacoraPage from "./index";

const getAutoresBitacora = vi.fn();
const getAllBitacora = vi.fn();
const getUsuario = vi.fn();
const toastError = vi.fn();

vi.mock("../../../api/Bitacora.api", () => ({
  getAutoresBitacora: (...args: unknown[]) => getAutoresBitacora(...args),
  getAllBitacora: (...args: unknown[]) => getAllBitacora(...args),
}));
// Mocked and asserted-against rather than simply absent: this is the module the
// screen used to call, and the one a change would drift back to.
vi.mock("../../../api/Usuario.api", () => ({
  getUsuario: (...args: unknown[]) => getUsuario(...args),
}));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

/** Two live authors and one archived, as the endpoint serves them. */
const AUTORES = [
  { id: 4, name: "Ana", lastname: "Quispe", deletedAt: null },
  { id: 9, name: "Bruno", lastname: "Mamani", deletedAt: "2026-05-02T00:00:00.000Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  getAutoresBitacora.mockResolvedValue(AUTORES);
  getAllBitacora.mockResolvedValue({ data: [], total: 0 });
});

const pintar = () => render(<MemoryRouter><BitacoraPage /></MemoryRouter>);

/**
 * Opens the author combobox, which renders its options only once open.
 *
 * Not found by the word "Usuario", which appears three times on this screen — as
 * this filter's label, as a column header, and as one of the thirteen entities
 * in the list beside it. And not by taking the first popover trigger either:
 * there are three, and the first two are the Desde and Hasta calendars. The one
 * wanted is the only one showing a selected value rather than a date, which is
 * "Todos" until somebody picks a person.
 */
const abrirFiltroDeUsuario = async () => {
  const disparador = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
    .find((b) => (b.textContent ?? "").includes("Todos"));
  expect(disparador, "no se encontró el desplegable de usuario").toBeTruthy();
  await userEvent.click(disparador as HTMLElement);
};

describe("the author filter", () => {
  it("is filled from the audit log, not from the staff directory", async () => {
    pintar();

    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    // The half that a "did the new call happen" assertion would miss: the old
    // one needs a permission this screen does not, and firing both would leave
    // the 403 exactly where it was.
    expect(getUsuario, "la pantalla volvió a pedir el directorio de personal")
      .not.toHaveBeenCalled();
  });

  it("marks an author whose account has been archived", async () => {
    pintar();
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());

    await abrirFiltroDeUsuario();

    // The live one plain, the archived one marked. Both asserted: a marker on
    // everybody would be as wrong as a marker on nobody, and only checking the
    // archived one would not notice.
    expect(await screen.findByText("Ana Quispe")).toBeInTheDocument();
    expect(await screen.findByText("Bruno Mamani (archivado)")).toBeInTheDocument();
  });

  it("filters by the author's id, not by anything else on the option", async () => {
    // The end of the chain the `AutorBitacora` type exists to protect, and the
    // half the assertions above cannot see: they read the label, and the label
    // is not what gets sent. An option built with `String(a.name)` — or with the
    // optional `id` of `UsuarioInterface`, which is the mistake that type was
    // written to prevent — renders exactly the same three lines and then sends
    // `Number("Ana")`, which is `NaN`, which the server answers with a 500.
    pintar();
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    await abrirFiltroDeUsuario();

    await userEvent.click(await screen.findByText("Ana Quispe"));

    await waitFor(() =>
      expect(getAllBitacora).toHaveBeenCalledWith(expect.objectContaining({ id_usuario: 4 })),
    );
  });

  it("says so when the list cannot be loaded", async () => {
    // The defect in one line. Without this the filter shows "Todos" and nothing
    // else — which is what a system where nobody has done anything looks like.
    getAutoresBitacora.mockRejectedValue({ response: { status: 403 } });

    pintar();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/usuarios/i);
  });

  it("stays quiet when what failed was the session", async () => {
    // A 401 means `SesionProvider` is already saying "Tu sesión se cerró" and
    // sending the person to the login screen. Both reads on this page fail at
    // once behind that, so without this the one real event produces three
    // messages, two of them naming the wrong problem. Silence here is not the
    // old silence: it is deferring to a better message that is already on
    // screen.
    getAutoresBitacora.mockRejectedValue({ response: { status: 401 } });
    getAllBitacora.mockRejectedValue({ response: { status: 401 } });

    pintar();

    // Waited for rather than asserted immediately: `expect(...).not` on a
    // promise nobody has awaited passes before the rejection is even delivered.
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    await waitFor(() => expect(getAllBitacora).toHaveBeenCalled());
    expect(toastError, "avisó por encima del aviso de sesión cerrada").not.toHaveBeenCalled();
  });
});

describe("the table itself", () => {
  it("says so when the entries cannot be loaded, instead of showing an empty table", async () => {
    // Same class of silence, one component over: `setRows([])` on a failed read
    // renders exactly what an empty log renders.
    getAllBitacora.mockRejectedValue(new Error("red caída"));

    pintar();

    await waitFor(() =>
      expect(toastError.mock.calls.some((c) => /bitácora/i.test(String(c[0])))).toBe(true),
    );
  });
});
