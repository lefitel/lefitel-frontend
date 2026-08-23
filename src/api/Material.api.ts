import axios from "axios";
import { urlMaterial, urlApi } from "./url";
import { MaterialInterface } from "../interfaces/interfaces";

export interface MaterialStats {
  total: number;
  mostUsed: { name: string; count: number } | null;
  empty: number;
}

export const getMaterial = (archived = false): Promise<MaterialInterface[]> => {
  const url = urlApi + urlMaterial + (archived ? "?archived=true" : "");
  return axios
    .get(url)
    .then((r) => r.data);
};

export const getMaterialStats = (): Promise<MaterialStats> =>
  axios
    .get(urlApi + urlMaterial + "stats")
    .then((r) => r.data);

export const createMaterial = (data: MaterialInterface): Promise<number> => {
  type MaterialWithoutId = Omit<MaterialInterface, "id">;
  const newData: MaterialWithoutId = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlMaterial, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editMaterial = (data: MaterialInterface): Promise<number> => {
  return axios
    .put(urlApi + urlMaterial + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteMaterial = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlMaterial + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarMaterial = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlMaterial + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
