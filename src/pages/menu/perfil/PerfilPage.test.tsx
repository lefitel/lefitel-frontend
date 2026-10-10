// The profile page changes the three credentials of the account it belongs to,
// and two of its three editors used to carry a password box that no longer
// belongs there.
//
// **The history, because the boxes were not gratuitous.** This screen once
// renamed the account having asked for nothing at all, while
// `UsuarioDetallePage` asked for a password to do the same thing through the
// same endpoint — so the confirmation was optional in practice, and a username
// is half of the credential: change somebody's and they cannot log in, not
// because they forgot their password but because they no longer know what name
// to offer it with. The fix was to make the server demand it and have both
// screens send it.
//
// **Why the boxes go now.** The demand moved again, up to the step-up gate that
// sits in front of these routes — which asks for the password once and then
// stops asking for ten minutes, and asks for a *factor* instead from an account
// that has one. With the form still collecting a password of its own, renaming
// yourself meant typing the same secret twice for one request: once into the
// page, once into the dialog. That double prompt is what this whole arc exists
// to remove, and it is the thing these tests now hold.
//
// So the assertions below are about **what leaves the browser**, not about what
// a toast said: a screen that quietly puts a password back on the payload looks
// identical from the outside, and the server would simply ignore it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PerfilPage from "./PerfilPage";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";
import type { SesionInterface, UsuarioInterface } from "../../../interfaces/interfaces";

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
const getSessions = vi.fn();
const endSession = vi.fn();
const logoutAllSessions = vi.fn();
const getBitacora = vi.fn();
const getEvento_usuario = vi.fn();
const uploadImage = vi.fn();

