import axios from "axios";
import { urlSolucion, urlApi, urlEvento } from "./url";
import { SolucionInterface } from "../interfaces/interfaces";

export const getSolucion_evento = (
  id_evento: number
): Promise<SolucionInterface> => {
  return axios
    .get(urlApi + urlSolucion + urlEvento + id_evento)
    .then((response) => {
      const data: SolucionInterface = response.data;
      return data;
    });
};
