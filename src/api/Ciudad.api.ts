import axios from "axios";
import { urlCiudad, urlApi } from "./url";
import { CiudadInterface } from "../interfaces/interfaces";

export const getCiudad = (archived = false): Promise<CiudadInterface[]> => {
  const url = urlApi + urlCiudad + (archived ? "?archived=true" : "");
  return axios
    .get(url)
    .then((r) => r.data);
};

export const searchCiudad = (id: number): Promise<CiudadInterface> =>
  axios
    .get(urlApi + urlCiudad + id)
    .then((r) => r.data as CiudadInterface);

export const createCiudad = (data: CiudadInterface): Promise<number> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = { name: data.name, image: data.image, lat: data.lat, lng: data.lng };
  return axios
    .post(urlApi + urlCiudad, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editCiudad = (data: CiudadInterface): Promise<number> => {
  return axios
    .put(urlApi + urlCiudad + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteCiudad = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlCiudad + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarCiudad = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlCiudad + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
