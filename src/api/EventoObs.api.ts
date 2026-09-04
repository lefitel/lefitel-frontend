import { urlEventoObs, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { EventoObsInterface } from "../interfaces/interfaces";

export const getEventoObs = (id_evento: number): Promise<EventoObsInterface[]> =>
  todasLasFilas<EventoObsInterface>(urlApi + urlEventoObs + id_evento);
