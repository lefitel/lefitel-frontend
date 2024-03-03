import axios from "axios";
import { urlCiudad, urlApi } from "./url";
import { CiudadInterface } from "../interfaces/interfaces";

export const getCiudad = (): Promise<CiudadInterface[]> => {
  return axios.get(urlApi + urlCiudad).then((response) => {
    const dataList: CiudadInterface[] = response.data.map((item: any) => {
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

export const createCiudad = (data: CiudadInterface): Promise<number> => {
  type CiudadWithoutId = Omit<CiudadInterface, "id">;
  const newData: CiudadWithoutId = {
    name: data.name,
    lat: data.lat,
    lng: data.lng,
  };

  return axios
    .post(urlApi + urlCiudad, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editCiudad = (data: CiudadInterface): Promise<number> => {
  return axios
    .put(urlApi + urlCiudad + data.id, data)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteCiudad = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlCiudad + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