vi.mock("../../../api/Usuario.api", () => ({
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
vi.mock("../../../api/Login.api", () => ({
  loginUsuario: () => {
    throw new Error("esta pantalla no debe iniciar sesión para comprobar una contraseña");
  },
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
  verifyEmailToken: (...args: unknown[]) => verifyEmailToken(...args),
  getSessions: (...args: unknown[]) => getSessions(...args),
  endSession: (...args: unknown[]) => endSession(...args),
  logoutAllSessions: (...args: unknown[]) => logoutAllSessions(...args),
}));
// The three calls this page makes for context rather than for its own job. They
// are mocked to resolve empty and left that way for every test here: the
// sections they feed render nothing on an empty list, which keeps the queries
// below about the forms and not about whatever a fixture happened to contain.
vi.mock("../../../api/Bitacora.api", () => ({
  getBitacora: (...args: unknown[]) => getBitacora(...args),
}));
vi.mock("../../../api/Evento.api", () => ({
  getEvento_usuario: (...args: unknown[]) => getEvento_usuario(...args),
}));
vi.mock("../../../api/Upload.api", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
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
 * Wait for the profile to land.
 *
 * The heading, not a form field, because the redesign put every field behind an
 * editor that opens on demand: `findByLabelText("Usuario")` used to double as
 * this gate and now would wait forever on a page that has finished loading
 * perfectly well. The name in the header is the first thing that exists once
 * the record arrives.
 */
const esperarCarga = () => screen.findByRole("heading", { name: /isaias\s+salas/i });

/**
 * Open one of the three credential editors, or the personal-details one.
 *
 * The buttons that open an editor are named by `aria-label`, not by their
 * visible "Cambiar" — three buttons all reading "Cambiar" would be ambiguous
 * here and useless to a screen reader. These are those labels.
 */
const ABRE = {
  personal: /^editar$/i,
  usuario: /cambiar nombre de usuario/i,
  password: /^cambiar contraseña$/i,
  email: /cambiar correo de recuperación/i,
} as const;

async function abrir(user: ReturnType<typeof userEvent.setup>, cual: keyof typeof ABRE) {
  await user.click(screen.getByRole("button", { name: ABRE[cual] }));
}

/**
 * Type a new username and press save, stopping at the confirmation dialog.
 *
 * Driven through the real controls: the thing being asserted is what the screen
 * sends given what somebody typed, and both the editor and the dialog are part
 * of that path — the field does not exist until the editor is opened, and the
 * request only leaves after "Sí, cambiar".
 */
async function renombrar(nuevo: string) {
  const user = userEvent.setup();
  render(<Harness />);
  await esperarCarga();
  await abrir(user, "usuario");

  const campoUsuario = screen.getByLabelText("Usuario");
  await user.clear(campoUsuario);
  await user.type(campoUsuario, nuevo);
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
  // The three context calls, empty. Their sections then render nothing, which is
  // what they do in production when the request fails — see `usePerfilData`,
  // where only the profile itself is allowed to fail loudly.
  getSessions.mockResolvedValue([]);
  // The envelope, since C3: every listing answers `{data, total, page, limit}`
  // and this screen reads `.data`.
  getBitacora.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25 });
  getEvento_usuario.mockResolvedValue([]);
  endSession.mockResolvedValue({ status: 200, message: null });
  logoutAllSessions.mockResolvedValue({ status: 200, message: null, cerradas: 0 });
  // `{ ok, path }` and not a bare string: a failed upload used to come back as
  // the literal "500", which shared its type with a real path and could be
  // saved as one. See `api/Upload.api.ts`.
  uploadImage.mockResolvedValue({ ok: true, path: "/uploads/una-foto.jpg" });
  editUsuario.mockResolvedValue({ id: 1, name: "Isaias" });
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
    await esperarCarga();
    await abrir(user, "password");

    await user.type(screen.getByLabelText(/contraseña actual/i), actual);
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
    await esperarCarga();
    await abrir(user, "password");

    const corta = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    await user.type(screen.getByLabelText(/contraseña actual/i), "la-mia");
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
    await esperarCarga();
    await abrir(user, "password");

    await user.type(screen.getByLabelText("Nueva contraseña"), "una-clave-de-prueba");
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
  it("asks for a name and nothing else — no password box in the editor", async () => {
    /**
     * 🔴 The break-it test of this task on the client, and it is written as a
     * query for **any** password field rather than for the one label that used
     * to be here. A screen that re-grew the box under a different wording
     * would satisfy the narrower version.
     *
     * The username field is asserted present in the same breath, so this
     * cannot pass because the editor failed to open at all — which is exactly
     * how a `queryBy*` returning null lies.
     *
     * `{ selector: "input" }` is not optional: the collapsed password row
     * further down the same card carries a button whose `aria-label` is
     * "Cambiar contraseña", so an unscoped query matches that and fails for a
     * reason that has nothing to do with this editor. What is asserted is the
     * absence of a *field*.
     */
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "usuario");

    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i, { selector: "input" })).toBeNull();
  });

  it("sends the rename with no password on the payload at all", async () => {
    /**
     * The other half, on the wire. `Object.keys` and not `toEqual`: a screen
     * that kept the state and passed `oldPass: cuenta.userPass` with an empty
     * string would put the key there, and the server would ignore it while the
     * person went on typing their password twice per rename.
     *
     * `pass` is on the payload and that is not a password anybody typed — the
     * whole loaded record is forwarded and `pass` is the stored hash, which is
     * true of every write this screen makes. What must not be there is a field
     * the form collected, so the assertion names `oldPass`.
     */
    const user = await renombrar("isalas");
    await confirmar(user);

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().user).toBe("isalas");
    expect(Object.keys(enviado())).not.toContain("oldPass");
  });

  it("saves with nothing typed but the name, which is the whole point", async () => {
    // This used to be "does not even open the dialog when the password box was
    // left empty" — the screen refused to send a rename with no password,
    // because the server refused it too and the attempt cost one of five
    // confirmations. Neither is true now: the gate asks, once, through the
    // dialog, and the rename itself needs nothing but a name.
    //
    // Asserted through to the call and not just to the dialog: "the dialog
    // opened" would stay green for a screen whose save handler still bailed
    // out on an empty password.
    const user = await renombrar("isalas");
    await confirmar(user);

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("reports the server's refusal rather than a success", async () => {
    // A 403 from the step-up gate when the window is closed and the ceremony
    // was not completed, a 409 for a name somebody else holds, a 429 for too
    // many tries. Each is a different thing to be told, and none of them is a
    // rename that happened. The 400 and 401 this used to list were the
    // handler's own answers about `oldPass`, which it no longer compares.
    for (const respuesta of [
      { status: 403, message: "Cancelaste la confirmación de identidad, así que la operación no se realizó." },
      { status: 409, message: "El nombre de usuario ya está tomado por otra persona." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      // Unmounted by hand between rounds: the automatic cleanup only runs after
      // the whole test, and a second copy of this page on the same document
      // makes every query ambiguous.
      cleanup();
      vi.clearAllMocks();
      searchUsuario.mockResolvedValue(PERFIL_CARGADO);
      editUserName.mockResolvedValue(respuesta);

      const user = await renombrar("isalas");
      await confirmar(user);

      const { toast } = await import("sonner");
      await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
      expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message);
    }
  });

  it("leaves no typed password behind in the one editor that still has a box", async () => {
    /**
     * What survives of "keep the rename's password separate from the password
     * change's": there is one password box left on this screen, so there is
     * nothing left to confuse it with — but the reason the old test existed is
     * unchanged. A cancelled editor that kept a typed password leaves a
     * credential sitting in a detached form's state for the rest of the
     * session, and the person has no way of knowing.
     *
     * Driven the way somebody would meet it: type, leave, come back, find it
     * empty.
     */
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    await abrir(user, "password");
    await user.type(screen.getByLabelText(/contraseña actual/i), "para-el-cambio-de-clave");
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    await abrir(user, "password");
    expect((screen.getByLabelText(/contraseña actual/i) as HTMLInputElement).value).toBe("");
  });

  it("does not wipe an open editor when the photo is saved from the header", async () => {
    // The one path where two things happen at once on this page: the camera
    // button sits in the header and works whichever editor is open, so saving a
    // photo folds a new `image` into the loaded record while somebody is halfway
    // through typing something else. A screen that re-seeded its forms from that
    // record would put their boxes back to what the server has — the address
    // just typed reverting, with no error and nothing to blame.
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await esperarCarga();
    await abrir(user, "email");

    const campo = screen.getByLabelText("Dirección de correo") as HTMLInputElement;
    await user.clear(campo);
    await user.type(campo, "nueva@osefi.net");

    // Reached through the DOM rather than a label: the input is deliberately
    // `aria-hidden` and out of the tab order, because the camera button is the
    // control and this is only its mechanism.
    const fichero = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fichero, new File(["una-foto"], "foto.png", { type: "image/png" }));

    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    expect((editUsuario.mock.calls[0][0] as UsuarioInterface).image).toBe("/uploads/una-foto.jpg");
    expect((screen.getByLabelText("Dirección de correo") as HTMLInputElement).value).toBe("nueva@osefi.net");
  });

  it("asks before throwing away what was typed in another editor", async () => {
    // The other half of "one editor at a time": switching away from a dirty one
    // must not be silent. Without this, a half-typed rename disappears the
    // moment somebody clicks the password row to check something.
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    await abrir(user, "usuario");
    const campoUsuario = screen.getByLabelText("Usuario");
    await user.clear(campoUsuario);
    await user.type(campoUsuario, "a-medio-escribir");
    await user.click(screen.getByRole("button", { name: ABRE.password }));

    // Still on the rename, and asking.
    expect(await screen.findByRole("button", { name: /sí, descartar/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sí, descartar/i }));
    expect(await screen.findByLabelText(/contraseña actual/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Usuario")).toBeNull();
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
    await esperarCarga();

    expect(await screen.findByText("Sin configurar")).toBeInTheDocument();
    expect(screen.queryByText("Sin verificar")).toBeNull();
    expect(screen.queryByText("Verificado")).toBeNull();
  });

  it("reads 'Sin verificar', with the warning that it cannot recover the account yet, when the address was saved but never confirmed", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    render(<Harness />);
    await esperarCarga();

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
    await esperarCarga();

    expect(await screen.findByText("Verificado")).toBeInTheDocument();
    expect(screen.queryByText("Sin verificar")).toBeNull();
    expect(screen.queryByText("Sin configurar")).toBeNull();
    expect(screen.queryByText(/no sirve para recuperar tu cuenta/i)).toBeNull();
  });

  it("pre-fills the address box with whatever is already on file, unverified or not", async () => {
    // So resending to the same address is retyping a password, not the address.
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "email");

    expect((screen.getByLabelText("Dirección de correo") as HTMLInputElement).value).toBe("isaias@osefi.net");
  });
});

