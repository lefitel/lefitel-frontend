import axios from "axios";
import { urlEventoObs, urlApi } from "./url";
import { EventoObsInterface } from "../interfaces/interfaces";

export const getEventoObs = (
  id_evento: number
): Promise<EventoObsInterface[]> => {
  return axios.get(urlApi + urlEventoObs + id_evento).then((response) => {
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

export const createEventoObs = (data: EventoObsInterface): Promise<number> => {
  //type EventoObsWithoutId = Omit<EventoObsInterface, "id">;
  const newData: EventoObsInterface = {
    id_evento: data.id_evento,
    id_obs: data.id_obs,
  };

  return axios
    .post(urlApi + urlEventoObs, newData)
    .then((response) => {
      console.log(response);
      return response.status;
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteEventoObs = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlEventoObs + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
