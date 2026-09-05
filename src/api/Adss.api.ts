import axios from "axios";
import { urlAdss, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { AdssInterface } from "../interfaces/interfaces";

export interface AdssStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

/**
 * The whole catalogue, and an error rather than part of it.
 *
 * The `.catch(() => [])` this replaces was the only one of the eight catalogue
 * readers that swallowed its own failure, and it is why the pole sheet printed
 * "Sin ADSS registradas" — a claim about the database — whenever the request
 * had simply failed. C2 gave that screen an answer for the refusal; this gives
 * the reader one for everything else.
 */
export const getAdss = (archived = false): Promise<AdssInterface[]> =>
  todasLasFilas<AdssInterface>(urlApi + urlAdss, archived ? { archived: true } : {});

export const getAdssStats = (): Promise<AdssStats> =>
  axios
    .get(urlApi + urlAdss + "stats")
    .then((r) => r.data);

export const createAdss = (data: AdssInterface): Promise<AdssInterface> => {
  const newData: AdssInterface = { name: data.name, description: data.description };
  return axios
    .post<AdssInterface>(urlApi + urlAdss, newData)
    .then((response) => response.data);
};

export const editAdss = (data: AdssInterface): Promise<AdssInterface> => {
  return axios
    .put<AdssInterface>(urlApi + urlAdss + data.id, data)
    .then((response) => response.data);
};

export const deleteAdss = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlAdss + id)
    .then(() => undefined);
};

export const desarchivarAdss = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlAdss + id + "/desarchivar", {})
    .then(() => undefined);
};
