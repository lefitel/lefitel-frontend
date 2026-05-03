import axios from "axios";
import { urlTipoObs, urlApi } from "./url";
import { TipoObsInterface } from "../interfaces/interfaces";

export interface TipoObsStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

export const getTipoObs = (token: string, archived = false): Promise<TipoObsInterface[]> => {
  const url = urlApi + urlTipoObs + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const getTipoObsStats = (token: string): Promise<TipoObsStats> =>
  axios
    .get(urlApi + urlTipoObs + "stats", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);

export const createTipoObs = (data: TipoObsInterface, token: string): Promise<number> => {
  type TipoObsWithoutId = Omit<TipoObsInterface, "id">;
  const newData: TipoObsWithoutId = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlTipoObs, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editTipoObs = (data: TipoObsInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlTipoObs + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteTipoObs = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlTipoObs + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarTipoObs = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlTipoObs + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
