import axios from "axios";
import { urlObs, urlApi } from "./url";
import { ObsInterface } from "../interfaces/interfaces";

export interface ObsStats {
  total: number;
  unclassified: number;
  critical: number;
}

export const getObs = (archived = false): Promise<ObsInterface[]> => {
  const url = urlApi + urlObs + (archived ? "?archived=true" : "");
  return axios
    .get(url)
    .then((r) => r.data);
};

export const getObsStats = (): Promise<ObsStats> =>
  axios
    .get(urlApi + urlObs + "stats")
    .then((r) => r.data);

export const createObs = (data: ObsInterface): Promise<number> => {
  type ObsWithoutId = Omit<ObsInterface, "id">;
  const newData: ObsWithoutId = {
    name: data.name,
    description: data.description,
    id_tipoObs: data.id_tipoObs,
    criticality: data.criticality ?? null,
  };
  return axios
    .post(urlApi + urlObs, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editObs = (data: ObsInterface): Promise<number> => {
  return axios
    .put(urlApi + urlObs + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteObs = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlObs + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarObs = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlObs + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
