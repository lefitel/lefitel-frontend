import axios from "axios";
import { urlSolucion, urlApi, urlEvento } from "./url";
import { SolucionInterface } from "../interfaces/interfaces";

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
