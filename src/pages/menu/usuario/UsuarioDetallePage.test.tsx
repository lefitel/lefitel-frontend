// Renaming your own account is gated on your password, and this is the test
// whose absence let the gate be decorative.
//
// The screen asks for the current password "para confirmar" before it changes
// your own username. Nothing in this repository asserted that the answer was
// ever looked at. What it actually did was call the whole login and compare
// `status === 500`, while the API answers **400** to a wrong password; the two
// met only because `Login.api.ts` flattens every non-2xx response to 500 —
// deliberately, for an unrelated reason. So the confirmation worked by accident,
// and the day a real status reached the screen intact it would have started
// letting wrong passwords through with nothing on screen or in CI to say so.
//
// Hence the shape of every test below: they assert what `editUserName` was —
// or was not — **called with**, not what a toast said. A confirmation that does
// not confirm still shows the same happy toast; the only observable difference
// is whether the change was sent.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UsuarioDetallePage from "./UsuarioDetallePage";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { SesionInterface, UsuarioInterface } from "../../../interfaces/interfaces";

const YO = 7;

/** The account being looked at, which in every test below is the caller's own. */
const usuario: UsuarioInterface = {
  id: YO,
  name: "Isaias",
  lastname: "Salas",
  birthday: new Date("1990-01-01"),
  image: "",
  phone: "700",
  user: "isaias",
  pass: "",
  id_rol: 3,
  rol: { id: 3, name: "Coordinador", description: "" },
};

const confirmarPassword = vi.fn();
const editUserName = vi.fn();
const searchUsuario_user = vi.fn();
const load = vi.fn();

vi.mock("../../../api/Login.api", () => ({
  confirmarPassword: (...args: unknown[]) => confirmarPassword(...args),
  // Named so the mock fails loudly if this screen ever reaches for the login
  // again to check a password. That is what it used to do, and it cost a
  // revoked session, a false bitácora line and a self-inflicted lockout.
  loginUsuario: () => {
    throw new Error("esta pantalla no debe iniciar sesión para comprobar una contraseña");
  },
}));
vi.mock("../../../api/Usuario.api", () => ({
  editUserName: (...args: unknown[]) => editUserName(...args),
  editUserPass: vi.fn(),
  searchUsuario_user: (...args: unknown[]) => searchUsuario_user(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
// The hook does three network reads on mount. Replaced wholesale: what is under
// test is the confirmation, and the events table and bitácora are furniture.
vi.mock("./useUsuarioDetalleData", () => ({
  useUsuarioDetalleData: () => ({
    usuario,
    eventos: [],
    bitacora: [],
    loading: false,
    load,
  }),
}));

function Harness() {
  const sesion: SesionInterface = { usuario, autenticado: true };
  const value: contextProps = { sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() };
  return (
    <SesionContext.Provider value={value}>
      <MemoryRouter>
        <UsuarioDetallePage />
      </MemoryRouter>
    </SesionContext.Provider>
  );
}

/**
 * Open the "cambiar usuario" panel, type a new name and the password, and press
 * save.
 *
 * Driven through the real controls rather than by calling the handler, because
 * the thing being asserted is what the screen does with what somebody typed —
 * and the password field only exists at all when the profile is your own.
 */
async function renombrar(nuevo: string, password: string) {
  const user = userEvent.setup();
  render(<Harness />);

  await user.click(screen.getByRole("button", { name: /cambiar usuario/i }));
  const campoUsuario = await screen.findByLabelText("Nuevo usuario");
  await user.clear(campoUsuario);
  await user.type(campoUsuario, nuevo);
  await user.type(screen.getByLabelText("Contraseña actual"), password);
  await user.click(screen.getByRole("button", { name: /^guardar$/i }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  // "Not found" is what a free username looks like through this API: the screen
  // treats a resolved search as "taken" and a rejection as "available".
  searchUsuario_user.mockRejectedValue(new Error("no existe"));
  editUserName.mockResolvedValue({ status: 200 });
});

describe("changing your own username", () => {
  it("asks the confirmation endpoint, and never the login", async () => {
    confirmarPassword.mockResolvedValue({ correcta: true, message: null });

    await renombrar("isalas", "la-mia");

    await waitFor(() => expect(confirmarPassword).toHaveBeenCalledTimes(1));
    // The password, and nothing else. The old call handed the whole session
    // user object to the login, which is how a rename came to open a session.
    expect(confirmarPassword).toHaveBeenCalledWith("la-mia");
  });

  it("sends the change once the password is confirmed", async () => {
    confirmarPassword.mockResolvedValue({ correcta: true, message: null });

    await renombrar("isalas", "la-mia");

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect((editUserName.mock.calls[0][0] as UsuarioInterface).user).toBe("isalas");
  });

  it("does not send the change when the server says the password is not confirmed", async () => {
    /**
     * The break-it test of this task on the client side, and the one whose
     * absence let the accident through: make the check accept any answer — drop
     * the `if`, or read a status instead of the field — and this fails.
     *
     * It asserts on `editUserName`, not on a toast. A confirmation that does not
     * confirm shows exactly the same error toast when the server refuses; what
     * separates a working gate from a broken one is only whether the rename was
     * sent.
     */
    confirmarPassword.mockResolvedValue({ correcta: false, message: "Esa no es su contraseña actual." });

    await renombrar("isalas", "no-es-la-mia");

    await waitFor(() => expect(confirmarPassword).toHaveBeenCalledTimes(1));
    expect(editUserName).not.toHaveBeenCalled();
    // Nor did it get as far as asking whether the new name is free: the
    // confirmation is the first gate, not a formality after the fact.
    expect(searchUsuario_user).not.toHaveBeenCalled();
  });

  it("refuses on an answer that is merely not `true`, not only on an explicit false", async () => {
    // The failures that are not a wrong password: too many attempts, an expired
    // session, a dead network, a body that arrived without the field. Every one
    // of them reaches this screen as `correcta: false`, and none of them may
    // read as a confirmation — which is the property the old `status === 500`
    // comparison had exactly backwards.
    for (const respuesta of [
      { correcta: false, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
      { correcta: false, message: "Su sesión expiró. Vuelva a iniciar sesión." },
      { correcta: false, message: "No se pudo verificar su contraseña. Inténtelo de nuevo." },
      { correcta: undefined as unknown as boolean, message: null },
    ]) {
      // Unmounted between rounds by hand: the automatic cleanup only runs
      // after the whole test, and the panel this opens leaves the body with
      // `pointer-events: none` while it is mounted, so the second round could
      // not click anything.
      cleanup();
      vi.clearAllMocks();
      searchUsuario_user.mockRejectedValue(new Error("no existe"));
      confirmarPassword.mockResolvedValue(respuesta);

      await renombrar("isalas", "algo");

      await waitFor(() => expect(confirmarPassword).toHaveBeenCalledTimes(1));
      expect(editUserName, JSON.stringify(respuesta)).not.toHaveBeenCalled();
    }
  });

  it("does not even ask when the password box was left empty", async () => {
    // Cheap, and it is the case somebody actually hits: press save, having
    // filled in the name and forgotten the password. Nothing should leave the
    // browser — an empty attempt would spend one of the five the endpoint
    // allows in a quarter of an hour.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /cambiar usuario/i }));
    const campoUsuario = await screen.findByLabelText("Nuevo usuario");
    await user.clear(campoUsuario);
    await user.type(campoUsuario, "isalas");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(confirmarPassword).not.toHaveBeenCalled();
    expect(editUserName).not.toHaveBeenCalled();
  });
});
