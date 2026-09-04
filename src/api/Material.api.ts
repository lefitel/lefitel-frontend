import axios from "axios";
import { urlMaterial, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { MaterialInterface } from "../interfaces/interfaces";

export interface MaterialStats {
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
export const getMaterial = (archived = false): Promise<MaterialInterface[]> =>
  todasLasFilas<MaterialInterface>(urlApi + urlMaterial, archived ? { archived: true } : {});

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
