import axios from "axios";
import { urlObs, urlApi } from "./url";
import { ObsInterface } from "../interfaces/interfaces";

export interface ObsStats {
  total: number;
  unclassified: number;
  critical: number;
}

export const getObs = (token: string, archived = false): Promise<ObsInterface[]> => {
  const url = urlApi + urlObs + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const getObsStats = (token: string): Promise<ObsStats> =>
  axios
    .get(urlApi + urlObs + "stats", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);

export const createObs = (data: ObsInterface, token: string): Promise<number> => {
  type ObsWithoutId = Omit<ObsInterface, "id">;
  const newData: ObsWithoutId = {
    name: data.name,
    description: data.description,
    id_tipoObs: data.id_tipoObs,
    criticality: data.criticality ?? null,
  };
  return axios
    .post(urlApi + urlObs, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editObs = (data: ObsInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlObs + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteObs = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlObs + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarObs = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlObs + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
