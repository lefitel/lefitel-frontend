// The profile page renames the account it belongs to, and until this task it
// did so having asked for nothing.
//
// That is the hole. `UsuarioDetallePage` asked for a password before renaming
// your own account; this screen renamed the same account, through the same
// endpoint, with no password anywhere on it. Same operation, same account, two
// screens — so the confirmation was optional in practice: whoever did not want
// to type it opened this one instead. And a username is half of the credential.
// Change somebody's and they cannot log in, not because they have forgotten
// their password but because they no longer know what name to offer it with. So
// what the hole bought was locking somebody out of their own account without
// ever knowing their password: the unattended machine in the office, the shared
// field laptop.
//
// The server refuses a self-rename with no password now. These tests are about
// the other half: that this screen asks for one and puts it on the request. They
// assert what `editUserName` was called with rather than what a toast said,
// because a screen that sends nothing shows the same spinner and gets a 400 the
// person cannot do anything about.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PerfilPage from "./PerfilPage";
import { SesionContext, type contextProps } from "../../context/SesionContext";
import { PASSWORD_MIN_LENGTH } from "../../lib/password";
import type { SesionInterface, UsuarioInterface } from "../../interfaces/interfaces";

const YO = 7;

const usuario: UsuarioInterface = {
  id: YO,
  name: "Isaias",
  lastname: "Salas",
  birthday: new Date("1990-01-01"),
  image: "",
  phone: "700",
  user: "isaias",
  // A hash, the way a real record carries one. Deliberately not empty: a test
  // whose fixture has no password can assert `oldPass` against `undefined` and
  // pass against a screen that sends nothing, which is a mistake this plan
  // already made once.
  pass: "$2a$12$un-hash-cualquiera",
  id_rol: 3,
  rol: { id: 3, name: "Coordinador", description: "" },
};

/** The same record as it arrives over the wire: `birthday` is a string there. */
const PERFIL_CARGADO = { ...usuario, birthday: "1990-01-01" as unknown as Date };

const editUserName = vi.fn();
const editUsuario = vi.fn();
const editUserPass = vi.fn();
const searchUsuario = vi.fn();
const sendVerificationEmail = vi.fn();
const verifyEmailToken = vi.fn();

vi.mock("../../api/Usuario.api", () => ({
  editUserName: (...args: unknown[]) => editUserName(...args),
  editUsuario: (...args: unknown[]) => editUsuario(...args),
  editUserPass: (...args: unknown[]) => editUserPass(...args),
  searchUsuario: (...args: unknown[]) => searchUsuario(...args),
}));
// Named and throwing: this screen must not reach the auth API to rename anybody.
// The password rides on the rename itself, and the server compares it there.
//
// There is no `confirmarPassword` in this factory because there is no such export
// any more — it and its endpoint are retired, and the compiler now refuses a call
// to it, which is a harder guarantee than a throwing stub was.
vi.mock("../../api/Login.api", () => ({
  loginUsuario: () => {
    throw new Error("esta pantalla no debe iniciar sesión para comprobar una contraseña");
  },
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
  verifyEmailToken: (...args: unknown[]) => verifyEmailToken(...args),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function Harness() {
  const sesion: SesionInterface = { usuario, autenticado: true };
  const value: contextProps = { sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() };
  return (
    <SesionContext.Provider value={value}>
      <PerfilPage />
    </SesionContext.Provider>
  );
}

/**
 * Type a new username, optionally a password, and go through the confirmation
 * dialog to the save.
 *
 * Driven through the real controls: the thing being asserted is what the screen
 * sends given what somebody typed, and the dialog is part of that path — the
 * request only leaves after "Sí, cambiar".
 */
async function renombrar(nuevo: string, password?: string) {
  const user = userEvent.setup();
  render(<Harness />);
  // The page loads the profile on mount and shows skeletons until it resolves.
  const campoUsuario = await screen.findByLabelText("Usuario");

  await user.clear(campoUsuario);
  await user.type(campoUsuario, nuevo);
  if (password !== undefined) {
    await user.type(screen.getByLabelText(/confirma tu contraseña/i), password);
  }
  await user.click(screen.getByRole("button", { name: /actualizar/i }));
  return user;
}

/** Get past the "¿Cambiar nombre de usuario?" dialog. */
async function confirmar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /sí, cambiar/i }));
}

/** The single object `editUserName` was called with. */
const enviado = () => editUserName.mock.calls[0][0] as UsuarioInterface & { oldPass?: string };

