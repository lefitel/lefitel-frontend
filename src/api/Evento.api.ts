import axios from "axios";
import { urlEvento, urlApi, urlPoste } from "./url";
import { EventoInterface } from "../interfaces/interfaces";
import { eventoExample } from "../data/example";

export const getEvento = (token: string): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlEvento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: EventoInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          description: item.description,
          image: item.image,
          state: item.state,
          date: item.date,

          id_poste: item.id_poste,
          id_usuario: item.id_usuario,

          poste: item.poste,
          revicions: item.revicions,
          usuario: item.usuario,

          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      console.log(dataList[0]);
      console.log(response.data[0]);

      return dataList;
    });
};

export const getEvento_poste = (
  id_poste: number,
  token: string
): Promise<EventoInterface[]> => {
  return axios
    .get(urlApi + urlEvento + urlPoste + id_poste, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: EventoInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          description: item.description,
          image: item.image,
          state: item.state,
          date: item.date,

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
  data: EventoInterface,
  token: string
): Promise<{ status: number; data: EventoInterface }> => {
  type EventoWithoutId = Omit<EventoInterface, "id">;
  const newData: EventoWithoutId = {
    description: data.description,
    image: data.image,
    date: data.date,
    state: data.state,
    id_poste: data.id_poste,
    id_usuario: data.id_usuario,
  };

  return axios
    .post(urlApi + urlEvento, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);

      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: eventoExample };
    });
};

export const searchEvento = (
  dataId: number,
  token: string
): Promise<EventoInterface> => {
  return axios
    .get(urlApi + urlEvento + dataId, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: EventoInterface = response.data;
      //console.log(data);
      return data;
    });
};

export const editEvento = (
  data: EventoInterface,
  token: string
): Promise<{ status: number; data: EventoInterface }> => {
  return axios
    .put(urlApi + urlEvento + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: eventoExample };
    });
};

export const deleteEvento = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlEvento + id, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
