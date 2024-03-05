import axios from "axios";
import { urlMaterial, urlApi } from "./url";
import { MaterialInterface } from "../interfaces/interfaces";

export const getMaterial = (token: string): Promise<MaterialInterface[]> => {
  return axios
    .get(urlApi + urlMaterial, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: MaterialInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const createMaterial = (
  data: MaterialInterface,
  token: string
): Promise<number> => {
  type MaterialWithoutId = Omit<MaterialInterface, "id">;
  const newData: MaterialWithoutId = {
    name: data.name,
    description: data.description,
  };

  return axios
    .post(urlApi + urlMaterial, newData, {
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

export const editMaterial = (
  data: MaterialInterface,
  token: string
): Promise<number> => {
  return axios
    .put(urlApi + urlMaterial + data.id, data, {
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

export const deleteMaterial = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlMaterial + id, {
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
