import axios from "axios";
import { urlRol, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { RolInterface } from "../interfaces/interfaces";

export const getRol = (archived = false): Promise<RolInterface[]> =>
  todasLasFilas<RolInterface>(urlApi + urlRol, archived ? { archived: true } : {});

export const createRol = (data: RolInterface): Promise<RolInterface> => {
  return axios
    .post<RolInterface>(urlApi + urlRol, { name: data.name, description: data.description })
    .then((response) => response.data);
};

export const editRol = (data: RolInterface): Promise<RolInterface> => {
  return axios
    .put<RolInterface>(urlApi + urlRol + data.id, { name: data.name, description: data.description })
    .then((response) => response.data);
};

/**
 * Archive a role, and let the reason travel when the server says no.
 *
 * The refusal that matters is a 409 with a count — "hay 3 cuentas con este rol"
 * — and that count is the entire value of the guard: without it the
 * administrator is told "no se pudo" and left hunting through a user list for
 * accounts that may not even be on the current page. This used to hand back
 * `{status, message, cuentas}` because there was no other way for a sentence to
 * survive the trip; since C4 there is, and it is the same one every other
 * failure uses — `mensajeDeError` reads the server's own words off
 * `error.normalized`. `cuentas` never had a reader outside a test fixture.
 *
 * Worth knowing what the refusal is protecting. `usuarios.id_rol` is ON DELETE
 * CASCADE, and archiving used to be a real DELETE: the chain was measured at six
 * users and 4.835 revisions. It is a soft delete now, so the cascade cannot
 * fire — but archiving a role people still hold would leave them with
 * permissions nobody can see or change, which is why the server refuses rather
 * than doing it quietly.
 */
export const archiveRol = (id: number): Promise<void> => {
  return axios
    // `{ data: {} }`, no `delete(url)` a secas: axios descarta el cuerpo de un
    // DELETE que no lo lleve en `config.data`, y el interceptor de step-up
    // necesita un sitio donde poner la contraseña al reenviar. Ver el
    // comentario de `deleteUsuario` en `Usuario.api.ts`.
    .delete(urlApi + urlRol + id, { data: {} })
    .then(() => undefined);
};

export const desarchivarRol = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlRol + id + "/restore", {})
    .then(() => undefined);
};
