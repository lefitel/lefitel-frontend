import axios from "axios";
import { urlAdss, urlApi } from "./url";
import { AdssInterface } from "../interfaces/interfaces";

export const getAdss = (token: string, archived = false): Promise<AdssInterface[]> => {
  const url = urlApi + urlAdss + (archived ? "?archived=true" : "");
  return axios
    .get(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data)
    .catch(() => []);
};

export const createAdss = (data: AdssInterface, token: string): Promise<number> => {
  const newData: AdssInterface = { name: data.name, description: data.description };
  return axios
    .post(urlApi + urlAdss, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editAdss = (data: AdssInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlAdss + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteAdss = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlAdss + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarAdss = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlAdss + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
