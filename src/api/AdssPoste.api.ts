import { urlApi, urlPoste } from "./url";
import { todasLasFilas } from "./listado";
import { AdssPosteInterface } from "../interfaces/interfaces";

/**
 * The cables on one pole.
 *
 * `GET /api/poste/:id/adss` since D1. It was `/api/adssposte/:id_poste`, a
 * root mount for a listing that only exists with respect to a pole — and an
 * address where the identifier named a different table from the one it led
 * with.
 */
export const getAdssPoste = (id_poste: number): Promise<AdssPosteInterface[]> =>
  todasLasFilas<AdssPosteInterface>(`${urlApi}${urlPoste}${id_poste}/adss`);
