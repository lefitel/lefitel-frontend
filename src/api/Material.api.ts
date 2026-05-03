import axios from "axios";
import { urlMaterial, urlApi } from "./url";
import { MaterialInterface } from "../interfaces/interfaces";

export interface MaterialStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

export const getMaterial = (token: string, archived = false): Promise<MaterialInterface[]> => {
  const url = urlApi + urlMaterial + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const getMaterialStats = (token: string): Promise<MaterialStats> =>
  axios
    .get(urlApi + urlMaterial + "stats", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);

export const createMaterial = (data: MaterialInterface, token: string): Promise<number> => {
  type MaterialWithoutId = Omit<MaterialInterface, "id">;
  const newData: MaterialWithoutId = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlMaterial, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editMaterial = (data: MaterialInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlMaterial + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteMaterial = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlMaterial + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarMaterial = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlMaterial + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
