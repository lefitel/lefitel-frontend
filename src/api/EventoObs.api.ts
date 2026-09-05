import { urlApi, urlEvento } from "./url";
import { todasLasFilas } from "./listado";
import { EventoObsInterface } from "../interfaces/interfaces";

/**
 * The observations recorded on one incident.
 *
 * `GET /api/evento/:id/obs` since D1, and `obs` rather than `observaciones`:
 * §3.4 keeps that abbreviation, because it is what the models and the column
 * names say and unpicking it would cross into the database.
 */
export const getEventoObs = (id_evento: number): Promise<EventoObsInterface[]> =>
  todasLasFilas<EventoObsInterface>(`${urlApi}${urlEvento}${id_evento}/obs`);