beforeEach(() => {
  vi.clearAllMocks();
  // As the API really answers it: JSON, so `birthday` is a string and not a
  // `Date`. The screen slices the first ten characters off it to feed the date
  // picker, which an object's `toString()` does not survive.
  searchUsuario.mockResolvedValue(PERFIL_CARGADO);
  editUserName.mockResolvedValue({ status: 200 });
  editUserPass.mockResolvedValue({ status: 200 });
  sendVerificationEmail.mockResolvedValue({ status: 200, message: "Si la dirección es válida, se envió un enlace de verificación." });
  verifyEmailToken.mockResolvedValue({ status: 200, message: "Correo verificado." });
  // The hash-verification effect reads this on every mount. Left over from a
  // previous test, it would fire `verifyEmailToken` in tests that have
  // nothing to do with it — the true reset belongs here, not scattered across
  // whichever `describe` block happens to set it.
  window.location.hash = "";
});

/**
 * Changing your own password from this screen, which is where everybody does it.
 *
 * This path was never tested, and it is the one the server's rule now applies to
 * universally. It always sent `oldPass`, so nothing here is a fix — it is the
 * only thing that would notice if the payload were ever tidied up, and after
 * `updateUserPass` started demanding the current password of *everybody* changing
 * their own, dropping it would answer 400 to every password change in the ERP
 * rather than only to the ones made by people without the permission.
 */
describe("changing your own password from the profile page", () => {
  async function cambiarPassword(actual: string, nueva: string) {
    const user = userEvent.setup();
    render(<Harness />);
    // The page shows skeletons until the profile resolves.
    await user.type(await screen.findByLabelText(/contraseña actual/i), actual);
    await user.type(screen.getByLabelText("Nueva contraseña"), nueva);
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), nueva);
    await user.click(screen.getByRole("button", { name: /cambiar clave/i }));
    await user.click(await screen.findByRole("button", { name: /sí, cambiar/i }));
    return user;
  }

  it("sends the current password with the new one", async () => {
    await cambiarPassword("la-mia", "una-clave-de-prueba");

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    const enviado = editUserPass.mock.calls[0][0] as UsuarioInterface & { oldPass?: string };
    expect(enviado.pass).toBe("una-clave-de-prueba");
    // Typed, and not the record's own `pass` field, which carries a hash on this
    // fixture for exactly this reason.
    expect(enviado.oldPass).toBe("la-mia");
    expect(enviado.oldPass).not.toBe(usuario.pass);
  });

  it("does not send a password the server is going to refuse for being too short", async () => {
    /**
     * This screen checked `< 6` while the server demands twelve, and the gap was
     * written off as harmless because the server refuses correctly. What that
     * missed is the price: the 400 costs one of the five confirmations this
     * account gets per quarter of an hour, the token is taken before the server
     * looks at the new password, and the same ration also pays for renaming
     * itself. Nine, ten, eleven — the way anybody reacts to a length error — and
     * the person is locked out of both operations for fifteen minutes.
     *
     * Eleven characters, so this fails against the old rule rather than against
     * no rule at all.
     */
    const user = userEvent.setup();
    render(<Harness />);
    const corta = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    await user.type(await screen.findByLabelText(/contraseña actual/i), "la-mia");
    await user.type(screen.getByLabelText("Nueva contraseña"), corta);
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), corta);
    await user.click(screen.getByRole("button", { name: /cambiar clave/i }));

    // Not even the confirmation dialog, so nothing can reach the server behind
    // it.
    expect(screen.queryByRole("button", { name: /sí, cambiar/i })).toBeNull();
    expect(editUserPass).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    // And the person is told the actual rule. Matched loosely on purpose: the
    // number belongs to `lib/password.ts`, which is where it is pinned to the
    // server's.
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/al menos \d+ caracteres/));
  });

  it("sends a password of exactly the minimum length", async () => {
    // The other direction, which nothing else here would catch: a client rule
    // stricter than the server's blocks passwords that were perfectly good.
    const laMinima = "a".repeat(PASSWORD_MIN_LENGTH);
    await cambiarPassword("la-mia", laMinima);

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect((editUserPass.mock.calls[0][0] as UsuarioInterface).pass).toBe(laMinima);
  });

  it("sends nothing when the current password box was left empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(await screen.findByLabelText("Nueva contraseña"), "una-clave-de-prueba");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "una-clave-de-prueba");
    await user.click(screen.getByRole("button", { name: /cambiar clave/i }));

    // Not even the confirmation dialog: an empty attempt would be refused
    // anyway, and it would spend one of the five confirmations this account gets
    // in a quarter of an hour.
    expect(screen.queryByRole("button", { name: /sí, cambiar/i })).toBeNull();
    expect(editUserPass).not.toHaveBeenCalled();
  });
});

