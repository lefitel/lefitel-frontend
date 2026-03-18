import axios from "axios";
import { urlRevicion, urlApi } from "./url";
import { RevicionInterface } from "../interfaces/interfaces";

export const getRevicion = (
  id_evento: number,
  token: string
): Promise<RevicionInterface[]> => {
  return axios
    .get(urlApi + urlRevicion + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};

export const createRevicion = (
  data: RevicionInterface,
  token: string
): Promise<number> => {
  const newData: RevicionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlRevicion, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      return response.status;
    })
    .catch(() => {
      return 400;
    });
};
