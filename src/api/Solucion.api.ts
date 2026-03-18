import axios from "axios";
import { urlSolucion, urlApi, urlEvento } from "./url";
import { SolucionInterface } from "../interfaces/interfaces";
import { solucionExample } from "../data/example";

export const getSolucion_evento = (
  id_evento: number,
  token: string
): Promise<SolucionInterface> => {
  return axios
    .get(urlApi + urlSolucion + urlEvento + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: SolucionInterface = response.data;
      return data;
    });
};

export const createSolucion = (
  data: SolucionInterface,
  token: string
): Promise<{ status: number; data: SolucionInterface }> => {
  type SolucionWithoutId = Omit<SolucionInterface, "id">;
  const newData: SolucionWithoutId = {
    description: data.description,
    image: data.image,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlSolucion, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      return { status: response.status, data: response.data };
    })
    .catch(() => ({ status: 400, data: solucionExample }));
};
