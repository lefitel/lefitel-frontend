import axios from "axios";
import { urlRol, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { RolInterface } from "../interfaces/interfaces";

export const getRol = (archived = false): Promise<RolInterface[]> =>
  todasLasFilas<RolInterface>(urlApi + urlRol, archived ? { archived: true } : {});

export const createRol = (data: RolInterface): Promise<number> => {
  return axios
    .post(urlApi + urlRol, { name: data.name, description: data.description })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editRol = (data: RolInterface): Promise<number> => {
  return axios
    .put(urlApi + urlRol + data.id, { name: data.name, description: data.description })
    .then((response) => response.status)
    .catch(() => 400);
};

/** What the server said when asked to archive a role. */
export interface ArchiveRolResult {
  status: number;
  /** The server's own wording when it refuses, ready to show. */
  message?: string;
  /** How many accounts still hold the role, when that is why it refused. */
  cuentas?: number;
}

/**
 * Archive a role, and carry back the reason when the server says no.
 *
 * The other entities in this folder end their calls with `.catch(() => 400)`,
 * which is fine when every failure means the same thing to the person looking.
 * Here it does not. The server refuses with 409 and a count — "hay 3 cuentas con
 * este rol" — and that count is the entire value of the guard: without it the
 * administrator is told "no se pudo" and left hunting through a user list for
 * accounts that may not even be on the current page.
 *
 * Worth knowing what the refusal is protecting. `usuarios.id_rol` is ON DELETE
 * CASCADE, and archiving used to be a real DELETE: the chain was measured at six
 * users and 4.835 revisions. It is a soft delete now, so the cascade cannot
 * fire — but archiving a role people still hold would leave them with
 * permissions nobody can see or change, which is why the server refuses rather
 * than doing it quietly.
 */
export const archiveRol = (id: number): Promise<ArchiveRolResult> => {
  return axios
    // `{ data: {} }`, no `delete(url)` a secas: axios descarta el cuerpo de un
    // DELETE que no lo lleve en `config.data`, y el interceptor de step-up
    // necesita un sitio donde poner la contraseña al reenviar. Ver el
    // comentario de `deleteUsuario` en `Usuario.api.ts`.
    .delete(urlApi + urlRol + id, { data: {} })
    .then((response) => ({ status: response.status }))
    .catch((error: unknown) => {
      const res = (error as { response?: { status?: number; data?: { message?: string; cuentas?: number } } })?.response;
      return {
        status: typeof res?.status === "number" ? res.status : 0,
        message: res?.data?.message,
        cuentas: res?.data?.cuentas,
      };
    });
};

export const desarchivarRol = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlRol + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
