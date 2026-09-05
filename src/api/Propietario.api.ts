import axios from "axios";
import { urlPropietario, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { PropietarioInterface } from "../interfaces/interfaces";

export interface PropietarioStats {
  total: number;
  mostPostes: { name: string; count: number } | null;
  mostPendientes: { name: string; count: number } | null;
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
export const getPropietario = (archived = false): Promise<PropietarioInterface[]> =>
  todasLasFilas<PropietarioInterface>(urlApi + urlPropietario, archived ? { archived: true } : {});

export const getPropietarioStats = (): Promise<PropietarioStats> =>
  axios
    .get(urlApi + urlPropietario + "stats")
    .then((r) => r.data);

export const createPropietario = (data: PropietarioInterface): Promise<PropietarioInterface> => {
  type PropietarioWithoutId = Omit<PropietarioInterface, "id">;
  const newData: PropietarioWithoutId = { name: data.name };
  return axios
    .post<PropietarioInterface>(urlApi + urlPropietario, newData)
    .then((response) => response.data);
};

export const editPropietario = (data: PropietarioInterface): Promise<PropietarioInterface> => {
  return axios
    .put<PropietarioInterface>(urlApi + urlPropietario + data.id, data)
    .then((response) => response.data);
};

export const deletePropietario = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlPropietario + id)
    .then(() => undefined);
};

export const desarchivarPropietario = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlPropietario + id + "/restore", {})
    .then(() => undefined);
};
