import axios from "axios";
import { urlPropietario, urlApi } from "./url";
import { PropietarioInterface } from "../interfaces/interfaces";

export const getPropietario = (token: string, archived = false): Promise<PropietarioInterface[]> => {
  const url = urlApi + urlPropietario + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const createPropietario = (data: PropietarioInterface, token: string): Promise<number> => {
  type PropietarioWithoutId = Omit<PropietarioInterface, "id">;
  const newData: PropietarioWithoutId = { name: data.name };
  return axios
    .post(urlApi + urlPropietario, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editPropietario = (data: PropietarioInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlPropietario + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deletePropietario = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlPropietario + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarPropietario = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlPropietario + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
