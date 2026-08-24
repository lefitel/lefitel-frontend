// Renaming your own account carries your password, and this file is what keeps
// the gate from being decorative.
//
// It has been decorative twice. First the screen checked the password by calling
// the whole login and comparing `status === 500`, while the API answered 400 —
// the two met only because `Login.api.ts` flattens every non-2xx to 500,
// deliberately and for an unrelated reason. So the check worked by accident, and
// the day a real status arrived intact it would have started letting wrong
// passwords through with nothing on screen or in CI to say so.
//
// Then the accident was fixed and the gate was still worth nothing, for a
// reason no test here could see: the screen confirmed the password against
// `POST /api/auth/confirm-password` and then sent the rename **without it**. The
// server demanded nothing, and the other screen that renames the same account
// asked for nothing at all. A confirmation that lives only in the client is
// optional by definition — whoever does not want to type it uses the other
// screen, or `curl`.
//
// So `updateUserName` demands it server-side, and this screen sends it with the
// change. Hence the shape of every test below: they assert what `editUserName`
// was — or was not — **called with**, and specifically whether `oldPass` was on
// it. A rename that reaches the server without a password is refused there now,
// so the observable failure is a 400 the person cannot act on; the toast looks
// the same either way.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UsuarioDetallePage from "./UsuarioDetallePage";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { SesionInterface, UsuarioInterface } from "../../../interfaces/interfaces";

const YO = 7;
const OTRA_PERSONA = 99;

/** The account being looked at. The caller is this person unless a test says so. */
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

const editUserName = vi.fn();
const editUserPass = vi.fn();
const searchUsuario_user = vi.fn();
const load = vi.fn();

/**
 * `can` answers yes to everything, and this screen does not ask it any more.
 *
 * Both halves matter. The screen used to decide whether to *show* the current
 * password box by asking `can(rol, "seguridad", "editar")`, which meant anybody
 * who could manage accounts had no box to type it in — on their own account
 * included — and the change went out with no password on it. That is the hole
 * the server closed, so the box is drawn from ownership now and this module is
 * not imported here at all.
 *
 * The mock stays because it is what makes the password tests below *fail* if the
 * old question ever comes back: re-introduce `isAdmin` and `can` answers true,
 * the box disappears, and the test looking for it cannot find it. Left real
 * except for `can`, since `interfaces.ts` reaches into this module for the rest.
 */
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));

