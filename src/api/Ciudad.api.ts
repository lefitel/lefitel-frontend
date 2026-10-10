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
export const getCiudad = (archived = false): Promise<CiudadConCifras[]> =>
  todasLasFilas<CiudadConCifras>(urlApi + urlCiudad, archived ? { archived: true } : {});

/**
 * A city as the list serves it: the row, plus what hangs from it.
 *
 * Every figure is optional because the server sends each block only to a role
 * that could read it on its own screen — the first two need `postes.ver`, the
 * last three `eventos.ver`. Absent means "not yours to see", never zero.
 */
export interface CiudadConCifras extends CiudadInterface {
  /** Live poles on any tramo that ends here. */
  postes?: number;
  /** Ids of the live cities it shares a tramo with. */
  vecinas?: number[];
  /** Unresolved incidents on those poles. */
  pendientes?: number;
  /** How many of the unresolved ones are flagged as priority. */
  prioritarios?: number;
  /** Date of the most recent incident, resolved or not. */
  ultimoEvento?: string | null;
}

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

/**
 * Sends the four columns a city has, and not the object it was handed.
 *
 * The form passes back the row it was opened with, and since the list started
 * carrying figures that row holds `postes`, `pendientes` and the rest. The
 * server builds the bitácora entry from the body it receives, so sending them
 * recorded every edit as a change to counts nobody touched.
 */
export const editCiudad = (data: CiudadInterface): Promise<CiudadInterface> => {
  const { name, image, lat, lng } = data;
  return axios
    .put<CiudadInterface>(urlApi + urlCiudad + data.id, { name, image, lat, lng })
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
