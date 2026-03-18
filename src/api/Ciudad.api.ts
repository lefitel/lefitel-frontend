import axios from "axios";
import { urlCiudad, urlApi } from "./url";
import { CiudadInterface } from "../interfaces/interfaces";

export const getCiudad = (token: string, archived = false): Promise<CiudadInterface[]> => {
  const url = urlApi + urlCiudad + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const searchCiudad = (id: number, token: string): Promise<CiudadInterface> =>
  axios
    .get(urlApi + urlCiudad + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data as CiudadInterface);

export const createCiudad = (data: CiudadInterface, token: string): Promise<number> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = { name: data.name, image: data.image, lat: data.lat, lng: data.lng };
  return axios
    .post(urlApi + urlCiudad, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editCiudad = (data: CiudadInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlCiudad + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteCiudad = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlCiudad + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarCiudad = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlCiudad + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
