import axios from "axios";
import { urlAdss, urlApi } from "./url";
import { AdssInterface } from "../interfaces/interfaces";

export const getAdss = (token: string): Promise<AdssInterface[]> => {
  return axios
    .get(urlApi + urlAdss, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: AdssInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      return dataList;
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return [];
    });
};

export const createAdss = (
  data: AdssInterface,
  token: string
): Promise<number> => {
  //type AdssWithoutId = Omit<AdssInterface, "id">;
  const newData: AdssInterface = {
    name: data.name,
    description: data.description,
  };

  return axios
    .post(urlApi + urlAdss, newData, {
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

export const editAdss = (
  data: AdssInterface,
  token: string
): Promise<number> => {
  return axios
    .put(urlApi + urlAdss + data.id, data, {
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

export const deleteAdss = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlAdss + id, {
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
