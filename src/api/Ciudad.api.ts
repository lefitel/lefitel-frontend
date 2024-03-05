import axios from "axios";
import { urlCiudad, urlApi } from "./url";
import { CiudadInterface } from "../interfaces/interfaces";

export const getCiudad = (token: string): Promise<CiudadInterface[]> => {
  return axios
    .get(urlApi + urlCiudad, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: CiudadInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const createCiudad = (
  data: CiudadInterface,
  token: string
): Promise<number> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = {
    name: data.name,
    lat: data.lat,
    lng: data.lng,
  };

  return axios
    .post(urlApi + urlCiudad, newData, {
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

export const editCiudad = (
  data: CiudadInterface,
  token: string
): Promise<number> => {
  return axios
    .put(urlApi + urlCiudad + data.id, data, {
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

export const deleteCiudad = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlCiudad + id, {
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
