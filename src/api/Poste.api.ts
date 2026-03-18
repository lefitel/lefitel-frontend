import axios from "axios";
import { urlPoste, urlApi } from "./url";
import { PosteInterface } from "../interfaces/interfaces";
import { posteExample } from "../data/example";

export const getPoste = (token: string, archived = false): Promise<PosteInterface[]> => {
  return axios
    .get(urlApi + urlPoste, {
      headers: { Authorization: `Bearer ${token}` },
      params: archived ? { archived: true } : {},
    })
    .then((r) => r.data);
};

export const getPosteByCiudad = (ciudadId: number, token: string): Promise<PosteInterface[]> =>
  axios
    .get(`${urlApi}${urlPoste}?ciudadId=${ciudadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data as PosteInterface[]);

export const getPosteByTramo = (
  ciudadA: number,
  ciudadB: number,
  token: string
): Promise<PosteInterface[]> => {
  return axios
    .get(`${urlApi}${urlPoste}?ciudadA=${ciudadA}&ciudadB=${ciudadB}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => response.data as PosteInterface[]);
};

export const createPoste = (
  data: PosteInterface,
  token: string
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .post(urlApi + urlPoste, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: posteExample }));
};

export const searchPoste = (dataId: number, token: string): Promise<PosteInterface> => {
  return axios
    .get(urlApi + urlPoste + dataId, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.data as PosteInterface);
};

export const editPoste = (
  data: PosteInterface,
  token: string
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .put(urlApi + urlPoste + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(() => ({ status: 400, data: posteExample }));
};

export const deletePoste = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlPoste + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarPoste = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlPoste + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
