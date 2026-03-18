import axios from "axios";
import { urlAdssPoste, urlApi } from "./url";
import { AdssPosteInterface } from "../interfaces/interfaces";

export const getAdssPoste = (id_poste: number, token: string): Promise<AdssPosteInterface[]> => {
  return axios
    .get(urlApi + urlAdssPoste + id_poste, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};

export const createAdssPoste = (data: AdssPosteInterface, token: string): Promise<number> => {
  const newData: AdssPosteInterface = { id_adss: data.id_adss, id_poste: data.id_poste };
  return axios
    .post(urlApi + urlAdssPoste, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const deleteAdssPoste = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlAdssPoste + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
