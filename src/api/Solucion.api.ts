import axios from "axios";
import { urlSolucion, urlApi, urlEvento } from "./url";
import { SolucionInterface } from "../interfaces/interfaces";
import { solucionExample } from "../data/example";

export const getSolucion = (token: string): Promise<SolucionInterface[]> => {
  return axios
    .get(urlApi + urlSolucion, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: SolucionInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          description: item.description,
          image: item.image,
          date: item.date,
          id_evento: item.id_evento,

          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const getSolucion_evento = (
  id_evento: number,
  token: string
): Promise<SolucionInterface> => {
  return axios
    .get(urlApi + urlSolucion + urlEvento + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: SolucionInterface = response.data;
      return data;
    });
};

export const createSolucion = (
  data: SolucionInterface,
  token: string
): Promise<{ status: number; data: SolucionInterface }> => {
  type SolucionWithoutId = Omit<SolucionInterface, "id">;
  const newData: SolucionWithoutId = {
    description: data.description,
    image: data.image,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlSolucion, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);

      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: solucionExample };
    });
};

export const searchSolucion = (
  dataId: number,
  token: string
): Promise<SolucionInterface> => {
  return axios
    .get(urlApi + urlSolucion + dataId, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: SolucionInterface = response.data;
      //console.log(data);
      return data;
    });
};

export const editSolucion = (
  data: SolucionInterface,
  token: string
): Promise<{ status: number; data: SolucionInterface }> => {
  return axios
    .put(urlApi + urlSolucion + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: solucionExample };
    });
};

export const deleteSolucion = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlSolucion + id, {
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
