import axios from "axios";
import { urlPoste, urlApi } from "./url";
import { PosteInterface } from "../interfaces/interfaces";
import { posteExample } from "../data/example";

export interface PostePaginatedResponse {
  data: PosteInterface[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface GetPosteParams {
  page?: number;
  limit?: number;
  archived?: boolean;
  sortBy?: string[];
  sortOrder?: ('asc' | 'desc')[];
  filters?: { column: string; value: string }[];
}

export const getPoste = (params: GetPosteParams = {}): Promise<PostePaginatedResponse> => {
  const { archived, filters, ...rest } = params;
  return axios
    .get(urlApi + urlPoste, {
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

export const exportPostes = (archived = false): Promise<PosteInterface[]> =>
  axios
    .get(urlApi + urlPoste, {
      params: { export: true, ...(archived ? { archived: true } : {}) },
    })
    .then((r) => r.data);

export const getPosteByCiudad = (ciudadId: number): Promise<PosteInterface[]> =>
  axios
    .get(`${urlApi}${urlPoste}?ciudadId=${ciudadId}&export=true`)
    .then((r) => r.data as PosteInterface[]);

export interface TramoPair {
  id_ciudadA: number;
  id_ciudadB: number;
}

export const getTramos = (): Promise<TramoPair[]> =>
  axios
    .get(`${urlApi}${urlPoste}tramos`)
    .then((r) => r.data as TramoPair[]);

export const getPosteByTramo = (
  ciudadA: number,
  ciudadB: number
): Promise<PosteInterface[]> => {
  return axios
    .get(`${urlApi}${urlPoste}?ciudadA=${ciudadA}&ciudadB=${ciudadB}&export=true`)
    .then((response) => response.data as PosteInterface[]);
};

export const createPoste = (
  data: PosteInterface
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .post(urlApi + urlPoste, data)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: posteExample }));
};

export const searchPoste = (dataId: number): Promise<PosteInterface> => {
  return axios
    .get(urlApi + urlPoste + dataId)
    .then((response) => response.data as PosteInterface);
};

export const editPoste = (
  data: PosteInterface
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .put(urlApi + urlPoste + data.id, data)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: posteExample }));
};

export const deletePoste = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlPoste + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarPoste = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlPoste + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
