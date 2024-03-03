import axios from "axios";
import { urlMaterial, urlApi } from "./url";
import { MaterialInterface } from "../interfaces/interfaces";

export const getMaterial = (): Promise<MaterialInterface[]> => {
  return axios.get(urlApi + urlMaterial).then((response) => {
    const dataList: MaterialInterface[] = response.data.map((item: any) => {
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

export const createMaterial = (data: MaterialInterface): Promise<number> => {
  type MaterialWithoutId = Omit<MaterialInterface, "id">;
  const newData: MaterialWithoutId = {
    name: data.name,
    description: data.description,
  };

  return axios
    .post(urlApi + urlMaterial, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editMaterial = (data: MaterialInterface): Promise<number> => {
  return axios
    .put(urlApi + urlMaterial + data.id, data)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteMaterial = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlMaterial + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
