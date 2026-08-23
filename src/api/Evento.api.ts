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
  archived?: boolean;
  sortBy?: string[];
  sortOrder?: ('asc' | 'desc')[];
  filters?: { column: string; value: string }[];
}

export const getEvento = (params: GetEventoParams = {}): Promise<EventoPaginatedResponse> => {
  const { archived, filters, ...rest } = params;
  return axios
    .get(urlApi + urlEvento, {
      params: {
        ...(archived ? { archived: true } : {}),
        ...(filters?.length ? {
          filterColumn: filters.map(f => f.column),
          filterValue: filters.map(f => f.value),
        } : {}),
        ...rest,
      },
    })
    .then((r) => r.data);
};

export const exportEventos = (archived = false): Promise<EventoInterface[]> =>
  axios
    .get(urlApi + urlEvento, {
      params: { export: true, ...(archived ? { archived: true } : {}) },
    })
    .then((r) => r.data);

export const getEvento_usuario = (id_usuario: number): Promise<EventoInterface[]> =>
  axios
    .get(urlApi + urlEvento + "usuario/" + id_usuario)
    .then((r) => r.data);

export const getEvento_poste = (id_poste: number): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlEvento + urlPoste + id_poste)
    .then((r) => r.data);
};

export const createEvento = (
  data: EventoInterface
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
    ...(data.obs_ids ? { obs_ids: data.obs_ids } : {}),
    ...(data.revision ? { revision: data.revision } : {}),
  };
  return axios
    .post(urlApi + urlEvento, newData)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: eventoExample }));
};

export const searchEvento = (dataId: number): Promise<EventoInterface> => {
  return axios
    .get(urlApi + urlEvento + dataId)
    .then((response) => response.data as EventoInterface);
};

export const editEvento = (
  data: EventoInterface
): Promise<{ status: number; data: EventoInterface }> => {
  return axios
    .put(urlApi + urlEvento + data.id, data)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: eventoExample }));
};

export const reabrirEvento = (id: number): Promise<number> =>
  axios
    .post(urlApi + urlEvento + id + "/reabrir", {})
    .then((r) => r.status)
    .catch(() => 400);

export const resolverEvento = (
  id: number,
  data: { description: string; date: Date; image: string }
): Promise<number> =>
  axios
    .post(urlApi + urlEvento + id + "/resolver", data)
    .then((r) => r.status)
    .catch(() => 400);

export const deleteEvento = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlEvento + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarEvento = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlEvento + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