describe("renaming your own account from the profile page", () => {
  it("sends the current password with the change", async () => {
    // The break-it test of this task on the client. Take the password field off
    // this screen, or stop putting `oldPass` on the call, and this fails —
    // which is more than could be said before, when the screen sent the rename
    // with nothing at all and every test in this repository stayed green.
    const user = await renombrar("isalas", "la-mia");
    await confirmar(user);

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().user).toBe("isalas");
    expect(enviado().oldPass).toBe("la-mia");
  });

  it("sends what was typed, and not the record's own password field", async () => {
    // The fixture carries a hash in `pass`, so a screen that forwarded the whole
    // record and called that a confirmation would be caught here rather than
    // passing on an `undefined` that happened to match.
    const user = await renombrar("isalas", "una-contraseña-inconfundible");
    await confirmar(user);

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().oldPass).toBe("una-contraseña-inconfundible");
    expect(enviado().oldPass).not.toBe(usuario.pass);
  });

  it("does not even open the dialog when the password box was left empty", async () => {
    // Fill in the name, forget the password, press save. Nothing leaves the
    // browser: the server would refuse it anyway, and the attempt would spend
    // one of the five confirmations the account gets in a quarter of an hour.
    await renombrar("isalas");

    expect(screen.queryByRole("button", { name: /sí, cambiar/i })).toBeNull();
    expect(editUserName).not.toHaveBeenCalled();
  });

  it("reports the server's refusal rather than a success", async () => {
    // A 400 for a missing password, a 401 for a wrong one, a 429 for too many
    // tries. Each is a different thing to be told, and none of them is a
    // rename that happened.
    for (const respuesta of [
      { status: 400, message: "Debe proporcionar su contraseña actual." },
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      // Unmounted by hand between rounds: the automatic cleanup only runs after
      // the whole test, and a second copy of this page on the same document
      // makes every query ambiguous.
      cleanup();
      vi.clearAllMocks();
      searchUsuario.mockResolvedValue(PERFIL_CARGADO);
      editUserName.mockResolvedValue(respuesta);

      const user = await renombrar("isalas", "algo");
      await confirmar(user);

      const { toast } = await import("sonner");
      await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
      expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message);
    }
  });

  it("keeps the rename's password separate from the password-change form", async () => {
    // Two forms on one screen, and two boxes that must not be one value.
    // Sharing it would mean typing into the "cambiar contraseña" card and
    // finding the rename already armed with it — or sending a rename carrying
    // whatever was left in a box somebody had been using for something else.
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    const paraRenombrar = screen.getByLabelText(/confirma tu contraseña/i) as HTMLInputElement;
    const paraCambiarClave = screen.getByLabelText(/contraseña actual/i) as HTMLInputElement;

    await user.type(paraCambiarClave, "para-el-cambio-de-clave");
    expect(paraRenombrar.value).toBe("");

    await user.type(paraRenombrar, "para-el-renombrado");
    expect(paraCambiarClave.value).toBe("para-el-cambio-de-clave");
  });
});

/**
 * The recovery email card, Task 8 of `2026-08-25-correo-verificado-y-recuperacion`.
 *
 * The acceptance criterion that actually matters here is not "the form
 * submits" — it is that the three states (no address, saved-but-unverified,
 * verified) read as three different things without anyone having to study the
 * card. A saved-but-unverified address is exactly as useless as none at all,
 * because `/password/forgot` refuses to act on one — so the tests below
 * assert on the visible badge text and the warning caption, not on internal
 * state, the same way a person reading the screen would tell the states apart.
 */
describe("recovery email — the three states", () => {
  it("reads 'Sin configurar' when the account has no address on file", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: null, email_verified_at: null });
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    expect(await screen.findByText("Sin configurar")).toBeInTheDocument();
    expect(screen.queryByText("Sin verificar")).toBeNull();
    expect(screen.queryByText("Verificado")).toBeNull();
  });

  it("reads 'Sin verificar', with the warning that it cannot recover the account yet, when the address was saved but never confirmed", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    expect(await screen.findByText("Sin verificar")).toBeInTheDocument();
    expect(screen.getByText(/no sirve para recuperar tu cuenta/i)).toBeInTheDocument();
    expect(screen.queryByText("Verificado")).toBeNull();
    expect(screen.queryByText("Sin configurar")).toBeNull();
  });

  it("reads 'Verificado', with no warning at all, when the address was confirmed", async () => {
    searchUsuario.mockResolvedValue({
      ...PERFIL_CARGADO,
      email: "isaias@osefi.net",
      email_verified_at: "2026-08-20T00:00:00.000Z",
    });
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    expect(await screen.findByText("Verificado")).toBeInTheDocument();
    expect(screen.queryByText("Sin verificar")).toBeNull();
    expect(screen.queryByText("Sin configurar")).toBeNull();
    expect(screen.queryByText(/no sirve para recuperar tu cuenta/i)).toBeNull();
  });

  it("pre-fills the address box with whatever is already on file, unverified or not", async () => {
    // So resending to the same address is retyping a password, not the address.
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    expect((screen.getByLabelText("Dirección de correo") as HTMLInputElement).value).toBe("isaias@osefi.net");
  });
});

