import axios from "axios";
import { urlUsuario, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { descargarListado, type FormatoDescarga } from "./descarga";
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

export const createUsuario = (data: UsuarioInterface): Promise<number> => {
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
    .post(urlApi + urlUsuario, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editUsuario = (data: UsuarioInterface): Promise<number> => {
  return axios
    .put(urlApi + urlUsuario + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

/**
 * Rename an account. `oldPass` is the caller's *current* password, and the
 * server demands it whenever the account being renamed is their own.
 *
 * It rides on the same request as the change, rather than being confirmed
 * beforehand through `POST /api/auth/confirm-password` — an endpoint retired for
 * this very reason. Two reasons, and the first one settles it: the server
 * requires it now, so a prior confirmation cannot stand in for it; it would only
 * add a second comparison, out of a second budget, in a second place where the
 * rule can drift. And the credential that authorises an operation belongs in the
 * request that performs it, which is how `editUserPass` has always worked.
 *
 * Not needed when an administrator renames somebody else: there is no password
 * they could be expected to know. `undefined` is what goes in then, and axios
 * omits the key.
 */
export const editUserName = (
  data: UsuarioInterface & { oldPass?: string }
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "username/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const editUserPass = (
  data: UsuarioInterface & { oldPass?: string }
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "userpass/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
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
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
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
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const deleteUsuario = (id: number): Promise<number> => {
  return axios
    // `{ data: {} }` porque `axios.delete(url)` descarta el cuerpo, y sin
    // cuerpo el interceptor de step-up no tiene dónde poner la contraseña.
    // Precedente que lo valida: `deleteTotp` en `Mfa.api.ts` ya manda así su
    // `stepup_password` contra una ruta que la exige, y funciona — Express
    // parsea el cuerpo de un DELETE con `Content-Type: application/json`.
    .delete(urlApi + urlUsuario + id, { data: {} })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarUsuario = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlUsuario + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
