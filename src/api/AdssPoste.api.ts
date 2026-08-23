import axios from "axios";
import { urlAdssPoste, urlApi } from "./url";
import { AdssPosteInterface } from "../interfaces/interfaces";

export const getAdssPoste = (id_poste: number): Promise<AdssPosteInterface[]> => {
  return axios
    .get(urlApi + urlAdssPoste + id_poste)
    .then((r) => r.data);
};
