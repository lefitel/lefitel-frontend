import axios from "axios";
import { urlBitacora, urlApi } from "./url";
import { BitacoraInterface } from "../interfaces/interfaces";

export const getBitacora = (
  id_usuario: number,
  limit = 50
): Promise<BitacoraInterface[]> =>
  axios
    .get(urlApi + urlBitacora + id_usuario, {
      params: { limit },
    })
    .then((r) => r.data);

export interface BitacoraFilters {
  id_usuario?: number;
  action?: string;
  entity?: string;
  entity_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  severity?: string;
  sortBy?: string[];
  sortOrder?: ('asc' | 'desc')[];
}

/**
 * One author of the log, as `GET /api/bitacora/autores` serves them.
 *
 * Its own type and deliberately not `Pick<UsuarioInterface, …>`, because of
 * `id`: on that interface it is optional and nullable, since the same type also
 * describes a record being filled in on a form. Here it is a primary key already
 * read from the database. Borrowing the optional one lets `String(a.id)` produce
 * the string "undefined", which this screen turns back into `Number(...)` — that
 * is `NaN`, it goes into the filter, and the server answers 500.
 */
export interface AutorBitacora {
  id: number;
  name: string;
  lastname: string;
  /** Set when the account has been archived. Those authors are listed too. */
  deletedAt: string | null;
}

/**
 * The accounts that have entries in the log, for the author filter.
 *
 * Replaces `getUsuario()` here, and the difference is a permission. That one is
 * the staff directory and asks for `seguridad:ver`: a role holding `bitacora:ver`
 * and not that one was refused it, the screen swallowed the 403, and the filter
 * offered "Todos" and nothing else — indistinguishable from a system where
 * nobody has ever done anything. This asks for the permission the screen is
 * already behind.
 *
 * It also answers a better list than the directory did: only people who left
 * entries, and archived accounts among them — which is who somebody reviewing
 * old work is most often looking for, and exactly who the directory leaves out.
 */
export const getAutoresBitacora = (): Promise<AutorBitacora[]> =>
  axios.get(urlApi + urlBitacora + "autores").then((r) => r.data);

export const getAllBitacora = (
  filters: BitacoraFilters
): Promise<{ data: BitacoraInterface[]; total: number }> =>
  axios
    .get(urlApi + urlBitacora, {
      params: filters,
    })
    .then((r) => r.data);
