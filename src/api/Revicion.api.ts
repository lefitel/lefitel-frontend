import axios from "axios";
import { urlRevicion, urlApi } from "./url";
import { RevicionInterface } from "../interfaces/interfaces";
import { revicionExample } from "../data/example";

export const getRevicion = (
  id_evento: number,
  token: string
): Promise<RevicionInterface[]> => {
  return axios
    .get(urlApi + urlRevicion + id_evento, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: RevicionInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          description: item.description,
          date: item.date,
          id_evento: item.id_evento,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      return dataList;
    });
};

export const createRevicion = (
  data: RevicionInterface,
  token: string
): Promise<number> => {
  //type RevicionWithoutId = Omit<RevicionInterface, "id">;
  const newData: RevicionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlRevicion, newData, {
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

export const editRevicion = (
  data: RevicionInterface,
  token: string
): Promise<{ status: number; data: RevicionInterface }> => {
  return axios
    .put(urlApi + urlRevicion + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: revicionExample };
    });
};

export const deleteRevicion = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlRevicion + id, {
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
