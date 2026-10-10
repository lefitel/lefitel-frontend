import axios from "axios";
import { urlUsuario, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { descargarListado, mensajeDeError, type FormatoDescarga } from "./descarga";
import { UsuarioInterface } from "../interfaces/interfaces";

/** The whole directory, and an error rather than part of it. */
export const getUsuario = (archived = false): Promise<UsuarioInterface[]> =>
  todasLasFilas<UsuarioInterface>(urlApi + urlUsuario, archived ? { archived: true } : {});

/**
 * The staff directory as a file the server builds. See `exportarPostes`.
 *
 * No filters, and that is not an oversight: this screen filters, sorts and
 * pages **in the browser** over a directory it holds whole, so there is nothing
 * on the wire for the server to honour. Its button already produced the entire
 * directory rather than the filtered view; what changed is that the file now
 * says "Listado completo" on its second line instead of leaving the reader to
 * assume it was what they were looking at.
 *
 * What the server sends back is seven columns, declared one by one there. The
 * listing this screen reads sends seventeen — including the recovery address
 * of every account and which of them can still sign in without a second factor
 * — and a spreadsheet that gets forwarded is not a screen behind a session.
 */
export const exportarUsuarios = (
  formato: FormatoDescarga,
  archived = false,
): Promise<{ blob: Blob; filename: string }> =>
  descargarListado(urlApi + urlUsuario + "export", {
    format: formato,
    ...(archived ? { archived: true } : {}),
  });

export const searchUsuario = (dataId: number): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + dataId)
    .then((response) => response.data as UsuarioInterface);
};

export const searchUsuario_user = (user: string): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + "user/" + user, { headers: { "Cache-Control": "no-cache" } })
    .then((response) => response.data as UsuarioInterface);
};

export const createUsuario = (data: UsuarioInterface): Promise<UsuarioInterface> => {
  type UsuarioWithoutId = Omit<UsuarioInterface, "id">;
  const newData: UsuarioWithoutId = {
    name: data.name,
    lastname: data.lastname,
    image: data.image,
    phone: data.phone,
    birthday: data.birthday,
    user: data.user,
    pass: data.pass,
    id_rol: data.id_rol,
  };
  return axios
    .post<UsuarioInterface>(urlApi + urlUsuario, newData)
    .then((response) => response.data);
};

export const editUsuario = (data: UsuarioInterface): Promise<UsuarioInterface> => {
  return axios
    .put<UsuarioInterface>(urlApi + urlUsuario + data.id, data)
    .then((response) => response.data);
};

/**
 * 🔴 **Why the wrappers below read `mensajeDeError` and not
 * `e.response.data.message`.**
 *
 * Every route they call sits behind the step-up gate, so any of them can be
 * interrupted by the re-authentication dialog. When somebody cancels that
 * dialog, the interceptor knows what happened and the server does not: the
 * response body still carries what the gate asked for before anyone decided
 * anything — "Introduce tu contraseña actual para completar esta operación."
 * Reading the body straight puts that sentence on screen **immediately after
 * the dialog asking for the password was closed by the person reading it** —
 * an administrator cancels out of the permission matrix and is told to type
 * the password they just declined to type.
 *
 * `mensajeDeError` reads `error.normalized` first, which is where `http.ts`
 * copies the interceptor's own explanation, and falls back to the server's
 * sentence when there is none. It is the funnel the other ~130 call sites in
 * this application already use, so this is not a new pattern — it is these
 * joining the one that exists. See §4.1 of
 * `api/docs/specs/2026-08-25-estandar-api-design.md`.
 *
 * The `{ status, message }` return shape is unchanged: the screens branch on
 * the number, and `mensajeDeError` only decides which sentence goes in
 * `message`.
 */

/**
 * Rename an account. **No password parameter, and that is load-bearing.**
 *
 * This took `oldPass` — the caller's current password — for as long as
 * `updateUserName` compared one. It does not any more: the demand moved to the
 * step-up gate in front of the route, which reads `stepup_password` and is
 * answered by `stepUpInterceptor.ts` on the retry, from one dialog, once every
 * ten minutes rather than once per request.
 *
 * So adding a password back here does not re-tighten anything. The server would
 * ignore the field, the gate would ask anyway, and the person would type the
 * same secret twice for one rename — which is the complaint the whole
 * reauthentication window exists to answer. `Usuario.api.test.ts` holds the
 * absence, at the type level as well as on the wire.
 *
 * `editUserPass` below is the deliberate exception: there `oldPass` is not a
 * proof of identity but half of what is being changed.
 */
export const editUserName = (
  data: UsuarioInterface
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "username/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => ({
      status: e.response?.status || 500,
      message: mensajeDeError(e, "Error desconocido"),
    }));
};

export const editUserPass = (
  data: UsuarioInterface & { oldPass?: string }
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "userpass/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => ({
      status: e.response?.status || 500,
      message: mensajeDeError(e, "Error desconocido"),
    }));
};

