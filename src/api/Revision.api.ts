import axios from "axios";
import { urlRevision, urlApi } from "./url";
import { RevisionInterface } from "../interfaces/interfaces";

export const getRevision = (
  id_evento: number,
  token: string
): Promise<RevisionInterface[]> => {
  return axios
    .get(urlApi + urlRevision + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};

export const createRevision = (
  data: RevisionInterface,
  token: string
): Promise<number> => {
  const newData: RevisionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlRevision, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      return response.status;
    })
    .catch(() => {
      return 400;
    });
};
