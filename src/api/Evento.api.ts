import axios from "axios";
import { urlEvento, urlApi, urlPoste } from "./url";
import { EventoInterface } from "../interfaces/interfaces";
import { comoParametros, ListParams, Paginado, pedirListado, todasLasFilas } from "./listado";
import { descargarListado, type FormatoDescarga } from "./descarga";

export const getEvento = (params: ListParams = {}): Promise<Paginado<EventoInterface>> =>
  pedirListado<EventoInterface>(urlApi + urlEvento, comoParametros(params));

/**
 * The incident list as a file the server builds. See `exportarPostes`.
 *
 * The three quick filters above the table — Estado, Gravedad, Prioritario —
 * travel with it, which is the whole point: this is the screen where the old
 * button was worst. Four rows on screen, 1.514 in the file, and a heading that
 * read "Eventos del Sistema" either way.
 */
export const exportarEventos = (
  formato: FormatoDescarga,
  params: ListParams = {},
): Promise<{ blob: Blob; filename: string }> =>
  descargarListado(urlApi + urlEvento + "export", { ...comoParametros(params), format: formato });

/**
 * Every incident one person has registered.
 *
 * The count check matters more here than anywhere. Both the profile screen and
 * the staff detail screen divide the resolved ones by `length` and print the
 * result as a percentage — so a list truncated at fifty did not look truncated,
 * it looked like an appraisal of somebody's work.
 */
export const getEvento_usuario = (id_usuario: number): Promise<EventoInterface[]> =>
  todasLasFilas<EventoInterface>(urlApi + urlEvento + "usuario/" + id_usuario);

/**
 * Every incident on one pole.
 *
 * Read by the pole list before archiving: "no se puede archivar, tiene eventos
 * asociados" is a guard that exists **only in the browser** — the server does
 * not check it — and it is written as `eventos.length > 0`. Against a shape it
 * cannot read, that is `undefined > 0`, which is false, and the pole would be
 * archived with its incidents still hanging off it.
 */
export const getEvento_poste = (id_poste: number): Promise<EventoInterface[]> =>
  todasLasFilas<EventoInterface>(urlApi + urlEvento + urlPoste + id_poste);

export const createEvento = (data: EventoInterface): Promise<EventoInterface> => {
  type EventoWithoutId = Omit<EventoInterface, "id">;
  const newData: EventoWithoutId = {
    description: data.description,
    image: data.image,
    date: data.date,
    state: data.state,
    id_poste: data.id_poste,
    priority: data.priority,
    id_usuario: data.id_usuario,
    ...(data.obs_ids ? { obs_ids: data.obs_ids } : {}),
    ...(data.revision ? { revision: data.revision } : {}),
  };
  return axios
    .post<EventoInterface>(urlApi + urlEvento, newData)
    .then((response) => response.data);
};

export const searchEvento = (dataId: number): Promise<EventoInterface> => {
  return axios
    .get(urlApi + urlEvento + dataId)
    .then((response) => response.data as EventoInterface);
};

export const editEvento = (data: EventoInterface): Promise<EventoInterface> => {
  return axios
    .put<EventoInterface>(urlApi + urlEvento + data.id, data)
    .then((response) => response.data);
};

/**
 * Nota de C4, y es temporal.
 *
 * Ésta es una de las cinco funciones de esta carpeta que siguen devolviendo un
 * número en vez de propagar el fallo. No por criterio: la llama
 * `EventoDetallePage.tsx`, y esa sesión está reescribiendo ese fichero ahora
 * mismo, así que tocarlo metería su trabajo a medias en este commit.
 *
 * Mientras tanto, **un éxito resuelve 200 sea cual sea el código real**. Sin
 * esa línea, en cuanto el servidor conteste 204 la pantalla diría «no se pudo»
 * sobre algo que sí se hizo, y la persona lo reintentaría.
 *
 * **Tiene tres llamantes, no uno**, y los otros dos están en ficheros libres:
 * `evento/index.tsx` y `usePosteDetalleData.ts`. Los tres pasan a
 * `Promise<void>` de una vez cuando el fichero bloqueado se suelte; convertir
 * sólo los libres significaría dos formas del mismo verbo a la vez.
 */
export const reabrirEvento = (id: number): Promise<number> =>
  axios
    .post(urlApi + urlEvento + id + "/reabrir", {})
    .then(() => 200)
    .catch(() => 400);

export const resolverEvento = (
  id: number,
  data: { description: string; date: Date; image: string }
): Promise<void> =>
  axios
    .post(urlApi + urlEvento + id + "/resolver", data)
    .then(() => undefined);

export const deleteEvento = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlEvento + id)
    .then(() => undefined);
};

export const desarchivarEvento = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlEvento + id + "/desarchivar", {})
    .then(() => undefined);
};