describe("sending a verification email", () => {
  /** Fill both boxes and press the card's own submit button. */
  async function intentarEnviar(email: string, pass: string) {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByLabelText("Usuario");

    const campoEmail = screen.getByLabelText("Dirección de correo") as HTMLInputElement;
    await user.clear(campoEmail);
    if (email) await user.type(campoEmail, email);
    if (pass) await user.type(screen.getByLabelText(/confirma con tu contraseña/i), pass);
    await user.click(screen.getByRole("button", { name: /verificar correo|reenviar verificación|guardar y verificar/i }));
    return user;
  }

  it("does not even open the confirmation dialog with no address at all", async () => {
    await intentarEnviar("", "la-mia");

    expect(screen.queryByRole("button", { name: /sí, enviar/i })).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("does not open the dialog for a string that is not shaped like an address", async () => {
    await intentarEnviar("esto-no-es-un-correo", "la-mia");

    expect(screen.queryByRole("button", { name: /sí, enviar/i })).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("does not open the dialog with the password box left empty", async () => {
    // The server refuses this with 400 either way — refusing here first saves
    // the round trip and, more to the point, a slot of the five confirmations
    // this account is allowed per quarter of an hour, shared with the
    // username and password cards on this same page.
    await intentarEnviar("nueva@osefi.net", "");

    expect(screen.queryByRole("button", { name: /sí, enviar/i })).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends the trimmed address and the typed password, then clears only the password on success", async () => {
    const user = await intentarEnviar("  nueva@osefi.net  ", "la-mia");
    await user.click(await screen.findByRole("button", { name: /sí, enviar/i }));

    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    expect(sendVerificationEmail).toHaveBeenCalledWith("nueva@osefi.net", "la-mia");

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect((screen.getByLabelText(/confirma con tu contraseña/i) as HTMLInputElement).value).toBe("");
  });

  it("turns a 429 into a plain-language wait-and-retry message, whichever limiter actually fired", async () => {
    // The known trap this pair of calls sits on: three different rate-limit
    // buckets can answer this one request (`passwordConfirmLimiter`,
    // `emailSendLimiter` — see `auth.routes.ts`), each with its own wording,
    // and none of it says "wait" as plainly as this card needs to. The
    // assertion is on the card's own sentence, not on whichever the mock
    // happens to send back.
    sendVerificationEmail.mockResolvedValue({
      status: 429,
      message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar.",
    });
    const user = await intentarEnviar("nueva@osefi.net", "la-mia");
    await user.click(await screen.findByRole("button", { name: /sí, enviar/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/demasiados correos/i));
  });

  it("shows the server's own sentence for a wrong password apart from an inactive account, though both are a 401", async () => {
    // The pointed case from the task: an account archived between
    // `authenticate` and the handler answers 401 too, and it must not read as
    // a password mistake — the session, not the password, is what ended.
    for (const respuesta of [
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 401, message: "Su cuenta ya no está activa." },
    ]) {
      cleanup();
      vi.clearAllMocks();
      searchUsuario.mockResolvedValue(PERFIL_CARGADO);
      sendVerificationEmail.mockResolvedValue(respuesta);

      const user = await intentarEnviar("nueva@osefi.net", "algo");
      await user.click(await screen.findByRole("button", { name: /sí, enviar/i }));

      const { toast } = await import("sonner");
      await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
      expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message);
    }
  });
});

/**
 * `{origin}/perfil#verify_email=TOKEN` — the API puts the token in the
 * fragment rather than the query string precisely so it never reaches a
 * server, a proxy, or a `Referer` header. These tests are about the two
 * guarantees that make that hold on this side: the token is read once and
 * redeemed, and the fragment is gone from the address bar regardless of
 * whether redeeming it actually worked.
 */
describe("verifying via the link's fragment token", () => {
  it("redeems the token and clears the fragment from the address bar", async () => {
    window.location.hash = "#verify_email=un-token-opaco";

    render(<Harness />);

    await waitFor(() => expect(verifyEmailToken).toHaveBeenCalledWith("un-token-opaco"));
    expect(window.location.hash).toBe("");
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("clears the fragment even when the token is refused, so a dead link never lingers in the address bar", async () => {
    window.location.hash = "#verify_email=un-token-caducado";
    verifyEmailToken.mockResolvedValue({ status: 400, message: "Este enlace ya no es válido. Solicite uno nuevo." });

    render(<Harness />);

    await waitFor(() => expect(verifyEmailToken).toHaveBeenCalledWith("un-token-caducado"));
    expect(window.location.hash).toBe("");
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este enlace ya no es válido. Solicite uno nuevo."));
  });

  it("does nothing when the page was opened with no token in the address", async () => {
    window.location.hash = "";

    render(<Harness />);
    await screen.findByLabelText("Usuario");

    expect(verifyEmailToken).not.toHaveBeenCalled();
  });
});
