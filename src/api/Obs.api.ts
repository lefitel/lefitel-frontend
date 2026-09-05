import axios from "axios";
import { urlObs, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { ObsInterface } from "../interfaces/interfaces";

export interface ObsStats {
  total: number;
  unclassified: number;
  critical: number;
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
export const getObs = (archived = false): Promise<ObsInterface[]> =>
  todasLasFilas<ObsInterface>(urlApi + urlObs, archived ? { archived: true } : {});

export const getObsStats = (): Promise<ObsStats> =>
  axios
    .get(urlApi + urlObs + "stats")
    .then((r) => r.data);

export const createObs = (data: ObsInterface): Promise<ObsInterface> => {
  type ObsWithoutId = Omit<ObsInterface, "id">;
  const newData: ObsWithoutId = {
    name: data.name,
    description: data.description,
    id_tipoObs: data.id_tipoObs,
    criticality: data.criticality ?? null,
  };
  return axios
    .post<ObsInterface>(urlApi + urlObs, newData)
    .then((response) => response.data);
};

export const editObs = (data: ObsInterface): Promise<ObsInterface> => {
  return axios
    .put<ObsInterface>(urlApi + urlObs + data.id, data)
    .then((response) => response.data);
};

export const deleteObs = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlObs + id)
    .then(() => undefined);
};

export const desarchivarObs = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlObs + id + "/desarchivar", {})
    .then(() => undefined);
};
