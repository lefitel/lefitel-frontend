import axios from "axios";
import { urlBitacora, urlApi } from "./url";
import { BitacoraInterface } from "../interfaces/interfaces";

export const getBitacora = (
  id_usuario: number,
  token: string,
  limit = 50
): Promise<BitacoraInterface[]> =>
  axios
    .get(urlApi + urlBitacora + id_usuario, {
      params: { limit },
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);

export interface BitacoraFilters {
  id_usuario?: number;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export const getAllBitacora = (
  filters: BitacoraFilters,
  token: string
): Promise<BitacoraInterface[]> =>
  axios
    .get(urlApi + urlBitacora, {
      params: filters,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
