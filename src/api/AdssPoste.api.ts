import { urlAdssPoste, urlApi } from "./url";
import { todasLasFilas } from "./listado";
import { AdssPosteInterface } from "../interfaces/interfaces";

export const getAdssPoste = (id_poste: number): Promise<AdssPosteInterface[]> =>
  todasLasFilas<AdssPosteInterface>(urlApi + urlAdssPoste + id_poste);
