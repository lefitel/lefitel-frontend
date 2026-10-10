// The profile page changes the credentials of the account it belongs to, each
// from a small dialog of its own, and what these tests hold is **what leaves
// the browser**, not what a toast said: a screen that quietly puts a password
// back on a payload looks identical from the outside, and the server would
// simply ignore it.
//
// **The history behind the payloads.** This screen once renamed the account
// having asked for nothing at all, while `UsuarioDetallePage` asked for a
// password to do the same thing through the same endpoint — so the confirmation
// was optional in practice, and a username is half of the credential: change
// somebody's and they cannot log in, not because they forgot their password but
// because they no longer know what name to offer it with. The demand then moved
// to the step-up gate in front of these routes, which asks for the password
// once and then stops asking for ten minutes, and asks for a *factor* instead
// from an account that has one. With a form still collecting a password of its
// own, renaming yourself meant typing the same secret twice for one request.
// That double prompt is what these tests keep from coming back: the rename and
// the recovery address send no password, and the password change sends the one
// that was typed.
//
// **No confirmation dialog on any of them.** Each used to be followed by an
// "are you sure?"; what it said is now in the dialog's own description, before
// the button is pressed, and the tests below hold that pressing the button is
// the whole gesture.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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
const listCredentials = vi.fn();
const getRecoveryCodesRemaining = vi.fn();