vi.mock("../../../api/Login.api", () => ({
  // Both named, and both throw. This screen must reach the auth API for nothing
  // at all while renaming somebody.
  //
  // `loginUsuario` is the original sin: calling it opened a second session whose
  // rotation revoked the one this very tab was using, wrote "Inició sesión" to
  // the bitácora for a login nobody performed, and counted a typo as a failed
  // login attempt — so getting your own password wrong a few times here **locked
  // the account out of the ERP**.
  //
  // `confirmarPassword` is the second path, and it throws for a different
  // reason: it works, it is harmless, and it must not be here. The password now
  // travels on the rename itself, so confirming it first would compare the same
  // password twice, out of two budgets, from two pieces of code that have to
  // agree — and two ways of doing one thing diverging is the accident this whole
  // plan has been chasing.
  loginUsuario: () => {
    throw new Error("esta pantalla no debe iniciar sesión para comprobar una contraseña");
  },
  confirmarPassword: () => {
    throw new Error("la contraseña viaja con el renombrado; no se confirma aparte");
  },
}));
vi.mock("../../../api/Usuario.api", () => ({
  editUserName: (...args: unknown[]) => editUserName(...args),
  editUserPass: (...args: unknown[]) => editUserPass(...args),
  searchUsuario_user: (...args: unknown[]) => searchUsuario_user(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
// The hook does three network reads on mount. Replaced wholesale: what is under
// test is the rename, and the events table and bitácora are furniture.
vi.mock("./useUsuarioDetalleData", () => ({
  useUsuarioDetalleData: () => ({
    usuario,
    eventos: [],
    bitacora: [],
    loading: false,
    load,
  }),
}));

/**
 * The screen, seen by whoever is logged in.
 *
 * `quien` defaults to the owner of the record, which is the case every test but
 * one is about. The other passes somebody else, because whether the password is
 * asked for at all depends on that and nothing else.
 */
function Harness({ quien = YO }: { quien?: number }) {
  const sesion: SesionInterface = { usuario: { ...usuario, id: quien }, autenticado: true };
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

/** The single object `editUserName` was called with. */
const enviado = () => editUserName.mock.calls[0][0] as UsuarioInterface & { oldPass?: string };

/**
 * Open the "Contraseña" panel, fill it in and press save.
 *
 * `actual` is left out for the case the panel does not offer the box, which is
 * every profile that is not your own.
 */
async function cambiarPassword(nueva: string, actual?: string) {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /^contraseña$/i }));
  await user.type(await screen.findByLabelText("Nueva contraseña"), nueva);
  await user.type(screen.getByLabelText("Confirmar contraseña"), nueva);
  if (actual !== undefined) await user.type(screen.getByLabelText("Contraseña actual"), actual);
  await user.click(screen.getByRole("button", { name: /^guardar$/i }));
  return user;
}

/** The single object `editUserPass` was called with. */
const enviadoPass = () => editUserPass.mock.calls[0][0] as UsuarioInterface & { oldPass?: string };

beforeEach(() => {
  vi.clearAllMocks();
  // "Not found" is what a free username looks like through this API: the screen
  // treats a resolved search as "taken" and a rejection as "available".
  searchUsuario_user.mockRejectedValue(new Error("no existe"));
  editUserName.mockResolvedValue({ status: 200 });
  editUserPass.mockResolvedValue({ status: 200 });
});

describe("changing your own username", () => {
  it("sends the password along with the change", async () => {
    // The break-it test of this task on the client. Drop `oldPass` from the
    // call — which is exactly what this screen used to do, having confirmed the
    // password a moment earlier — and this fails. Nothing else would: the
    // request still goes out, the toast is still the happy one, and the only
    // thing that changes is that the server refuses it.
    await renombrar("isalas", "la-mia");

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().user).toBe("isalas");
    expect(enviado().oldPass).toBe("la-mia");
  });

  it("sends the password that was typed, and not some other field of the record", async () => {
    // Cheap, and it caught its own family of mistake earlier in this plan: a
    // test that compared against `undefined` because the fixture carried no
    // password would have passed against an endpoint that sent nothing. So the
    // value asserted is one only the keyboard could have produced.
    await renombrar("isalas", "una-contraseña-inconfundible");

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().oldPass).toBe("una-contraseña-inconfundible");
    // Not the `pass` field of the user record, which is empty on this fixture
    // and is a hash on a real one.
    expect(enviado().oldPass).not.toBe(usuario.pass);
  });

  it("sends nothing at all when the password box was left empty", async () => {
    // The case somebody actually hits: fill in the name, forget the password,
    // press save. Nothing should leave the browser — an empty attempt would be
    // refused anyway, and it would spend one of the five confirmations the
    // account is allowed in a quarter of an hour.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /cambiar usuario/i }));
    const campoUsuario = await screen.findByLabelText("Nuevo usuario");
    await user.clear(campoUsuario);
    await user.type(campoUsuario, "isalas");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(editUserName).not.toHaveBeenCalled();
    expect(searchUsuario_user).not.toHaveBeenCalled();
  });

  it("keeps the refusal visible instead of pretending it worked", async () => {
    // What a refused rename looks like now that the server is the one refusing:
    // a 400 for a missing password, a 401 for a wrong one, a 429 for too many
    // tries. None of them may be reported as a success, and none may leave the
    // session's username updated to a name the server did not accept.
    for (const respuesta of [
      { status: 400, message: "Debe proporcionar su contraseña actual." },
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
      { status: 500, message: "Error desconocido" },
    ]) {
      // Unmounted between rounds by hand: the automatic cleanup only runs after
      // the whole test, and the panel this opens leaves the body with
      // `pointer-events: none` while it is mounted, so the second round could
      // not click anything.
      cleanup();
      vi.clearAllMocks();
      searchUsuario_user.mockRejectedValue(new Error("no existe"));
      editUserName.mockResolvedValue(respuesta);

      await renombrar("isalas", "algo");

      const { toast } = await import("sonner");
      await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
      // The server's own sentence, not one this screen made up: a 429 and a
      // wrong password are different things to be told.
      expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message);
      // And nothing was reloaded, which is what a successful rename does.
      expect(load, JSON.stringify(respuesta)).not.toHaveBeenCalled();
    }
  });
});

