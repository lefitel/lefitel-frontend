import axios from "axios";
import { urlBitacora, urlApi, urlUsuario } from "./url";
import { BitacoraInterface } from "../interfaces/interfaces";
import { Paginado, pedirListado } from "./listado";

/**
 * One person's own activity.
 *
 * `GET /api/usuario/:id/bitacora` since D1. In a log about people,
 * `/api/bitacora/:id_usuario` identified the subject and not the log, which
 * is the rule §3.2 states.
 *
 * 🔴 **The profile screen calls this with `.catch(() => [])`**, so a refusal
 * shows as an empty history and nothing else. The gate behind it lets a
 * person read their own trail without holding `bitacora.ver`, and that branch
 * depends on the route parameter being named the way the middleware expects:
 * `bitacora.self.test.ts` in the API is the only thing that can see it break.
 *
 * 🔴 `urlBitacora` stays imported and stays right for the two functions below.
 */
export const getBitacora = (
  id_usuario: number,
  limit = 50
): Promise<Paginado<BitacoraInterface>> =>
  pedirListado<BitacoraInterface>(`${urlApi}${urlUsuario}${id_usuario}/bitacora`, { limit });

export interface BitacoraFilters {
  id_usuario?: number;
  /** A family of actions, by the value `getVocabularioBitacora` offers. */
  family?: string;
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
 * One author of the log, as `GET /api/bitacora/authors` serves them.
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
  axios.get(urlApi + urlBitacora + "authors").then((r) => r.data);

/**
 * A page of the log.
 *
 * The envelope was half an envelope until C3 — `{data, total}` with no `page`
 * and no `limit` — so a caller could not tell a complete answer from a
 * truncated one. `BitacoraPanel`, which sends no limit at all, had been showing
 * the first fifty entries of a sheet's history as though they were all of it.
 */
export interface OpcionDeFiltro {
  value: string;
  label: string;
}

/**
 * What the "Acción" and "Entidad" filters offer.
 *
 * Asked of the server rather than written out here. Both lists were written out
 * here once, and five entities and a third of the actions the server writes
 * were on neither — a row could be on screen and impossible to filter for.
 */
export const getVocabularioBitacora = (): Promise<{ families: OpcionDeFiltro[]; entities: OpcionDeFiltro[] }> =>
  axios.get(urlApi + urlBitacora + "vocabulary").then((r) => r.data);

export const getAllBitacora = (
  filters: BitacoraFilters
): Promise<Paginado<BitacoraInterface>> =>
  pedirListado<BitacoraInterface>(urlApi + urlBitacora, { ...filters });
