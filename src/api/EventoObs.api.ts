import axios from "axios";
import { urlEventoObs, urlApi } from "./url";
import { EventoObsInterface } from "../interfaces/interfaces";

export const getEventoObs = (id_evento: number, token: string): Promise<EventoObsInterface[]> => {
  return axios
    .get(urlApi + urlEventoObs + id_evento, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const createEventoObs = (data: EventoObsInterface, token: string): Promise<number> => {
  const newData: EventoObsInterface = { id_evento: data.id_evento, id_obs: data.id_obs };
  return axios
    .post(urlApi + urlEventoObs, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteEventoObs = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlEventoObs + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
