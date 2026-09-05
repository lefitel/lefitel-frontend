import axios from "axios";
import { urlRevision, urlApi, urlEvento } from "./url";
import { todasLasFilas } from "./listado";
import { RevisionInterface } from "../interfaces/interfaces";

/**
 * The inspections carried out on one incident.
 *
 * `GET /api/evento/:id/revisiones` since D1. At its old address,
 * `GET /api/revision/5` returned the inspections **of incident 5** and not
 * inspection 5 — the parameter named the parent — which is the confusion §3.2
 * exists to remove.
 *
 * 🔴 `urlRevision` is still imported and still right for `createRevision`
 * below: `POST /api/revision/` did not move. Renaming the constant would
 * break recording an inspection.
 */
export const getRevision = (
  id_evento: number
): Promise<RevisionInterface[]> =>
  todasLasFilas<RevisionInterface>(`${urlApi}${urlEvento}${id_evento}/revisiones`);

/**
 * Records one inspection, and lets the failure travel.
 *
 * It used to hand back a status number, and before that a flat 400 for
 * everything — which threw away the one thing the caller needed: a 403 means
 * this account may not record inspections and no amount of retrying will help,
 * while a 500 or a dead connection means try again. Rejecting keeps that
 * distinction and adds the server's own sentence, which the number never
 * carried. The status is still readable where it matters, off
 * `error.normalized`.
 */
export const createRevision = (
  data: RevisionInterface
): Promise<RevisionInterface> => {
  const newData: RevisionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post<RevisionInterface>(urlApi + urlRevision, newData)
    .then((response) => response.data);
};
