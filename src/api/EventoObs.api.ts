import axios from "axios";
import { urlEventoObs, urlApi } from "./url";
import { EventoObsInterface } from "../interfaces/interfaces";

export const getEventoObs = (
  id_evento: number,
  token: string
): Promise<EventoObsInterface[]> => {
  return axios
    .get(urlApi + urlEventoObs + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const dataList: EventoObsInterface[] = response.data.map((item: any) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          id_evento: item.id_evento,
          id_obs: item.id_obs,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      return dataList;
    });
};

export const createEventoObs = (
  data: EventoObsInterface,
  token: string
): Promise<number> => {
  //type EventoObsWithoutId = Omit<EventoObsInterface, "id">;
  const newData: EventoObsInterface = {
    id_evento: data.id_evento,
    id_obs: data.id_obs,
  };

  return axios
    .post(urlApi + urlEventoObs, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      console.log(response);
      return response.status;
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteEventoObs = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlEventoObs + id, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
