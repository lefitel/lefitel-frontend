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
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";
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
const resetMfaUsuario = vi.fn();
const desbloquearUsuario = vi.fn();
const load = vi.fn();

/**
 * `can` defaults to yes, and controllable per test through `canMock`.
 *
 * The password box does not ask it at all any more — see the note at
 * `handleSavePassword`. It used to be drawn from `can(rol, "seguridad",
 * "editar")`, which meant anybody who could manage accounts had no box to type
 * their own current password in, and the change went out with none on it. The
 * default-true value here is what makes the password tests below *fail* if
 * that question ever comes back: re-introduce it and `can` still answers true,
 * so the box would disappear and the test looking for it could not find it.
 *
 * The two rescue buttons (`Desbloquear cuenta`, `Restablecer 2FA`) are the
 * opposite case: they exist *because* of `seguridad.editar`, unrelated to
 * ownership, so their tests override `canMock` to see both answers.
 */
const canMock = vi.fn(() => true);
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => canMock(),
}));

vi.mock("../../../api/Login.api", () => ({
  // Named and throwing. This screen must reach the auth API for nothing at all
  // while renaming somebody.
  //
  // `loginUsuario` is the original sin: calling it opened a second session whose
  // rotation revoked the one this very tab was using, wrote "Inició sesión" to
  // the bitácora for a login nobody performed, and counted a typo as a failed
  // login attempt — so getting your own password wrong a few times here **locked
  // the account out of the ERP**.
  //
  // `confirmarPassword` was the second path and used to be stubbed here too. It
  // is gone from the module altogether now, along with its endpoint: the password
  // travels on the rename, so confirming it first would compare the same password
  // twice, out of two budgets, from two pieces of code that have to agree. A stub
  // is no longer what stops it — the export does not exist, so the compiler does.
  loginUsuario: () => {
    throw new Error("esta pantalla no debe iniciar sesión para comprobar una contraseña");
  },
}));
vi.mock("../../../api/Usuario.api", () => ({
  editUserName: (...args: unknown[]) => editUserName(...args),
  editUserPass: (...args: unknown[]) => editUserPass(...args),
  searchUsuario_user: (...args: unknown[]) => searchUsuario_user(...args),
  resetMfaUsuario: (...args: unknown[]) => resetMfaUsuario(...args),
  desbloquearUsuario: (...args: unknown[]) => desbloquearUsuario(...args),
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
  // `vi.clearAllMocks()` clears calls, not the implementation set on
  // `canMock` above — it is not a `vi.fn()` created fresh each test, so its
  // default return value survives. Restated here anyway rather than relied on,
  // since a test further down does change it with `mockReturnValueOnce`.
  canMock.mockReturnValue(true);
  // "Not found" is what a free username looks like through this API: the screen
  // treats a resolved search as "taken" and a rejection as "available".
  searchUsuario_user.mockRejectedValue(new Error("no existe"));
  editUserName.mockResolvedValue({ status: 200 });
  editUserPass.mockResolvedValue({ status: 200 });
  resetMfaUsuario.mockResolvedValue({ status: 200 });
  // 204 y no 200: desde C4 el desbloqueo no devuelve nada. Con un 200 aquí,
  // este fichero seguiría en verde con la pantalla diciendo que el rescate
  // falló sobre una cuenta ya desbloqueada.
  desbloquearUsuario.mockResolvedValue({ status: 204 });
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

  it("does not send a password the server is going to refuse for being too short", async () => {
    /**
     * This panel validated the length not at all, which is worse than the
     * profile page's stale `6`: there was no number to be wrong, so a
     * two-character password was pressable. And the refusal is not free — it
     * costs one of the five confirmations the account gets per quarter of an
     * hour, spent before the server has looked at the new password, out of the
     * same ration that pays for renaming itself.
     *
     * Eleven characters: one short, so this pins the boundary and not merely
     * "something is checked".
     */
    render(<Harness />);
    await cambiarPassword("a".repeat(PASSWORD_MIN_LENGTH - 1), "la-mia");

    expect(editUserPass).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    // Matched loosely: the number lives in `lib/password.ts`, which is where it
    // is pinned against the server's own.
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/al menos \d+ caracteres/));
  });

  it("sends a password of exactly the minimum length", async () => {
    // The other direction: a client rule stricter than the server's would refuse
    // passwords that were fine, and nothing else here would notice.
    const laMinima = "a".repeat(PASSWORD_MIN_LENGTH);
    render(<Harness />);
    await cambiarPassword(laMinima, "la-mia");

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect(enviadoPass().pass).toBe(laMinima);
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

/**
 * The rescue buttons from `docs/specs/2026-08-21-autenticacion-mfa-design.md`
 * §8 — the "vía de escape" a lost second factor or a locked-out password
 * leaves nobody able to fix without a browser, until these two.
 */
describe("resetting somebody's second factor", () => {
  it("never appears on your own profile, permission or no permission", async () => {
    // Decision Isaias already made: the server refuses `:id === req.user.id`
    // outright, so a button that only exists to draw that 403 is a promise
    // this screen does not keep. `canMock` defaults to true (see the mock
    // above), so this is specifically the ownership rule and not a stand-in
    // for "no permission".
    render(<Harness quien={YO} />);
    expect(screen.queryByRole("button", { name: /^restablecer 2fa$/i })).not.toBeInTheDocument();
  });

  it("appears on somebody else's profile when the session holds seguridad.editar", () => {
    render(<Harness quien={OTRA_PERSONA} />);
    expect(screen.getByRole("button", { name: /^restablecer 2fa$/i })).toBeInTheDocument();
  });

  it("does not appear on somebody else's profile without seguridad.editar", () => {
    canMock.mockReturnValue(false);
    render(<Harness quien={OTRA_PERSONA} />);
    expect(screen.queryByRole("button", { name: /^restablecer 2fa$/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation naming the person, and sends nothing before it is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^restablecer 2fa$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(`${usuario.name} ${usuario.lastname}`);
    expect(resetMfaUsuario).not.toHaveBeenCalled();
  });

  it("cancelling leaves the account untouched", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^restablecer 2fa$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(resetMfaUsuario).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirming resets the account being viewed and says what changes for the person, not what was done", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^restablecer 2fa$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^restablecer$/i }));

    // The account being viewed, from the fixture — `quien` on `<Harness>`
    // only changes who is *looking*, never whose profile `d.usuario` is.
    await waitFor(() => expect(resetMfaUsuario).toHaveBeenCalledWith(usuario.id));
    const { toast } = await import("sonner");
    // Not "se restableció el segundo factor": what somebody on the phone with
    // this person needs to relay — that the password alone gets them in now,
    // and that they will be asked to set the factor up again.
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/sol[oó] con su contrase[ñn]a/i));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/configurar el segundo factor/i));
  });

  it("reports the server's own refusal on 403 or 404 instead of a success, and does not reload", async () => {
    resetMfaUsuario.mockResolvedValue({ status: 403, message: "No puedes restablecer tu propio segundo factor." });
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^restablecer 2fa$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^restablecer$/i }));

    await waitFor(() => expect(resetMfaUsuario).toHaveBeenCalledTimes(1));
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("No puedes restablecer tu propio segundo factor.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("stays quiet on a 401 instead of contradicting the session-expiry toast the app already shows", async () => {
    // `web`'s global axios interceptor (`SesionProvider.tsx`) treats any 401
    // that is not the logout request's own as a dead session: it shows "Tu
    // sesión se cerró." and calls `logout()` before this screen's own promise
    // chain even resolves. A second, different message from here ("hace falta
    // confirmar de nuevo") would only contradict that one — see the comment on
    // `handleRescueError` in `UsuarioDetallePage.tsx`. This is the test that
    // fails if that silence is accidentally replaced with a toast.
    resetMfaUsuario.mockResolvedValue({ status: 401, message: "Reautenticación requerida" });
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^restablecer 2fa$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^restablecer$/i }));

    await waitFor(() => expect(resetMfaUsuario).toHaveBeenCalledTimes(1));
    const { toast } = await import("sonner");
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("unlocking an account", () => {
  it("appears even on your own profile — no ownership rule applies here", () => {
    // Unlike the 2FA reset, the server draws no `:id === req.user.id` line for
    // this route, and being locked out is incompatible with having this page
    // open in the first place. Pinned so nobody carries the other button's
    // self-hiding rule over here without a reason to.
    render(<Harness quien={YO} />);
    expect(screen.getByRole("button", { name: /^desbloquear cuenta$/i })).toBeInTheDocument();
  });

  it("does not appear without seguridad.editar", () => {
    canMock.mockReturnValue(false);
    render(<Harness quien={OTRA_PERSONA} />);
    expect(screen.queryByRole("button", { name: /^desbloquear cuenta$/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation naming the person before unlocking anything", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^desbloquear cuenta$/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(`${usuario.name} ${usuario.lastname}`);
    expect(desbloquearUsuario).not.toHaveBeenCalled();
  });

  it("cancelling leaves the account untouched", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^desbloquear cuenta$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(desbloquearUsuario).not.toHaveBeenCalled();
  });

  it("confirming unlocks the account being viewed", async () => {
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^desbloquear cuenta$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^desbloquear$/i }));

    await waitFor(() => expect(desbloquearUsuario).toHaveBeenCalledWith(usuario.id));
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalled();
  });

  it("reports the server's own refusal on 403 or 404 instead of a success", async () => {
    desbloquearUsuario.mockResolvedValue({ status: 404 });
    const user = userEvent.setup();
    render(<Harness quien={OTRA_PERSONA} />);

    await user.click(screen.getByRole("button", { name: /^desbloquear cuenta$/i }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: /^desbloquear$/i }));

    await waitFor(() => expect(desbloquearUsuario).toHaveBeenCalledTimes(1));
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
