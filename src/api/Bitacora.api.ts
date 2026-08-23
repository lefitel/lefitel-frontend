import axios from "axios";
import { urlBitacora, urlApi } from "./url";
import { BitacoraInterface } from "../interfaces/interfaces";

export const getBitacora = (
  id_usuario: number,
  limit = 50
): Promise<BitacoraInterface[]> =>
  axios
    .get(urlApi + urlBitacora + id_usuario, {
      params: { limit },
    })
    .then((r) => r.data);

export interface BitacoraFilters {
  id_usuario?: number;
  action?: string;
  entity?: string;
  entity_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  severity?: string;
  sortBy?: string[];
  sortOrder?: ('asc' | 'desc')[];
}

export const getAllBitacora = (
  filters: BitacoraFilters
): Promise<{ data: BitacoraInterface[]; total: number }> =>
  axios
    .get(urlApi + urlBitacora, {
      params: filters,
    })
    .then((r) => r.data);
