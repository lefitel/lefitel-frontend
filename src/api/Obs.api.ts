import axios from "axios";
import { urlObs, urlApi } from "./url";
import { ObsInterface } from "../interfaces/interfaces";

export const getObs = (token: string): Promise<ObsInterface[]> => {
  return axios
    .get(urlApi + urlObs, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      const dataList: ObsInterface[] = response.data.map((item: any) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          id_tipoObs: item.id_tipoObs,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const createObs = (
  data: ObsInterface,
  token: string
): Promise<number> => {
  type ObsWithoutId = Omit<ObsInterface, "id">;
  const newData: ObsWithoutId = {
    name: data.name,
    description: data.description,
    id_tipoObs: data.id_tipoObs,
  };

  return axios
    .post(urlApi + urlObs, newData, {
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

export const editObs = (data: ObsInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlObs + data.id, data, {
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

export const deleteObs = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlObs + id, {
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
