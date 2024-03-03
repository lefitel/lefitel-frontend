import axios from "axios";
import { urlEvento, urlApi } from "./url";
import { EventoInterface } from "../interfaces/interfaces";
import { eventoExample } from "../data/example";

export const getEvento = (id_poste: number): Promise<EventoInterface[]> => {
  return axios.get(urlApi + urlEvento + id_poste).then((response) => {
    const dataList: EventoInterface[] = response.data.map((item: any) => {
      // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
      return {
        id: item.id,
        description: item.description,
        image: item.image,
        state: item.state,
        id_poste: item.id_poste,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
    //console.log(dataList);
    return dataList;
  });
};

export const createEvento = (
  data: EventoInterface
): Promise<{ status: number; data: EventoInterface }> => {
  type EventoWithoutId = Omit<EventoInterface, "id">;
  const newData: EventoWithoutId = {
    description: data.description,
    image: data.image,
    state: data.state,
    id_poste: data.id_poste,
  };

  return axios
    .post(urlApi + urlEvento, newData)
    .then((response) => {
      //console.log(response);

      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: eventoExample };
    });
};

export const searchEvento = (dataId: number): Promise<EventoInterface> => {
  return axios.get(urlApi + urlEvento + dataId).then((response) => {
    const data: EventoInterface = response.data;
    //console.log(data);
    return data;
  });
};

export const editEvento = (
  data: EventoInterface
): Promise<{ status: number; data: EventoInterface }> => {
  return axios
    .put(urlApi + urlEvento + data.id, data)
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: eventoExample };
    });
};

export const deleteEvento = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlEvento + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};