import axios from "axios";
import { urlEventoObs, urlApi } from "./url";
import { EventoObsInterface } from "../interfaces/interfaces";

export const getEventoObs = (id_evento: number): Promise<EventoObsInterface[]> => {
  return axios
    .get(urlApi + urlEventoObs + id_evento)
    .then((r) => r.data);
};
