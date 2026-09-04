import axios from "axios";
import { urlTipoObs, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { TipoObsInterface } from "../interfaces/interfaces";

export interface TipoObsStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

/**
 * The whole catalogue, and an error rather than part of it.
 *
 * `limit=all` where this used to send nothing at all: since C3 a listing without
 * a limit answers the first fifty rows, and the screens that read this one draw
 * no paginator, so fifty of three hundred would have looked exactly like three
 * hundred — with the total printed on a card two centimetres above the table,
 * disagreeing.
 */
export const getTipoObs = (archived = false): Promise<TipoObsInterface[]> =>
  todasLasFilas<TipoObsInterface>(urlApi + urlTipoObs, archived ? { archived: true } : {});

export const getTipoObsStats = (): Promise<TipoObsStats> =>
  axios
    .get(urlApi + urlTipoObs + "stats")
    .then((r) => r.data);

export const createTipoObs = (data: TipoObsInterface): Promise<number> => {
  type TipoObsWithoutId = Omit<TipoObsInterface, "id">;
  const newData: TipoObsWithoutId = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlTipoObs, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editTipoObs = (data: TipoObsInterface): Promise<number> => {
  return axios
    .put(urlApi + urlTipoObs + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteTipoObs = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlTipoObs + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarTipoObs = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlTipoObs + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