vi.mock("../../../api/Usuario.api", () => ({
  editUserName: (...args: unknown[]) => editUserName(...args),
  editUsuario: (...args: unknown[]) => editUsuario(...args),
  editUserPass: (...args: unknown[]) => editUserPass(...args),
  searchUsuario: (...args: unknown[]) => searchUsuario(...args),
}));
// `loginUsuario` is named and throwing: this screen must not reach the auth API
// to log anybody in, whatever it is asked to change.
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
// The calls this page makes for context rather than for its own job. They are
// mocked to resolve empty and left that way unless a test is about them: the
// sections they feed render nothing on an empty list, which keeps the queries
// below about the dialogs and not about whatever a fixture happened to contain.
vi.mock("../../../api/Bitacora.api", () => ({
  getBitacora: (...args: unknown[]) => getBitacora(...args),
}));
vi.mock("../../../api/Evento.api", () => ({
  getEvento_usuario: (...args: unknown[]) => getEvento_usuario(...args),
}));
vi.mock("../../../api/Upload.api", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
}));
// The second-factor rows of "Acceso y seguridad" load their own status on
// mount: how many passkeys, how many recovery codes are left. Only those two
// reads are replaced — the rest of each module is the real one, and none of it
// runs unless a test presses a button inside a row.
vi.mock("../../../api/Webauthn.api", async (original) => ({
  ...(await original<typeof import("../../../api/Webauthn.api")>()),
  listCredentials: (...args: unknown[]) => listCredentials(...args),
}));
vi.mock("../../../api/Mfa.api", async (original) => ({
  ...(await original<typeof import("../../../api/Mfa.api")>()),
  getRecoveryCodesRemaining: (...args: unknown[]) => getRecoveryCodesRemaining(...args),
}));
// jsdom has no WebAuthn, and the register button only exists where it does.
vi.mock("../../../api/passkeyCeremony", () => ({
  soportaPasskeys: () => true,
  cancelarCeremonia: () => {},
  registrarPasskey: () => {
    throw new Error("ningún test de esta pantalla registra una llave");
  },
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
 * The heading in the header, not a form field: every field lives in a dialog
 * that opens on demand, so there is nothing to look for until one is opened.
 * The name is the first thing that exists once the record arrives.
 */
const esperarCarga = () => screen.findByRole("heading", { name: /isaias\s+salas/i });

/**
 * The buttons that open a dialog (or unfold the passkeys panel), by the
 * `aria-label` they carry. They are named by it and not by their visible
 * "Cambiar": three buttons all reading "Cambiar" would be ambiguous here and
 * useless to a screen reader.
 */
const ABRE = {
  personal: /^editar$/i,
  usuario: /^cambiar nombre de usuario$/i,
  password: /^cambiar contraseña$/i,
  // "Cambiar" with an address on file, "Añadir" without: one row, one button.
  correo: /^(cambiar|añadir) correo de recuperación$/i,
  llave: /^gestionar llaves de acceso$/i,
} as const;

/** The title each dialog is named by. */
const DIALOGO = {
  personal: /^información personal$/i,
  usuario: /^cambiar nombre de usuario$/i,
  password: /^cambiar contraseña$/i,
  correo: /^correo de recuperación$/i,
} as const;

type Usuario = ReturnType<typeof userEvent.setup>;

/** Press the button that opens a dialog and return the dialog, ready to query. */
async function abrir(user: Usuario, cual: keyof typeof DIALOGO) {
  await user.click(screen.getByRole("button", { name: ABRE[cual] }));
  return within(await screen.findByRole("dialog", { name: DIALOGO[cual] }));
}

/** Replace what a field holds with `texto`. */
async function escribir(user: Usuario, campo: HTMLElement, texto: string) {
  await user.clear(campo);
  if (texto) await user.type(campo, texto);
}

const guardar = (user: Usuario, dlg: ReturnType<typeof within>, nombre = /^guardar$/i) =>
  user.click(dlg.getByRole("button", { name: nombre }));

/**
 * Open the rename dialog, type a new username and press save.
 *
 * Driven through the real controls: the thing being asserted is what the screen
 * sends given what somebody typed, and the dialog is part of that path — the
 * field does not exist until it is opened.
 */
async function renombrar(nuevo: string) {
  const user = userEvent.setup();
  render(<Harness />);
  await esperarCarga();
  const dlg = await abrir(user, "usuario");

  await escribir(user, dlg.getByLabelText(/^usuario/i), nuevo);
  await guardar(user, dlg);
  return { user, dlg };
}

/** The single object `editUserName` was called with. */
const enviado = () => editUserName.mock.calls[0][0] as UsuarioInterface & { oldPass?: string };

beforeEach(() => {
  vi.clearAllMocks();
  // The context calls, empty. Their sections then render nothing, which is
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
  listCredentials.mockResolvedValue({ status: 200, credenciales: [] });
  getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 0 });
  // The hash-verification effect reads this on every mount. Left over from a
  // previous test, it would fire `verifyEmailToken` in tests that have
  // nothing to do with it — the true reset belongs here, not scattered across
  // whichever `describe` block happens to set it.
  window.location.hash = "";
});

/**
 * When the profile itself does not arrive.
 *
 * It used to draw the cards empty, with a banner claiming there was no recovery
 * address — a statement about an account the page knew nothing about. Nothing
 * that depends on the record may render without it.
 */
describe("when the profile does not load", () => {
  it("says so in one card, with a retry, and draws nothing that needs the record", async () => {
    searchUsuario.mockRejectedValue(new Error("red caída"));
    render(<Harness />);

    expect(await screen.findByText("No se pudo cargar tu perfil.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    // The false banner, the cards and their buttons: all of it needs a record.
    expect(screen.queryByText(/no tienes un correo de recuperación/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ABRE.personal })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ABRE.password })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /isaias/i })).not.toBeInTheDocument();
  });

  it("asks for everything again on 'Reintentar' and draws the page when it arrives", async () => {
    searchUsuario.mockRejectedValueOnce(new Error("red caída"));
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(await screen.findByRole("button", { name: "Reintentar" }));

    await esperarCarga();
    expect(searchUsuario).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("No se pudo cargar tu perfil.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: ABRE.personal })).toBeInTheDocument();
  });

  it("keeps the failure loud only for the profile: a failed log or event list does not take the page down", async () => {
    getBitacora.mockRejectedValue(new Error("500"));
    getEvento_usuario.mockRejectedValue(new Error("500"));
    render(<Harness />);
    await esperarCarga();

    expect(screen.queryByText("No se pudo cargar tu perfil.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: ABRE.password })).toBeInTheDocument();
  });
});

describe("the events counter in the side panel", () => {
  const eventosAtendidos = () => screen.getByText("Eventos atendidos").nextElementSibling;

  it("shows the number when the events arrive", async () => {
    getEvento_usuario.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    render(<Harness />);
    await esperarCarga();

    expect(eventosAtendidos()).toHaveTextContent(/^3$/);
  });

  it("shows a dash, not a zero, when the request for them failed", async () => {
    // "We could not count" is not "this person attended none": a technician
    // with four hundred events must not be told zero by a bad connection.
    getEvento_usuario.mockRejectedValue(new Error("500"));
    render(<Harness />);
    await esperarCarga();

    expect(eventosAtendidos()).toHaveTextContent(/^—$/);
  });
});

/**
 * Personal details, which had no test at all until its editor became a dialog.
 */
describe("editing your personal details", () => {
  it("opens with what the record has", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    const dlg = await abrir(user, "personal");

    expect(dlg.getByLabelText(/^nombres/i)).toHaveValue("Isaias");
    expect(dlg.getByLabelText(/^apellidos/i)).toHaveValue("Salas");
    expect(dlg.getByLabelText(/^teléfono/i)).toHaveValue("700");
  });

  it("sends the whole record with the changed fields, and the card shows the change afterwards", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "personal");

    await escribir(user, dlg.getByLabelText(/^teléfono/i), "71234567");
    await guardar(user, dlg);

    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    const payload = editUsuario.mock.calls[0][0] as UsuarioInterface;
    expect(payload).toMatchObject({ id: YO, name: "Isaias", lastname: "Salas", phone: "71234567", birthday: "1990-01-01" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Información actualizada."));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("71234567")).toBeInTheDocument();
  });

  it("refuses an empty name or surname under its field, with no toast and no request", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "personal");

    await escribir(user, dlg.getByLabelText(/^nombres/i), "");
    await escribir(user, dlg.getByLabelText(/^apellidos/i), "");
    await guardar(user, dlg);

    // Under each field, tied to it, and nothing sent or toasted.
    const nombre = dlg.getByLabelText(/^nombres/i);
    expect(nombre).toHaveAttribute("aria-invalid", "true");
    expect(within(nombre.parentElement!).getByRole("alert")).toHaveTextContent("El nombre es obligatorio.");
    expect(dlg.getByText("Los apellidos son obligatorios.")).toBeInTheDocument();
    expect(editUsuario).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();

    // And the message goes away by itself as the field is corrected.
    await userEvent.type(nombre, "I");
    expect(nombre).not.toHaveAttribute("aria-invalid");
    expect(dlg.queryByText("El nombre es obligatorio.")).not.toBeInTheDocument();
    expect(dlg.getByText("Los apellidos son obligatorios.")).toBeInTheDocument();
  });

  it("keeps the dialog open with what was typed when the server refuses", async () => {
    editUsuario.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "personal");

    await escribir(user, dlg.getByLabelText(/^teléfono/i), "71234567");
    await guardar(user, dlg);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: DIALOGO.personal })).toBeInTheDocument();
    expect(dlg.getByLabelText(/^teléfono/i)).toHaveValue("71234567");
  });
});

