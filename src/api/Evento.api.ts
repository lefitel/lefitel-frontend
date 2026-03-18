import axios from "axios";
import { urlEvento, urlApi, urlPoste } from "./url";
import { EventoInterface } from "../interfaces/interfaces";
import { eventoExample } from "../data/example";

export interface EventoPaginatedResponse {
  data: EventoInterface[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface GetEventoParams {
  page?: number;
  limit?: number;
  filterColumn?: string;
  filterValue?: string;
  archived?: boolean;
}

export const getEvento = (token: string, params: GetEventoParams = {}): Promise<EventoPaginatedResponse> => {
  const { archived, ...rest } = params;
  return axios
    .get(urlApi + urlEvento, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ...(archived ? { archived: true } : {}), ...rest },
    })
    .then((r) => r.data);
};

export const exportEventos = (token: string, archived = false): Promise<EventoInterface[]> =>
  axios
    .get(urlApi + urlEvento, {
      headers: { Authorization: `Bearer ${token}` },
      params: { export: true, ...(archived ? { archived: true } : {}) },
    })
    .then((r) => r.data);

export const getEvento_usuario = (id_usuario: number, token: string): Promise<EventoInterface[]> =>
  axios
    .get(urlApi + urlEvento + "usuario/" + id_usuario, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);

export const getEvento_poste = (id_poste: number, token: string): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlEvento + urlPoste + id_poste, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};

export const createEvento = (
  data: EventoInterface,
  token: string
): Promise<{ status: number; data: EventoInterface }> => {
  type EventoWithoutId = Omit<EventoInterface, "id">;
  const newData: EventoWithoutId = {
    description: data.description,
    image: data.image,
    date: data.date,
    state: data.state,
    id_poste: data.id_poste,
    priority: data.priority,
    id_usuario: data.id_usuario,
  };
  return axios
    .post(urlApi + urlEvento, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: eventoExample }));
};

export const searchEvento = (dataId: number, token: string): Promise<EventoInterface> => {
  return axios
    .get(urlApi + urlEvento + dataId, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.data as EventoInterface);
};

export const editEvento = (
  data: EventoInterface,
  token: string
): Promise<{ status: number; data: EventoInterface }> => {
  return axios
    .put(urlApi + urlEvento + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: eventoExample }));
};

export const reabrirEvento = (id: number, token: string): Promise<number> =>
  axios
    .post(urlApi + urlEvento + id + "/reabrir", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.status)
    .catch(() => 400);

export const deleteEvento = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlEvento + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarEvento = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlEvento + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
