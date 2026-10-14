import axios from "axios";
import { urlApi, urlTramo } from "./url";
import { todasLasFilas } from "./listado";
import type { Departamento, Tramo } from "../interfaces/interfaces";

/**
 * A row of the Tramos screen. Each figure is absent, not zero, for a role that
 * may not read what it counts: `postes` without `postes.ver`, and `pendientes`
 * — incidents still open on the tramo's poles — without `eventos.ver`.
 */
export interface TramoConCifras extends Tramo {
  postes?: number;
  pendientes?: number;
}

/**
 * A city as the tramo options serve it: enough to name it, to draw it and to show its photo.
 *
 * `name` is nullable because the column is (the model does not forbid null): show
 * it through `nombreDeCiudad`, which falls back to `#<id>`. `lat` and `lng` are
 * typed nullable although the column is not: the map checks with `hasCoords`
 * before drawing, and a 0,0 or a missing value must never reach a marker. `image` is
 * the stored path of the photo, or null for a city that has none: show it through `imageUrl`.
 */
export interface CiudadDeRed {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  image: string | null;
}

export interface OpcionesTramo {
  // Spelled out rather than imported: `rutas.test.ts` reads any string in this
  // folder containing `/opciones` as a Spanish address, and an import path is one.
  ciudad: CiudadDeRed[];
  departamento: Departamento[];
}

/**
 * Every live tramo. The server can narrow these by department (`?departamento=`),
 * and nothing here asks it to: the one screen that lists them has them all in
 * hand for the map already, and filters what it holds.
 */
export const getTramos = (): Promise<TramoConCifras[]> =>
  todasLasFilas<TramoConCifras>(urlApi + urlTramo);

export const getTramosArchivados = (): Promise<TramoConCifras[]> =>
  todasLasFilas<TramoConCifras>(urlApi + urlTramo, { archived: true });

export const getOpcionesTramo = (): Promise<OpcionesTramo> =>
  axios.get(urlApi + urlTramo + "options").then((r) => r.data as OpcionesTramo);

export interface NuevoTramo {
  /** The two cities, in whatever order they were picked: a tramo has none. */
  ciudades: [number, number];
  id_departamento?: number | null;
}

export const createTramo = (data: NuevoTramo): Promise<Tramo> =>
  axios.post<Tramo>(urlApi + urlTramo, data).then((r) => r.data);

export const editTramo = (
  id: number,
  cambios: { id_departamento?: number | null; ciudades?: [number, number] },
): Promise<Tramo> => axios.put<Tramo>(urlApi + urlTramo + id, cambios).then((r) => r.data);

export const deleteTramo = (id: number): Promise<void> =>
  axios.delete(urlApi + urlTramo + id).then(() => undefined);

export const desarchivarTramo = (id: number): Promise<void> =>
  axios.patch(urlApi + urlTramo + id + "/restore", {}).then(() => undefined);

/**
 * The tramo a 409 came back with: the pair already exists.
 *
 * Creating a tramo that is already there is not a failure for whoever is
 * filling a pole form — it is the answer to what they were looking for. The
 * caller reads `archivado` to tell "use this one" from "somebody has to
 * unarchive this one".
 */
export const tramoDelConflicto = (error: unknown): Tramo | null => {
  const respuesta = (error as { response?: { status?: number; data?: { tramo?: Tramo } } } | null | undefined)?.response;
  return respuesta?.status === 409 && respuesta.data?.tramo ? respuesta.data.tramo : null;
};