/**
 * Changing your own password from this screen, which is where everybody does it.
 *
 * It always sent `oldPass`, so nothing here is a fix — it is the only thing that
 * would notice if the payload were ever tidied up, and after `updateUserPass`
 * started demanding the current password of *everybody* changing their own,
 * dropping it would answer 400 to every password change in the ERP rather than
 * only to the ones made by people without the permission.
 */
describe("changing your own password from the profile page", () => {
  async function cambiarPassword(actual: string, nueva: string, confirmacion = nueva) {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "password");

    await user.type(dlg.getByLabelText(/^contraseña actual/i), actual);
    await user.type(dlg.getByLabelText(/^nueva contraseña/i), nueva);
    await user.type(dlg.getByLabelText(/^confirmar nueva contraseña/i), confirmacion);
    await guardar(user, dlg);
    return { user, dlg };
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
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Contraseña actualizada con éxito."));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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
     * no rule at all. The rule is told under the field and not in a toast, and
     * nothing leaves the browser.
     */
    const corta = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const { dlg } = await cambiarPassword("la-mia", corta);

    expect(editUserPass).not.toHaveBeenCalled();
    const nueva = dlg.getByLabelText(/^nueva contraseña/i);
    expect(nueva).toHaveAttribute("aria-invalid", "true");
    // Matched loosely on purpose: the number belongs to `lib/password.ts`,
    // which is where it is pinned to the server's. One alert only: the footer's
    // "faltan campos" does not appear, because nothing is empty.
    expect(dlg.getByRole("alert")).toHaveTextContent(/al menos \d+ caracteres/i);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: DIALOGO.password })).toBeInTheDocument();
  });

  it("sends a password of exactly the minimum length", async () => {
    // The other direction, which nothing else here would catch: a client rule
    // stricter than the server's blocks passwords that were perfectly good.
    const laMinima = "a".repeat(PASSWORD_MIN_LENGTH);
    await cambiarPassword("la-mia", laMinima);

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect((editUserPass.mock.calls[0][0] as UsuarioInterface).pass).toBe(laMinima);
  });

  it("sends nothing when the current password box was left empty, and says so under it", async () => {
    // An empty attempt would be refused anyway, and it would spend one of the
    // five confirmations this account gets in a quarter of an hour.
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "password");

    await user.type(dlg.getByLabelText(/^nueva contraseña/i), "una-clave-de-prueba");
    await user.type(dlg.getByLabelText(/^confirmar nueva contraseña/i), "una-clave-de-prueba");
    await guardar(user, dlg);

    expect(editUserPass).not.toHaveBeenCalled();
    const actual = dlg.getByLabelText(/^contraseña actual/i);
    expect(actual).toHaveAttribute("aria-invalid", "true");
    expect(within(actual.parentElement!).getByRole("alert")).toHaveTextContent("Escribe tu contraseña actual.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("sends nothing when the confirmation does not match, and says so under it", async () => {
    const { dlg } = await cambiarPassword("la-mia", "una-clave-de-prueba", "otra-clave-distinta");

    expect(editUserPass).not.toHaveBeenCalled();
    const confirmacion = dlg.getByLabelText(/^confirmar nueva contraseña/i);
    expect(within(confirmacion.parentElement!).getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
  });

  it("is saved with a single press: no confirmation dialog stands in the way", async () => {
    await cambiarPassword("la-mia", "una-clave-de-prueba");

    await waitFor(() => expect(editUserPass).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("tells the password manager which field is which, and for which account", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "password");

    expect(dlg.getByLabelText(/^contraseña actual/i)).toHaveAttribute("autocomplete", "current-password");
    expect(dlg.getByLabelText(/^nueva contraseña/i)).toHaveAttribute("autocomplete", "new-password");
    expect(dlg.getByLabelText(/^confirmar nueva contraseña/i)).toHaveAttribute("autocomplete", "new-password");
    // The account the password belongs to, in a field nobody sees or tabs to.
    const nombre = dlg.getByDisplayValue("isaias");
    expect(nombre).toHaveAttribute("autocomplete", "username");
    expect(nombre).toHaveAttribute("readonly");
    expect(nombre).toHaveClass("sr-only");
  });

  it("says nobody, the team included, can read it — as the last thing in the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "password");

    const frase = dlg.getByText("Nadie, tampoco el equipo de Osefi, puede ver tu contraseña.");
    const ultimo = frase.closest("[class*='space-y-4']")!.lastElementChild;
    expect(ultimo).toBe(frase);
    expect(screen.queryByText(/bcrypt/i)).not.toBeInTheDocument();
  });

  it("leaves no typed password behind for the next time the dialog opens", async () => {
    /**
     * A closed dialog that kept a typed password would leave a credential
     * sitting in a detached form's state for the rest of the session, and the
     * person has no way of knowing. Driven the way somebody would meet it: type,
     * leave (the dialog asks, because it is dirty), come back, find it empty.
     */
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    const dlg = await abrir(user, "password");
    await user.type(dlg.getByLabelText(/^contraseña actual/i), "para-el-cambio-de-clave");
    await user.click(dlg.getByRole("button", { name: /^cancelar$/i }));
    await user.click(await screen.findByRole("button", { name: /^descartar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const otraVez = await abrir(user, "password");
    expect(otraVez.getByLabelText(/^contraseña actual/i)).toHaveValue("");
  });
});

describe("renaming your own account from the profile page", () => {
  it("asks for a name and nothing else — no password box in the dialog", async () => {
    /**
     * 🔴 The break-it test of this task on the client, and it is written as a
     * query for **any** password field rather than for the one label that used
     * to be here. A screen that re-grew the box under a different wording
     * would satisfy the narrower version.
     *
     * The username field is asserted present in the same breath, so this
     * cannot pass because the dialog failed to open at all — which is exactly
     * how a `queryBy*` returning null lies.
     *
     * `{ selector: "input" }` is not optional: the collapsed password row
     * behind the dialog carries a button whose `aria-label` is "Cambiar
     * contraseña", and an unscoped query matches that. What is asserted is the
     * absence of a *field*.
     */
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "usuario");

    expect(dlg.getByLabelText(/^usuario/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i, { selector: "input" })).toBeNull();
  });

  it("says in its description what changes, where the confirmation used to be", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "usuario");

    expect(
      screen.getByText("Entrarás con este nombre a partir de tu próxima sesión. Tu contraseña no cambia."),
    ).toBeInTheDocument();
  });

  it("sends the rename with no password on the payload at all", async () => {
    /**
     * The wire half. `Object.keys` and not `toEqual`: a screen that kept the
     * state and passed `oldPass: ""` would put the key there, and the server
     * would ignore it while the person went on typing their password twice per
     * rename.
     *
     * `pass` is on the payload and that is not a password anybody typed — the
     * whole loaded record is forwarded and `pass` is the stored hash, which is
     * true of every write this screen makes. What must not be there is a field
     * the form collected, so the assertion names `oldPass`.
     */
    await renombrar("isalas");

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(enviado().user).toBe("isalas");
    expect(Object.keys(enviado())).not.toContain("oldPass");
  });

  it("saves with nothing typed but the name and a single press, which is the whole point", async () => {
    // Asserted through to the call and not just to the dialog: a screen whose
    // save handler still bailed out on an empty password, or still stopped at a
    // confirmation, would never get here.
    await renombrar("isalas");

    await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nombre de usuario modificado."));
    // The row now reads the new name.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("isalas").length).toBeGreaterThan(0);
  });

  it("reports the server's refusal rather than a success, and keeps the name typed", async () => {
    // A 403 from the step-up gate when the window is closed and the ceremony
    // was not completed, a 409 for a name somebody else holds, a 429 for too
    // many tries. Each is a different thing to be told, and none of them is a
    // rename that happened.
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

      const { dlg } = await renombrar("isalas");

      await waitFor(() => expect(editUserName).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
      // Still open and still holding what was typed, to correct it.
      expect(dlg.getByLabelText(/^usuario/i)).toHaveValue("isalas");
    }
  });

  it("refuses an empty name under the field, with no toast and no request", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "usuario");

    const campo = dlg.getByLabelText(/^usuario/i);
    await escribir(user, campo, "");
    await guardar(user, dlg);

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(within(campo.parentElement!).getByRole("alert")).toHaveTextContent("El nombre de usuario no puede estar vacío.");
    expect(editUserName).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();

    // Clears as the field is corrected, before any new attempt.
    await user.type(campo, "x");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(within(campo.parentElement!).queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("a dialog with something typed in it", () => {
  it("does not wipe an open dialog when a photo finishes saving behind it", async () => {
    // The one path where two things happen at once on this page: the camera
    // button sits in the header, so a photo whose upload is still in flight can
    // finish — and fold a new `image` into the loaded record — while somebody
    // has opened a dialog and is halfway through typing. A dialog that re-seeded
    // from that record would put its box back to what the server has: the
    // address just typed reverting, with no error and nothing to blame.
    let terminarSubida: (r: { ok: true; path: string }) => void = () => {};
    uploadImage.mockReturnValue(new Promise((resolve) => { terminarSubida = resolve; }));
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await esperarCarga();

    // Reached through the DOM rather than a label: the input is deliberately
    // `aria-hidden` and out of the tab order, because the camera button is the
    // control and this is only its mechanism.
    const fichero = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fichero, new File(["una-foto"], "foto.png", { type: "image/png" }));
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));

    const dlg = await abrir(user, "correo");
    await user.type(dlg.getByLabelText(/^dirección de correo/i), "nueva@osefi.net");

    terminarSubida({ ok: true, path: "/uploads/una-foto.jpg" });
    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    expect((editUsuario.mock.calls[0][0] as UsuarioInterface).image).toBe("/uploads/una-foto.jpg");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Foto actualizada."));

    expect(dlg.getByLabelText(/^dirección de correo/i)).toHaveValue("nueva@osefi.net");
  });

  it("asks before closing, and keeps the draft if the person keeps editing", async () => {
    // `FormDialog` has its own tests for the prompt; this holds that the
    // profile's dialogs hand it the right `dirty`, so a half-typed rename does
    // not disappear on a stray Escape or click outside.
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "usuario");

    await escribir(user, dlg.getByLabelText(/^usuario/i), "a-medio-escribir");
    await user.click(dlg.getByRole("button", { name: /^cancelar$/i }));

    expect(await screen.findByText("¿Descartar los cambios?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /seguir editando/i }));
    expect(dlg.getByLabelText(/^usuario/i)).toHaveValue("a-medio-escribir");

    await user.click(dlg.getByRole("button", { name: /^cancelar$/i }));
    await user.click(await screen.findByRole("button", { name: /^descartar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(editUserName).not.toHaveBeenCalled();
  });

  it("closes without asking when nothing was changed, and opens again from the record, not the abandoned draft", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    let dlg = await abrir(user, "usuario");
    await user.click(dlg.getByRole("button", { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();

    dlg = await abrir(user, "usuario");
    await escribir(user, dlg.getByLabelText(/^usuario/i), "abandonado");
    await user.click(dlg.getByRole("button", { name: /^cancelar$/i }));
    await user.click(await screen.findByRole("button", { name: /^descartar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dlg = await abrir(user, "usuario");
    expect(dlg.getByLabelText(/^usuario/i)).toHaveValue("isaias");
  });
});

/**
 * The recovery email, Task 8 of `2026-08-25-correo-verificado-y-recuperacion`.
 *
 * The acceptance criterion that actually matters here is not "the form
 * submits" — it is that the three states (no address, saved-but-unverified,
 * verified) read as three different things without anyone having to study the
 * card. A saved-but-unverified address is exactly as useless as none at all,
 * because `/password/forgot` refuses to act on one — so the tests below
 * assert on the visible badge text and the warning, not on internal state, the
 * same way a person reading the screen would tell the states apart.
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
    expect(screen.queryByRole("button", { name: "Añadir correo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reenviar enlace" })).toBeNull();
  });

  it("pre-fills the address box with whatever is already on file, unverified or not", async () => {
    // So resending to the same address is pressing a button, not retyping it.
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "correo");

    expect(dlg.getByLabelText(/^dirección de correo/i)).toHaveValue("isaias@osefi.net");
  });
});

/**
 * One warning, the full-width banner, and it says what the next step is. The
 * address row below carries a badge but no second alert.
 */
describe("the recovery-address banner", () => {
  it("with no address, says there is no way back in and offers to add one", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: null, email_verified_at: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    expect(
      screen.getByText("No tienes un correo de recuperación. Si olvidas tu contraseña, no habrá forma de volver a entrar."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Añadir correo" }));

    const dlg = within(await screen.findByRole("dialog", { name: DIALOGO.correo }));
    expect(dlg.getByLabelText(/^dirección de correo/i)).toHaveValue("");
  });

  it("with an unverified address, names it, says to open the link, and offers to resend", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    expect(
      screen.getByText(
        "Te enviamos un enlace a isaias@osefi.net. Ábrelo desde tu correo para confirmarla; hasta entonces no sirve para recuperar tu cuenta.",
      ),
    ).toBeInTheDocument();
    // The old banner's wording for this state is gone.
    expect(screen.queryByText(/todavía no confirmaste esta dirección/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    const dlg = within(await screen.findByRole("dialog", { name: DIALOGO.correo }));
    expect(dlg.getByLabelText(/^dirección de correo/i)).toHaveValue("isaias@osefi.net");
  });

  it("goes away when the link in the address bar verifies the address", async () => {
    // The verification and the record are two requests that start together and
    // finish in either order; whichever order, the page must end up saying
    // verified.
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    window.location.hash = "#verify_email=un-token-opaco";
    render(<Harness />);
    await esperarCarga();

    await waitFor(() => expect(screen.queryByText(/no sirve para recuperar tu cuenta/i)).not.toBeInTheDocument());
    expect(screen.getByText("Verificado")).toBeInTheDocument();
  });
});

describe("sending a verification email", () => {
  /** Open the recovery-address dialog, fill the address in and press its submit. */
  async function intentarEnviar(email: string) {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "correo");

    await escribir(user, dlg.getByLabelText(/^dirección de correo/i), email);
    await user.click(dlg.getByRole("button", { name: /enviar enlace|reenviar enlace/i }));
    return { user, dlg };
  }

  it("asks for an address and nothing else - no password box in this dialog either", async () => {
    // `POST /auth/email/send` sits behind the step-up gate, which asks for the
    // password itself and reads a field of its own, so a box here is one secret
    // typed twice for one operation.
    //
    // Queried for any password field rather than for a label, and the address
    // field asserted present in the same breath, so this cannot pass on a
    // dialog that never opened. `{ selector: "input" }` for the same reason as
    // the rename's twin test.
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "correo");

    expect(dlg.getByLabelText(/^dirección de correo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i, { selector: "input" })).toBeNull();
  });

  it("says what the link does, where the confirmation used to be", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "correo");

    expect(
      screen.getByText(/te enviaremos un enlace; hasta que lo abras, la dirección no sirve para recuperar tu cuenta\./i),
    ).toBeInTheDocument();
    // No address on file, so nothing is about to be un-verified.
    expect(screen.queryByText(/ya verificada, quedará sin verificar/i)).not.toBeInTheDocument();
  });

  it("warns that a verified address goes back to unverified until the new one is confirmed", async () => {
    searchUsuario.mockResolvedValue({
      ...PERFIL_CARGADO,
      email: "isaias@osefi.net",
      email_verified_at: "2026-08-20T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await abrir(user, "correo");

    expect(
      screen.getByText(
        /tu dirección actual, ya verificada, quedará sin verificar hasta que confirmes la nueva, y avisaremos a esa misma casilla del cambio\./i,
      ),
    ).toBeInTheDocument();
  });

  it("reads 'Enviar enlace' for a new address and 'Reenviar enlace' only for the unverified one on file", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "isaias@osefi.net", email_verified_at: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    const dlg = await abrir(user, "correo");

    expect(dlg.getByRole("button", { name: "Reenviar enlace" })).toBeInTheDocument();
    await escribir(user, dlg.getByLabelText(/^dirección de correo/i), "otra@osefi.net");
    expect(dlg.getByRole("button", { name: "Enviar enlace" })).toBeInTheDocument();
    expect(dlg.queryByRole("button", { name: "Reenviar enlace" })).not.toBeInTheDocument();
  });

  it("refuses an empty address under the field, with no request", async () => {
    const { dlg } = await intentarEnviar("");

    expect(sendVerificationEmail).not.toHaveBeenCalled();
    const campo = dlg.getByLabelText(/^dirección de correo/i);
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(within(campo.parentElement!).getByRole("alert")).toHaveTextContent("Debes indicar una dirección de correo.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("refuses a string that is not shaped like an address, under the field, with no request", async () => {
    const { dlg } = await intentarEnviar("esto-no-es-un-correo");

    expect(sendVerificationEmail).not.toHaveBeenCalled();
    const campo = dlg.getByLabelText(/^dirección de correo/i);
    expect(within(campo.parentElement!).getByRole("alert")).toHaveTextContent("Debes indicar una dirección de correo válida.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("sends the trimmed address, and only the address, with a single press", async () => {
    // `toHaveBeenCalledWith` with a single argument fails against a call
    // carrying a second one, which is what makes this the wire-level half of
    // the test above: a screen that kept the state and passed an empty
    // password would be caught here even though its dialog looked right.
    const { user } = await intentarEnviar("  nueva@osefi.net  ");

    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    expect(sendVerificationEmail).toHaveBeenCalledWith("nueva@osefi.net");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // The row now shows the address as sent, unverified, and opening the dialog
    // again starts from it: resending should not mean retyping.
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
    const otraVez = await abrir(user, "correo");
    expect(otraVez.getByLabelText(/^dirección de correo/i)).toHaveValue("nueva@osefi.net");
  });

  it("turns a 429 into a plain-language wait-and-retry message, whichever limiter actually fired", async () => {
    // The known trap this pair of calls sits on: three different rate-limit
    // buckets can answer this one request (`passwordConfirmLimiter`,
    // `emailSendLimiter` — see `auth.routes.ts`), each with its own wording,
    // and none of it says "wait" as plainly as this screen needs to. The
    // assertion is on the screen's own sentence, not on whichever the mock
    // happens to send back.
    sendVerificationEmail.mockResolvedValue({
      status: 429,
      message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar.",
    });
    await intentarEnviar("nueva@osefi.net");

    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/demasiados correos/i)));
    expect(toast.success).not.toHaveBeenCalled();
    // Refused, so the dialog stays for another try.
    expect(screen.getByRole("dialog", { name: DIALOGO.correo })).toBeInTheDocument();
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

      await intentarEnviar("nueva@osefi.net");

      await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(toast.error, JSON.stringify(respuesta)).toHaveBeenCalledWith(respuesta.message));
      expect(toast.success, JSON.stringify(respuesta)).not.toHaveBeenCalled();
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
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("clears the fragment even when the token is refused, so a dead link never lingers in the address bar", async () => {
    window.location.hash = "#verify_email=un-token-caducado";
    verifyEmailToken.mockResolvedValue({ status: 400, message: "Este enlace ya no es válido. Solicite uno nuevo." });

    render(<Harness />);

    await waitFor(() => expect(verifyEmailToken).toHaveBeenCalledWith("un-token-caducado"));
    expect(window.location.hash).toBe("");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este enlace ya no es válido. Solicite uno nuevo."));
  });

  it("does nothing when the page was opened with no token in the address", async () => {
    window.location.hash = "";

    render(<Harness />);
    await esperarCarga();

    expect(verifyEmailToken).not.toHaveBeenCalled();
  });
});

/**
 * Passkeys, the authenticator app and the recovery codes, inside the access card.
 *
 * They used to be a link to `/app/segundo-factor`, and the complaint that moved
 * them was exact: the option was not on the profile, a button to another page
 * was. So the first thing held here is that there is no such link any more. The
 * app and the codes carry their buttons on the row itself; only the passkeys,
 * which hold a list, unfold a panel. What is typed in any of them is typed in a
 * dialog — a form sitting inside the card was the second complaint.
 */
describe("the second-factor rows of the access card", () => {
  it("shows each one's state on the profile itself, with no link to another screen", async () => {
    listCredentials.mockResolvedValue({
      status: 200,
      credenciales: [
        { id: 1, nombre: "mi móvil", created_at: "2026-09-01T10:00:00.000Z", last_used_at: null },
        { id: 2, nombre: "el portátil", created_at: "2026-09-02T10:00:00.000Z", last_used_at: null },
      ],
    });
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 8 });

    render(<Harness />);
    await esperarCarga();

    expect(await screen.findByText("2 registradas")).toBeInTheDocument();
    // Twice, and they agree: once on the row and once on the summary panel,
    // which shows the row's own count.
    await waitFor(() => expect(screen.getAllByText("8 de 10 sin usar")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Configurar aplicación de autenticación" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /segundo factor/i })).not.toBeInTheDocument();
  });

  it("gives the app and the codes their buttons on the row, with no 'Gestionar' for them", async () => {
    render(<Harness />);
    await esperarCarga();
    await screen.findByText("Sin códigos disponibles");

    expect(screen.getByRole("button", { name: "Quitar aplicación de autenticación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar aplicación de autenticación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar códigos de recuperación nuevos" })).toBeInTheDocument();
    // The one 'Gestionar' left is the passkeys', which has a list to open.
    expect(screen.getAllByRole("button", { name: /gestionar/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: ABRE.llave })).toBeInTheDocument();
  });

  it("opens the confirmation for new recovery codes straight from the row", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await screen.findByText("Sin códigos disponibles");

    await user.click(screen.getByRole("button", { name: "Generar códigos de recuperación nuevos" }));

    expect(await screen.findByText("¿Generar diez códigos nuevos?")).toBeInTheDocument();
  });

  it("says the codes could not be counted, with a retry, instead of a skeleton for ever", async () => {
    getRecoveryCodesRemaining.mockResolvedValueOnce({ status: 500, restantes: null });
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    expect(await screen.findByText("No se pudo cargar")).toBeInTheDocument();
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 4 });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getAllByText("4 de 10 sin usar")).toHaveLength(2));
  });

  it("unfolds the passkeys panel in place, with the way to add a key in its header", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();

    await user.click(screen.getByRole("button", { name: ABRE.llave }));

    const panel = screen.getByRole("region", { name: "Llaves de acceso" });
    expect(within(panel).getByRole("button", { name: /añadir llave/i })).toBeInTheDocument();
    expect(within(panel).queryByRole("heading", { name: "Tus llaves" })).not.toBeInTheDocument();
    // Nothing to type in the card itself: the form is a dialog.
    expect(screen.queryByLabelText(/nombre de la llave/i)).not.toBeInTheDocument();
  });

  it("registers a key from a dialog, with a name already in it", async () => {
    // jsdom's own user agent names no browser this application recognises.
    const agente = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    );
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await user.click(screen.getByRole("button", { name: ABRE.llave }));

    await user.click(screen.getByRole("button", { name: /añadir llave/i }));

    const dialogo = await screen.findByRole("dialog", { name: /añadir una llave de acceso/i });
    const nombre = within(dialogo).getByLabelText(/nombre de la llave/i);
    // Read from the browser, so the required field does not arrive blank.
    expect(nombre).toHaveValue("Chrome en Windows");
    // And editable — a suggestion, not a label.
    await user.clear(nombre);
    await user.type(nombre, "el del trabajo");
    expect(nombre).toHaveValue("el del trabajo");
    agente.mockRestore();
  });

  it("asks before the dialog throws away what was typed, and leaves nothing behind when it does", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await user.click(screen.getByRole("button", { name: ABRE.llave }));
    await user.click(screen.getByRole("button", { name: /añadir llave/i }));
    // jsdom's user agent names no browser, so the name arrives empty and
    // anything typed is a change.
    await user.type(await screen.findByLabelText(/nombre de la llave/i), "el del trabajo");

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    const descartar = await screen.findByRole("button", { name: /^descartar$/i });
    expect(screen.getByLabelText(/nombre de la llave/i)).toHaveValue("el del trabajo");
    await user.click(descartar);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Opened again, the name box is empty: the one typed was not kept.
    await user.click(screen.getByRole("button", { name: /añadir llave/i }));
    expect(await screen.findByLabelText(/nombre de la llave/i)).toHaveValue("");
  });

  it("folds the passkeys panel away with 'Cerrar'", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await esperarCarga();
    await user.click(screen.getByRole("button", { name: ABRE.llave }));

    await user.click(screen.getByRole("button", { name: /^cerrar$/i }));

    expect(screen.getByRole("button", { name: ABRE.llave })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Llaves de acceso" })).not.toBeInTheDocument();
  });
});