describe("sending a verification email", () => {
  /** Open the recovery-address editor, fill the address in and press its submit. */
  async function intentarEnviar(email: string) {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "email");

    const campoEmail = screen.getByLabelText("Dirección de correo") as HTMLInputElement;
    await user.clear(campoEmail);
    if (email) await user.type(campoEmail, email);
    await user.click(screen.getByRole("button", { name: /verificar correo|reenviar verificación|guardar y verificar/i }));
    return user;
  }

  it("asks for an address and nothing else - no password box in this editor either", async () => {
    // The second of the two boxes this task removes. Same reasoning as the
    // rename: `POST /auth/email/send` sits behind the step-up gate, which asks
    // for the password itself and reads a field of its own, so a box here is
    // one secret typed twice for one operation.
    //
    // Queried for any password field rather than for the label that used to be
    // here, and the address field asserted present in the same breath, so this
    // cannot pass on an editor that never opened.
    //
    // `{ selector: "input" }` for the same reason as the rename's twin test
    // above: the collapsed password row on this card carries a button whose
    // `aria-label` is "Cambiar contraseña", and an unscoped query matches
    // that instead. What is asserted here is the absence of a *field*.
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "email");

    expect(screen.getByLabelText("Dirección de correo")).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i, { selector: "input" })).toBeNull();
  });

  it("does not even open the confirmation dialog with no address at all", async () => {
    await intentarEnviar("");

    expect(screen.queryByRole("button", { name: /sí, enviar/i })).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("does not open the dialog for a string that is not shaped like an address", async () => {
    await intentarEnviar("esto-no-es-un-correo");

    expect(screen.queryByRole("button", { name: /sí, enviar/i })).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends the trimmed address, and only the address", async () => {
    // `toHaveBeenCalledWith` with a single argument fails against a call
    // carrying a second one, which is what makes this the wire-level half of
    // the test above: a screen that kept the state and passed an empty
    // password would be caught here even though its editor looked right.
    const user = await intentarEnviar("  nueva@osefi.net  ");
    await user.click(await screen.findByRole("button", { name: /sí, enviar/i }));

    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    expect(sendVerificationEmail).toHaveBeenCalledWith("nueva@osefi.net");

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    // A send that worked closes the editor, so the box is read back by
    // reopening it. The address survives, because resending should not mean
    // retyping it.
    await abrir(user, "email");
    expect((screen.getByLabelText("Dirección de correo") as HTMLInputElement).value).toBe("nueva@osefi.net");
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
    const user = await intentarEnviar("nueva@osefi.net");
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

      const user = await intentarEnviar("nueva@osefi.net");
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
    await esperarCarga();

    expect(verifyEmailToken).not.toHaveBeenCalled();
  });
});
