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

/** Registra una ciudad y deja viajar el fallo. Contesta 201 desde C4. */
export const createCiudad = (data: CiudadInterface): Promise<CiudadInterface> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = { name: data.name, image: data.image, lat: data.lat, lng: data.lng };
  return axios
    .post<CiudadInterface>(urlApi + urlCiudad, newData)
    .then((response) => response.data);
};

export const editCiudad = (data: CiudadInterface): Promise<CiudadInterface> => {
  return axios
    .put<CiudadInterface>(urlApi + urlCiudad + data.id, data)
    .then((response) => response.data);
};

export const deleteCiudad = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlCiudad + id)
    .then(() => undefined);
};

export const desarchivarCiudad = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlCiudad + id + "/restore", {})
    .then(() => undefined);
};
