import axios from "axios";
import { urlRevision, urlApi } from "./url";
import { RevisionInterface } from "../interfaces/interfaces";

export const getRevision = (
  id_evento: number
): Promise<RevisionInterface[]> => {
  return axios
    .get(urlApi + urlRevision + id_evento)
    .then((r) => r.data);
};

export const createRevision = (
  data: RevisionInterface
): Promise<number> => {
  const newData: RevisionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlRevision, newData)
    .then((response) => {
      return response.status;
    })
    .catch((error: unknown) => {
      /**
       * The status the server actually sent, or 0 if it never answered.
       *
       * This used to flatten everything to 400, which threw away the only thing
       * the caller needed to tell a refusal from a breakage: a 403 means this
       * account may not record inspections and no amount of retrying will help,
       * while a 500 or a dead connection means try again. The dialog now says
       * which of those happened, so 0 has to be distinguishable from a real
       * status rather than dressed up as one.
       */
      const status = (error as { response?: { status?: number } })?.response?.status;
      return typeof status === "number" ? status : 0;
    });
};
