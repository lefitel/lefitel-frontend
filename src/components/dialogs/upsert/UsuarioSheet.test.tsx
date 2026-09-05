// The third screen that lets somebody choose a password, and the only one where
// getting it wrong used to end in silence.
//
// This sheet validated the password's length not at all. The server refuses
// anything under `PASSWORD_MIN_LENGTH` with a sentence that says so, and
// `createUsuario` throws that sentence away — it flattens every failure to the
// number 400 — so the sheet could only answer "No se pudo crear el usuario".
// Somebody typing a six-character password for a new field worker had nothing to
// correct and no way to learn what was wrong.
//
// The first two tests pin only that rule: the boundary — refused one character
// short, accepted at exactly the minimum — and that the number comes from
// `lib/password.ts` rather than a digit typed into the handler.
//
// C5 added the second block, for the other thing this sheet used to fail at in
// silence: the role list being refused. The rest of the component is still
// somebody else's coverage.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import UsuarioSheet from "./UsuarioSheet";
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";

const createUsuario = vi.fn();
const editUsuario = vi.fn();
const searchUsuario_user = vi.fn();

vi.mock("../../../api/Usuario.api", () => ({
  createUsuario: (...args: unknown[]) => createUsuario(...args),
  editUsuario: (...args: unknown[]) => editUsuario(...args),
  searchUsuario_user: (...args: unknown[]) => searchUsuario_user(...args),
}));
const getRol = vi.fn();
vi.mock("../../../api/Rol.api", () => ({ getRol: () => getRol() }));
vi.mock("../../../api/Upload.api", () => ({
  uploadImage: () => {
    throw new Error("no se sube ninguna imagen en estas pruebas");
  },
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // "Not found" is what a free username looks like through this API: the sheet
  // treats a resolved search as "taken" and a rejection as "available".
  searchUsuario_user.mockRejectedValue(new Error("no existe"));
  // La fila que devuelve el 201. La hoja ya no mira el número: mira si hubo
  // respuesta. Dejar aquí un 200 literal era fijar el contrato al revés.
  createUsuario.mockResolvedValue({ id: 11, name: "Nuevo" });
  getRol.mockResolvedValue([{ id: 3, name: "Coordinador", description: "" }]);
});

/**
 * Fill the "Nuevo Usuario" sheet in with `password` and press "Crear usuario".
 *
 * Every required field is filled, the role included — otherwise validation would
 * stop at the missing role and a test asserting "nothing was created" would pass
 * against a screen with no password rule at all.
 */
async function crearCon(password: string) {
  const user = userEvent.setup();
  render(<UsuarioSheet open setOpen={vi.fn()} onSuccess={vi.fn()} />);

  await user.type(screen.getByLabelText(/^Nombre/), "Ada");
  await user.type(screen.getByLabelText(/^Apellido/), "Lovelace");
  await user.type(screen.getByLabelText(/^Usuario/), "ada");
  await user.type(screen.getByLabelText(/^Contraseña/), password);
  await user.type(screen.getByLabelText(/^Confirmar contraseña/), password);

  // The role list arrives from the network, so the combobox is a skeleton first.
  await user.click(await screen.findByText("Seleccionar rol..."));
  await user.click(await screen.findByText("Coordinador"));

  await user.click(screen.getByRole("button", { name: /crear usuario/i }));
  return user;
}

describe("the password a new account is created with", () => {
  it("refuses one character short of the server's minimum, and says why", async () => {
    await crearCon("a".repeat(PASSWORD_MIN_LENGTH - 1));

    // Nothing left the browser. The request would have been refused anyway; the
    // point is that the person is told what to change instead of reading "No se
    // pudo crear el usuario".
    expect(createUsuario).not.toHaveBeenCalled();
    expect(await screen.findByText(/al menos 12 caracteres/)).toBeInTheDocument();
  });

  it("creates the account at exactly the minimum", async () => {
    // The other half, and the reason it is here: a rule stricter than the
    // server's refuses passwords that were fine, and nothing else in this
    // repository would notice.
    const laMinima = "a".repeat(PASSWORD_MIN_LENGTH);
    await crearCon(laMinima);

    await waitFor(() => expect(createUsuario).toHaveBeenCalledTimes(1));
    const enviado = createUsuario.mock.calls[0][0] as { pass: string; user: string };
    expect(enviado.pass).toBe(laMinima);
    expect(enviado.user).toBe("ada");
    expect(screen.queryByText(/al menos 12 caracteres/)).toBeNull();
  });
});

/**
 * When the role list is refused — C5.
 *
 * `GET /api/rol/` answered any session until C5 and now asks for `roles.ver`,
 * while this sheet opens on `seguridad.crear` or `seguridad.editar`. The two
 * are separate permissions on purpose — handing out accounts is not the same
 * authority as handing out authority — so an administrator can build a role
 * that reaches this sheet without them.
 *
 * Before C5 that could not happen, and the code showed it: the fetch was a bare
 * `await` with no `catch`, so a refusal threw before the loading flag was
 * cleared and left the skeleton where the role picker goes, for ever, with
 * nothing on screen and an unhandled rejection in the console. Saving then asks
 * for a role no control can set.
 */
describe("when the role list is refused", () => {
  const abrir = () => render(<UsuarioSheet open setOpen={vi.fn()} onSuccess={vi.fn()} />);

  it("says so, and leaves the form usable instead of a skeleton for ever", async () => {
    getRol.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 403"), {
        isAxiosError: true,
        response: { data: { message: "No tiene permiso para realizar esta acción." }, status: 403 },
      }),
    );

    abrir();

    // The server's own sentence, dug out of the refusal rather than invented.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No tiene permiso para realizar esta acción."));
    // And the picker is a picker again: the skeleton is gone, so the rest of
    // the form can be filled and the person can see there is no role to choose.
    await waitFor(() => expect(screen.getByText("Seleccionar rol...")).toBeInTheDocument());
  });

  it("keeps its own sentence when the refusal carries none", async () => {
    // The other direction, so "always print the server's message" fails too:
    // a network error has no sentence, and `undefined` on a toast is worse than
    // a generic one that at least names what is missing.
    getRol.mockRejectedValue(new Error("Network Error"));

    abrir();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "No se pudo cargar la lista de roles, así que no se puede asignar uno."));
  });
});
