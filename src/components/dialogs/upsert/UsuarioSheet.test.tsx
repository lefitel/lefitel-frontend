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
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { UsuarioInterface } from "../../../interfaces/interfaces";
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";
import { olvidarPermisos, setPermisos, sinPermisos } from "../../../lib/permissions";

const createUsuario = vi.fn();
const editUsuario = vi.fn();
const searchUsuario_user = vi.fn();
const asignarRol = vi.fn();

vi.mock("../../../api/Usuario.api", () => ({
  createUsuario: (...args: unknown[]) => createUsuario(...args),
  editUsuario: (...args: unknown[]) => editUsuario(...args),
  searchUsuario_user: (...args: unknown[]) => searchUsuario_user(...args),
  asignarRol: (...args: unknown[]) => asignarRol(...args),
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

/** The role of whoever is using the sheet, and what it may do with roles. */
const ROL_SESION = 2;
function puedeConRoles({ ver = true, editar = true } = {}) {
  const p = sinPermisos();
  p.roles.ver = ver;
  p.roles.editar = editar;
  setPermisos(ROL_SESION, p);
}
const conSesion = (hoja: React.ReactNode, id = 99) => (
  <SesionContext.Provider value={{ sesion: { usuario: { id, id_rol: ROL_SESION } } } as unknown as contextProps}>
    {hoja}
  </SesionContext.Provider>
);

beforeEach(() => {
  vi.clearAllMocks();
  // Listing the roles and handing one out are permissions of their own; the
  // sheet only offers the role to somebody who holds both. Granted here so the
  // tests about everything else see the form an administrator sees.
  olvidarPermisos();
  puedeConRoles();
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
  render(conSesion(<UsuarioSheet open setOpen={vi.fn()} onSuccess={vi.fn()} />));

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
  const abrir = () => render(conSesion(<UsuarioSheet open setOpen={vi.fn()} onSuccess={vi.fn()} />));

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

/**
 * Changing somebody's role, which this sheet stopped being able to do without
 * anybody noticing.
 *
 * `id_rol` came off `PUT /api/usuario/:id`'s allowlist and moved to a
 * sub-resource of its own, `PUT /api/usuario/:id/rol`. This sheet was never
 * told: it went on putting the role inside the profile save, the server
 * discarded the field it no longer accepts, wrote the rest and answered 200 —
 * so the toast said "Usuario actualizado", the table reloaded, and the role was
 * the one it had been before. The only way to hand out authority from the ERP
 * agreed and did nothing, and it did so **only for the people allowed to do
 * it**: somebody without `roles.editar` still got a 403 with a sentence.
 *
 * Saving an edit is therefore two requests now, and what these pin is the order
 * and what is said when only one of them lands. The role goes first because it
 * is the interruptible one — that route asks for the password on every attempt,
 * so the reauthentication dialog opens every time and can be cancelled. First
 * means the cancellation finds nothing written.
 */
describe("el rol, que ya no viaja dentro del perfil", () => {
  const YO = 7;
  const OTRA_PERSONA = 99;
  const COORDINADOR = 3;
  const ADMINISTRADOR = 5;

  const cuenta = (id: number, id_rol = COORDINADOR): UsuarioInterface => ({
    id,
    name: "Ada",
    lastname: "Lovelace",
    birthday: new Date("1990-01-01"),
    image: "",
    phone: "700",
    user: "ada",
    pass: "",
    id_rol,
  });

  /** The sheet in edit mode, and who is doing the editing. */
  const abrir = (usuario: UsuarioInterface, quienEdita = YO) => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const onSuccess = vi.fn();
    render(
      <SesionContext.Provider
        value={{ sesion: { usuario: { id: quienEdita, id_rol: ROL_SESION } } } as unknown as contextProps}
      >
        <UsuarioSheet usuario={usuario} open setOpen={setOpen} onSuccess={onSuccess} />
      </SesionContext.Provider>,
    );
    return { user, setOpen, onSuccess };
  };

  const guardar = () => screen.getByRole("button", { name: /^guardar/i });

  beforeEach(() => {
    getRol.mockResolvedValue([
      { id: COORDINADOR, name: "Coordinador", description: "" },
      { id: ADMINISTRADOR, name: "Administrador", description: "" },
    ]);
    asignarRol.mockResolvedValue({ status: 204 });
    editUsuario.mockResolvedValue({});
  });

  it("abre aunque haya un rol sin nombre, y lo lista diciendo cuál es", async () => {
    // The row that took the screen down: a role saved with no name. Typed
    // against the interface because that is how it arrives — the server sends
    // what the column holds.
    getRol.mockResolvedValue([
      { id: COORDINADOR, name: "Coordinador", description: "" },
      { id: 7, name: null as unknown as string, description: "" },
    ]);
    const { user } = abrir(cuenta(OTRA_PERSONA));

    await user.click(await screen.findByText("Coordinador"));

    expect(await screen.findByText("Rol sin nombre (#7)")).toBeInTheDocument();
  });

  it("lo manda a su propia ruta, y antes que el resto del perfil", async () => {
    // The order, recorded rather than inferred. Both calls happening is not the
    // property: which one goes first decides what a cancelled dialog leaves
    // behind.
    const orden: string[] = [];
    asignarRol.mockImplementation(async () => { orden.push("rol"); return { status: 204 }; });
    editUsuario.mockImplementation(async () => { orden.push("perfil"); return {}; });

    const { user, setOpen, onSuccess } = abrir(cuenta(OTRA_PERSONA));

    await user.click(await screen.findByText("Coordinador"));
    await user.click(await screen.findByText("Administrador"));
    await user.click(guardar());

    await waitFor(() => expect(asignarRol).toHaveBeenCalledWith(OTRA_PERSONA, ADMINISTRADOR));
    expect(orden).toEqual(["rol", "perfil"]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Usuario actualizado"));
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("no lo manda cuando el rol no ha cambiado", async () => {
    // Not an optimisation. That route asks for the password on every request,
    // so posting the role alongside every save would open the reauthentication
    // dialog on somebody correcting a telephone number — which is the prompt
    // this whole piece of work exists to remove.
    const { user } = abrir(cuenta(OTRA_PERSONA));

    await user.type(screen.getByLabelText(/^Teléfono/), "1");
    await user.click(guardar());

    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    expect(asignarRol).not.toHaveBeenCalled();
  });

  it("si el rol se rechaza, no guarda nada más y no dice que se actualizó", async () => {
    // Cancelling the dialog is the everyday case, and it arrives here as a
    // refusal carrying the interceptor's own sentence. Nothing may be written
    // after it: a profile saved behind a cancelled confirmation is the
    // half-done save reported as a whole one.
    asignarRol.mockResolvedValue({
      status: 403,
      message: "Se canceló la confirmación de identidad.",
    });

    const { user, setOpen, onSuccess } = abrir(cuenta(OTRA_PERSONA));

    await user.click(await screen.findByText("Coordinador"));
    await user.click(await screen.findByText("Administrador"));
    await user.click(guardar());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Se canceló la confirmación de identidad."));
    expect(editUsuario).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("si el perfil falla con el rol ya movido, lo dice en vez de callarlo", async () => {
    // The half no ordering can avoid: two requests can disagree. The person has
    // to be told which of the two landed, or they retry a save whose role half
    // already happened and read the second dialog as evidence that the first
    // one did nothing.
    editUsuario.mockRejectedValue(new Error("network down"));

    const { user, setOpen } = abrir(cuenta(OTRA_PERSONA));

    await user.click(await screen.findByText("Coordinador"));
    await user.click(await screen.findByText("Administrador"));
    await user.click(guardar());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const dicho = String((toast.error as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(dicho).toContain("El rol sí se cambió");
    expect(dicho).toContain("No se pudo guardar");
    expect(toast.success).not.toHaveBeenCalled();
    // Still open, on everything that was typed: this is the save to retry.
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("en la cuenta propia no ofrece el rol, y dice por qué", async () => {
    // The server refuses this route against the caller's own row
    // unconditionally — 403 even when the role sent is the one already stored.
    // A picker that takes a choice and then refuses it on save is worse than
    // one that never takes it, so the field is shown and not offered, with the
    // reason where the control was.
    const { user } = abrir(cuenta(YO), YO);

    expect(await screen.findByText(/Nadie puede cambiar su propio rol/)).toBeInTheDocument();
    expect(screen.queryByText("Seleccionar rol...")).toBeNull();
    const campo = screen.getByLabelText(/^Rol/);
    expect(campo).toBeDisabled();
    expect(campo).toHaveValue("Coordinador");

    await user.click(guardar());

    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    expect(asignarRol).not.toHaveBeenCalled();
  });
});

// The sheet opens on `seguridad` — handing out accounts. Seeing the roles and
// changing somebody's are `roles.ver` and `roles.editar`, separate on purpose.
// Without them the list was asked for anyway and refused, so every opening of
// an edit that was perfectly allowed began with an error notice over a role
// field that looked empty and required.
describe("editar una cuenta sin los permisos de roles", () => {
  const OTRA_PERSONA = 99;
  const cuenta = (extra: Partial<UsuarioInterface> = {}): UsuarioInterface => ({
    id: 40, name: "Ada", lastname: "Lovelace", birthday: new Date("1990-01-01"),
    image: "", phone: "700", user: "ada", pass: "", id_rol: 3,
    rol: { id: 3, name: "Coordinador", description: "" },
    ...extra,
  });
  const abrir = (usuario = cuenta()) => {
    render(conSesion(<UsuarioSheet usuario={usuario} open setOpen={vi.fn()} onSuccess={vi.fn()} />, OTRA_PERSONA));
    return userEvent.setup();
  };

  it("sin poder ver roles: no pide la lista, no avisa de nada y enseña el rol que tiene", async () => {
    puedeConRoles({ ver: false, editar: false });
    abrir();

    expect(await screen.findByLabelText(/^Rol/)).toHaveValue("Coordinador");
    expect(screen.getByLabelText(/^Rol/)).toBeDisabled();
    expect(screen.getByText(/necesita el permiso de ver y editar roles/i)).toBeInTheDocument();
    expect(getRol).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("pudiendo verlos pero no cambiarlos: lo enseña, no lo ofrece", async () => {
    // Offered, the picker accepted a choice the server then refused with a
    // sentence that named no permission.
    puedeConRoles({ ver: true, editar: false });
    getRol.mockResolvedValue([
      { id: 3, name: "Coordinador", description: "" },
      { id: 5, name: "Administrador", description: "" },
    ]);
    abrir();

    expect(await screen.findByLabelText(/^Rol/)).toHaveValue("Coordinador");
    expect(screen.queryByText("Seleccionar rol...")).toBeNull();
  });

  it("guarda el resto del perfil, y no toca el rol", async () => {
    puedeConRoles({ ver: false, editar: false });
    editUsuario.mockResolvedValue({});
    const user = abrir();
    const telefono = await screen.findByLabelText(/^Teléfono/);

    await user.clear(telefono);
    await user.type(telefono, "711");
    await user.click(screen.getByRole("button", { name: /^guardar/i }));

    await waitFor(() => expect(editUsuario).toHaveBeenCalledTimes(1));
    expect(editUsuario.mock.calls[0][0]).toMatchObject({ phone: "711", id_rol: 3 });
    expect(asignarRol).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Usuario actualizado");
  });

  it("le da nombre al rol que no lo tiene, también cuando viene vacío y no nulo", async () => {
    // `??` catches a null name and lets an empty one through as a blank field.
    puedeConRoles({ ver: false, editar: false });
    abrir(cuenta({ id_rol: 7, rol: { id: 7, name: "  ", description: "" } }));

    expect(await screen.findByLabelText(/^Rol/)).toHaveValue("Rol sin nombre (#7)");
  });
});