/**
 * The summary panel on the right, in the shape Isaias chose from a mock-up on
 * 2026-10-10: it talks about what protects the account and nothing else.
 *
 * The counts it shows are the access card's own — the rows load them and report
 * up — so what is held here is that the two cannot disagree, and that the
 * panel's one button reaches the one dialog that does the job.
 */
describe("the security summary panel", () => {
  const panel = () => screen.getByRole("heading", { name: /seguridad de tu cuenta/i }).parentElement as HTMLElement;

  it("says the address is missing, and offers no second button for it — the banner has the one", async () => {
    render(<Harness />);
    await esperarCarga();

    expect(within(panel()).getByText("Falta verificar tu correo")).toBeInTheDocument();
    expect(within(panel()).queryByRole("button")).not.toBeInTheDocument();
    // The old ring and its optional items are gone from here.
    expect(screen.queryByText(/completado/i)).not.toBeInTheDocument();
    expect(within(panel()).queryByText(/fecha de nacimiento/i)).not.toBeInTheDocument();
  });

  it("counts the passkeys and the codes the access card loaded, and says the account is protected", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "yo@osefi.net", email_verified_at: "2026-09-01T10:00:00.000Z" });
    listCredentials.mockResolvedValue({
      status: 200,
      credenciales: [{ id: 1, nombre: "mi móvil", created_at: "2026-09-01T10:00:00.000Z", last_used_at: null }],
    });
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 8 });

    render(<Harness />);
    await esperarCarga();

    expect(await within(panel()).findByText("1 llave de acceso")).toBeInTheDocument();
    expect(await within(panel()).findByText("8 de 10 sin usar")).toBeInTheDocument();
    expect(within(panel()).getByText("Tu cuenta está protegida")).toBeInTheDocument();
    expect(within(panel()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("warns when few codes are left, and its 'Generar' opens the same confirmation as the row", async () => {
    searchUsuario.mockResolvedValue({ ...PERFIL_CARGADO, email: "yo@osefi.net", email_verified_at: "2026-09-01T10:00:00.000Z" });
    getRecoveryCodesRemaining.mockResolvedValue({ status: 200, restantes: 2 });
    const user = userEvent.setup();

    render(<Harness />);
    await esperarCarga();

    expect(await within(panel()).findByText("Te quedan pocos códigos")).toBeInTheDocument();
    // With a verified address and no key, the second step is the emailed code.
    expect(within(panel()).getByText("Código por correo")).toBeInTheDocument();
    await user.click(within(panel()).getByRole("button", { name: /generar códigos de recuperación desde el resumen/i }));

    expect(await screen.findByRole("alertdialog", { name: /generar diez códigos nuevos/i })).toBeInTheDocument();
  });

  it("keeps the codes out of it for an account with nothing to fall back from", async () => {
    render(<Harness />);
    await esperarCarga();

    await waitFor(() => expect(getRecoveryCodesRemaining).toHaveBeenCalled());
    expect(within(panel()).queryByText(/códigos de recuperación/i)).not.toBeInTheDocument();
    expect(within(panel()).getByText(/opcional/i)).toBeInTheDocument();
  });
});
