import axios from "axios";
import { urlPoste, urlApi } from "./url";
import { PosteInterface } from "../interfaces/interfaces";
import { comoParametros, ListParams, Paginado, pedirListado, todasLasFilas } from "./listado";
import { descargarListado, type FormatoDescarga } from "./descarga";

// `PostePaginatedResponse` and `GetPosteParams` are gone, and so are their twins
// in `Evento.api.ts`: two pairs of declarations that were identical field for
// field. They are `Paginado<T>` and `ListParams` now — see `listado.ts`, which
// also explains what a single `ListParams` cannot say and the server does not
// either: neither endpoint errors on a column it does not know, it ignores it.

export const getPoste = (params: ListParams = {}): Promise<Paginado<PosteInterface>> =>
  pedirListado<PosteInterface>(urlApi + urlPoste, comoParametros(params));

/**
 * The pole list as a file the server builds.
 *
 * The browser used to build it: download every row as JSON, then assemble the
 * spreadsheet with ExcelJS, the document with jsPDF, and the CSV by hand — the
 * same two hundred lines living in this screen, the incident screen and the
 * security screen, drifting apart. What arrives here now is bytes.
 *
 * **It takes the screen's own filters**, which the old button did not: it
 * downloaded the whole table whatever you were looking at, so filtering to one
 * stretch and pressing Excel gave you all 1.687 poles under a heading that said
 * nothing about it. The parameters are the listing's, so the file and the page
 * are answering the same question.
 */
export const exportarPostes = (
  formato: FormatoDescarga,
  params: ListParams = {},
): Promise<{ blob: Blob; filename: string }> =>
  descargarListado(urlApi + urlPoste + "export", { ...comoParametros(params), format: formato });

/**
 * Every pole, and an error rather than some of them.
 *
 * Called `exportPostes` until the exports moved to the server, which left the
 * name describing something it no longer did — and it had never been quite
 * true: eight of its fourteen callers used it to mean "all the rows" and
 * exported nothing. One caller is left, the pole picker in the incident sheet,
 * and it wants exactly that.
 *
 * `limit=all` where `?export=true` used to be: that parameter changed the
 * **type** of the response on the same URL, which is the one thing §3.3 exists
 * to stop. `todasLasFilas` refuses an answer that came back short.
 */
export const todosLosPostes = (archived = false): Promise<PosteInterface[]> =>
  todasLasFilas<PosteInterface>(urlApi + urlPoste, archived ? { archived: true } : {});

/** Every pole of one city — for the counters on its sheet, not for a file. */
export const getPosteByCiudad = (ciudadId: number): Promise<PosteInterface[]> =>
  todasLasFilas<PosteInterface>(urlApi + urlPoste, { ciudadId });

/**
 * Every pole of one tramo.
 *
 * The two `as PosteInterface[]` this and its sibling above used to carry were
 * assertions, not inferences: when the response changed shape they would have
 * kept the compiler quiet and failed at runtime in five places, one of them
 * behind an empty `.catch` where nothing at all would have shown.
 */
export const getPostesDelTramo = (idTramo: number): Promise<PosteInterface[]> =>
  todasLasFilas<PosteInterface>(urlApi + urlPoste, { tramo: idTramo });

/** Registra un poste y deja viajar el fallo. Contesta 201 desde C4. */
export const createPoste = (data: PosteInterface): Promise<PosteInterface> => {
  return axios
    .post<PosteInterface>(urlApi + urlPoste, data)
    .then((response) => response.data);
};

export const searchPoste = (dataId: number): Promise<PosteInterface> => {
  return axios
    .get(urlApi + urlPoste + dataId)
    .then((response) => response.data as PosteInterface);
};

/**
 * Edita un poste y deja viajar el fallo.
 *
 * 🔴 **Tiene tres llamantes y dos de ellos pintan la fila antes de preguntar.**
 * `poste/index.tsx` la usa dos veces para cambiar el material y el propietario
 * desde la propia tabla. Mientras esta función se tragaba el fallo, aquello no
 * tenía `try` ninguno; ahora el revert vive en un `catch` y el identificador de
 * «guardando» se limpia en un `finally`. Sin las dos cosas, un rechazo del
 * servidor deja la fila con el material que no se guardó y el desplegable
 * deshabilitado para siempre.
 */
export const editPoste = (data: PosteInterface): Promise<PosteInterface> => {
  return axios
    .put<PosteInterface>(urlApi + urlPoste + data.id, data)
    .then((response) => response.data);
};

export const deletePoste = (id: number): Promise<void> => {
  return axios
    .delete(urlApi + urlPoste + id)
    .then(() => undefined);
};

export const desarchivarPoste = (id: number): Promise<void> => {
  return axios
    .patch(urlApi + urlPoste + id + "/restore", {})
    .then(() => undefined);
};
