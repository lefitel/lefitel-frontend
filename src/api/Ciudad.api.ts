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

/**
 * Nota de C4, y es temporal.
 *
 * Ésta es una de las cinco funciones de esta carpeta que siguen devolviendo un
 * número en vez de propagar el fallo. No por criterio: su único llamante es
 * `CiudadSheet.tsx`, y esa sesión está reescribiendo ese fichero ahora mismo,
 * así que tocarlo metería su trabajo a medias en este commit.
 *
 * Mientras tanto, **un éxito resuelve 200 sea cual sea el código real**. Sin
 * esa línea, en cuanto el servidor conteste 201 la pantalla diría «no se pudo»
 * sobre algo que sí se hizo, y la persona lo reintentaría. Cuando el otro
 * trabajo aterrice, esto pasa a `Promise<CiudadInterface>` como sus vecinas.
 */
export const createCiudad = (data: CiudadInterface): Promise<number> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = { name: data.name, image: data.image, lat: data.lat, lng: data.lng };
  return axios
    .post(urlApi + urlCiudad, newData)
    .then(() => 200)
    .catch(() => 400);
};

/**
 * Nota de C4, y es temporal.
 *
 * Ésta va con `createCiudad` por vecindad, no por necesidad: es un `PUT` y el
 * servidor le contesta 200 hoy y después de C4, así que el atajo no la está
 * salvando de ningún cambio de código. Lo que sí sigue haciendo es tragarse el
 * fallo, y por eso `CiudadSheet.tsx` todavía dice «No se pudo guardar los
 * cambios» donde el servidor había mandado una frase. Se arregla con su
 * pantalla, que es de la sesión del mapa.
 */
export const editCiudad = (data: CiudadInterface): Promise<number> => {
  return axios
    .put(urlApi + urlCiudad + data.id, data)
    .then(() => 200)
    .catch(() => 400);
};

export const deleteCiudad = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlCiudad + id)
    .then(() => undefined);
};

export const desarchivarCiudad = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlCiudad + id + "/desarchivar", {})
    .then(() => undefined);
};
