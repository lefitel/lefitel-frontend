import axios from "axios";
import { urlApi, urlEvento } from "./url";
import { SolucionInterface } from "../interfaces/interfaces";

/**
 * The repair of one incident, or `null` when it has not been repaired.
 *
 * `GET /api/evento/:id/solucion` since D1, and the mount it used to have is
 * gone with it — that router had one route left.
 *
 * 🔴 **Both callers of this wrap it in `.catch(() => null)`**, and `null` is
 * also the ordinary success answer. So any failure here is indistinguishable
 * from "not repaired yet": every resolved incident would quietly read as
 * pending, on the detail screen and in the edit sheet, with nothing in the
 * console. `solucion.evento.test.ts` in the API is what watches the address.
 */
export const getSolucion_evento = (
  id_evento: number
): Promise<SolucionInterface> => {
  return axios
    .get(`${urlApi}${urlEvento}${id_evento}/solucion`)
    .then((response) => {
      const data: SolucionInterface = response.data;
      return data;
    });
};