/**
 * Changing your own password asks for the current one, and the permission has
 * nothing to do with it.
 *
 * The hole: the box was drawn on `!isAdmin`, so anybody holding
 * `seguridad.editar` was shown no box at all and the request went out with no
 * password — their own account included. On an unattended machine with an
 * administrator's session open, whoever sat down set a new password, kept the
 * session already there and ended every other one of that account in the same
 * write. `can` answers true throughout this file (see the mock at the top), so
 * bringing that question back makes these two tests fail rather than pass more
 * quietly.
 */
describe("changing your own password", () => {
  it("sends the current password along with the change", async () => {
    render(<Harness />);
    await cambiarPassword("una-clave-de-prueba", "la-mia");

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect(enviadoPass().pass).toBe("una-clave-de-prueba");
    // The value only the keyboard could have produced, not the record's own
    // `pass` field — empty on this fixture and a hash on a real one. A test
    // comparing against `undefined` is how the same assertion passed against an
    // endpoint that sent nothing, earlier in this plan.
    expect(enviadoPass().oldPass).toBe("la-mia");
    expect(enviadoPass().oldPass).not.toBe(usuario.pass);
  });

  it("sends nothing at all when the current password box was left empty", async () => {
    // Fill in the new one twice, forget the current one, press save. Nothing
    // leaves the browser: the server would refuse it anyway, and the attempt
    // would spend one of the five confirmations this account gets in a quarter
    // of an hour.
    render(<Harness />);
    await cambiarPassword("una-clave-de-prueba");

    expect(editUserPass).not.toHaveBeenCalled();
  });
});

describe("resetting somebody else's password", () => {
  it("sends no password and does not ask for one", async () => {
    // The half the exemption exists for, and it has to keep working: an
    // administrator resets a password precisely because that person cannot get
    // in, so there is none either of them could supply. The server draws the
    // same line — `requiresOwnPassword` is true only for the caller's own id,
    // permission or no permission.
    render(<Harness quien={OTRA_PERSONA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^contraseña$/i }));
    await user.type(await screen.findByLabelText("Nueva contraseña"), "una-clave-de-prueba");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "una-clave-de-prueba");
    // No box, so `oldPass` below cannot have come from something somebody typed.
    expect(screen.queryByLabelText("Contraseña actual")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect(enviadoPass().pass).toBe("una-clave-de-prueba");
    expect(enviadoPass().oldPass).toBeUndefined();
  });
});

describe("renaming somebody else's account", () => {
  it("sends no password, because there is none the caller could know", async () => {
    /**
     * The other half of the decision, and the reason the rule is not "always".
     *
     * `seguridad.editar` is what authorises acting on another account, and the
     * target's password is unknown to the caller by design — so there is nothing
     * to confirm. The server draws the same line: `requiresOwnPassword`
     * is true only for the caller's own id, permission or no permission.
     *
     * There is no password field on screen in this case at all, which is what
     * makes the assertion below possible: whatever `oldPass` is, it cannot have
     * come from a box somebody typed in.
     */
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /cambiar usuario/i }));
    const campoUsuario = await screen.findByLabelText("Nuevo usuario");
    await user.clear(campoUsuario);
    await user.type(campoUsuario, "isalas");
    expect(screen.queryByLabelText("Contraseña actual")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().user).toBe("isalas");
    expect(enviado().oldPass).toBeUndefined();
  });
});
