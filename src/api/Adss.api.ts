import axios from "axios";
import { urlAdss, urlApi } from "./url";
import { AdssInterface } from "../interfaces/interfaces";

export interface AdssStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

export const getAdss = (archived = false): Promise<AdssInterface[]> => {
  const url = urlApi + urlAdss + (archived ? "?archived=true" : "");
  return axios
    .get(url)
    .then((r) => r.data)
    .catch(() => []);
};

export const getAdssStats = (): Promise<AdssStats> =>
  axios
    .get(urlApi + urlAdss + "stats")
    .then((r) => r.data);

export const createAdss = (data: AdssInterface): Promise<number> => {
  const newData: AdssInterface = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlAdss, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editAdss = (data: AdssInterface): Promise<number> => {
  return axios
    .put(urlApi + urlAdss + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteAdss = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlAdss + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarAdss = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlAdss + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