/**
 * Move an account to another role — `PUT /api/usuario/:id/rol`.
 *
 * 🔴 **This is the only address that changes the role of an account that
 * already exists, and until this function there was none.** `id_rol` used to
 * travel inside `editUsuario`, and the server took it. It does not any more:
 * the field left that route's allowlist and became this sub-resource, because
 * `PUT /api/usuario/:id` is also how a person edits their own profile and it
 * joined the ten-minute reauthentication window for that reason — saving a
 * telephone number must not ask for a password again. Handing out authority
 * must. So the field moved out rather than the route staying out.
 *
 * While this function did not exist, `editUsuario` went on sending `id_rol`
 * and the server went on answering 200 after discarding it: the screen said
 * "Usuario actualizado" and the role had not moved.
 *
 * **Two rules the caller has to keep, both of them the server's:**
 *
 * 1. **Never on the caller's own account.** The refusal there is
 *    unconditional and answers 403 — even when the role sent is the one the
 *    account already has. Losing your own access is the one mistake with no
 *    way back, and nobody else can hand it to you.
 * 2. **Only when the role actually moved.** Not a rule of the wire — the
 *    server answers 204 and writes nothing when the number matches — but of
 *    the person in front of it: this route asks for the password on **every**
 *    request, window or no window, so a call that changes nothing still opens
 *    the reauthentication dialog.
 *
 * `204` on success, so there is nothing to read back. The `{ status, message }`
 * shape and `mensajeDeError` are its neighbours' above, for the reason their
 * shared note gives: cancelling the dialog this call opens must not leave the
 * gate's "type your password" sentence on screen.
 */
export const asignarRol = (
  id: number,
  id_rol: number,
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + id + "/rol", { id_rol })
    .then((response) => ({ status: response.status }))
    .catch((e) => ({
      status: e.response?.status || 500,
      message: mensajeDeError(e, "Error desconocido"),
    }));
};

/**
 * The in-app rescue button from `docs/specs/2026-08-21-autenticacion-mfa-design.md`
 * §8 ("La vía de escape"): removes every second factor the target account has
 * registered, so it is reachable with the password alone again.
 *
 * The server refuses this when `id` names the caller's own account — resetting
 * your own factors would leave you passing the very step-up gate this
 * operation exists behind with nothing but a cookie. `UsuarioDetallePage.tsx`
 * is what keeps this function from ever being called on that account: the
 * button it sits behind is not drawn there in the first place, so a 403 for
 * that reason should not normally reach here — see the two-message table in
 * the task's report for the case where it does.
 */
export const resetMfaUsuario = (id: number): Promise<{ status: number; message?: string }> => {
  return axios
    // `{}` y no nada. Medido contra el axios de este repo: `axios.post(url)`
    // sin segundo argumento deja `Content-Type: application/x-www-form-urlencoded`
    // escrito en la configuración, y el servidor sólo monta `express.json()`.
    // Así que cuando el interceptor de step-up reenvía esta petición con la
    // contraseña dentro, sale como formulario, Express no lo parsea, y la
    // respuesta vuelve a ser «falta la contraseña» — con la contraseña
    // correcta, indefinidamente. Un objeto vacío fija el tipo en JSON desde la
    // primera petición y cierra el bucle en origen.
    .post(urlApi + urlUsuario + id + "/mfa/reset", {})
    .then((response) => ({ status: response.status }))
    .catch((e) => ({
      status: e.response?.status || 500,
      message: mensajeDeError(e, "Error desconocido"),
    }));
};

/**
 * Lifts the lock the server places on an account after five wrong password
 * attempts. The route has existed on the server for a long time; nothing in
 * `web` called it until this function, so the only way back in was to wait out
 * the lock or edit the database by hand.
 */
export const desbloquearUsuario = (id: number): Promise<{ status: number; message?: string }> => {
  return axios
    // Mismo motivo que `resetMfaUsuario` — ver su comentario.
    .patch(urlApi + urlUsuario + id + "/desbloquear", {})
    .then((response) => ({ status: response.status }))
    .catch((e) => ({
      status: e.response?.status || 500,
      message: mensajeDeError(e, "Error desconocido"),
    }));
};

export const deleteUsuario = (id: number): Promise<void> => {
  return axios
    // `{ data: {} }` porque `axios.delete(url)` descarta el cuerpo, y sin
    // cuerpo el interceptor de step-up no tiene dónde poner la contraseña.
    // Precedente que lo valida: `deleteTotp` en `Mfa.api.ts` ya manda así su
    // `stepup_password` contra una ruta que la exige, y funciona — Express
    // parsea el cuerpo de un DELETE con `Content-Type: application/json`.
    .delete(urlApi + urlUsuario + id, { data: {} })
    .then(() => undefined);
};

export const desarchivarUsuario = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlUsuario + id + "/restore", {})
    .then(() => undefined);
};
