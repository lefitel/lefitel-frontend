import axios from "axios";
import { urlPropietario, urlApi } from "./url";
import { PropietarioInterface } from "../interfaces/interfaces";

export interface PropietarioStats {
  total: number;
  mostPostes: { name: string; count: number } | null;
  mostPendientes: { name: string; count: number } | null;
}

export const getPropietario = (archived = false): Promise<PropietarioInterface[]> => {
  const url = urlApi + urlPropietario + (archived ? "?archived=true" : "");
  return axios
    .get(url)
    .then((r) => r.data);
};

export const getPropietarioStats = (): Promise<PropietarioStats> =>
  axios
    .get(urlApi + urlPropietario + "stats")
    .then((r) => r.data);

export const createPropietario = (data: PropietarioInterface): Promise<number> => {
  type PropietarioWithoutId = Omit<PropietarioInterface, "id">;
  const newData: PropietarioWithoutId = { name: data.name };
  return axios
    .post(urlApi + urlPropietario, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editPropietario = (data: PropietarioInterface): Promise<number> => {
  return axios
    .put(urlApi + urlPropietario + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deletePropietario = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlPropietario + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarPropietario = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlPropietario + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
