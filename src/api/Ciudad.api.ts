import axios from "axios";
import { urlCiudad, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { CiudadInterface } from "../interfaces/interfaces";

/**
 * The whole catalogue, and an error rather than part of it.
 *
 * `limit=all` where this used to send nothing at all: since C3 a listing without
 * a limit answers the first fifty rows, and the screens that read this one draw
 * no paginator, so fifty of three hundred would have looked exactly like three
 * hundred — with the total printed on a card two centimetres above the table,
 * disagreeing.
 */
export const getCiudad = (archived = false): Promise<CiudadInterface[]> =>
  todasLasFilas<CiudadInterface>(urlApi + urlCiudad, archived ? { archived: true } : {});

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
