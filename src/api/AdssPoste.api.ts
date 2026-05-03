import axios from "axios";
import { urlAdssPoste, urlApi } from "./url";
import { AdssPosteInterface } from "../interfaces/interfaces";

export const getAdssPoste = (id_poste: number, token: string): Promise<AdssPosteInterface[]> => {
  return axios
    .get(urlApi + urlAdssPoste + id_poste, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};
