import axios from "axios";
import { urlTipoObs, urlApi } from "./url";
import { TipoObsInterface } from "../interfaces/interfaces";

export const getTipoObs = (): Promise<TipoObsInterface[]> => {
  return axios.get(urlApi + urlTipoObs).then((response) => {
    const dataList: TipoObsInterface[] = response.data.map((item: any) => {
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

export const createTipoObs = (data: TipoObsInterface): Promise<number> => {
  type TipoObsWithoutId = Omit<TipoObsInterface, "id">;
  const newData: TipoObsWithoutId = {
    name: data.name,
    description: data.description,
  };

  return axios
    .post(urlApi + urlTipoObs, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editTipoObs = (data: TipoObsInterface): Promise<number> => {
  return axios
    .put(urlApi + urlTipoObs + data.id, data)
    .then((response) => {
      //.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteTipoObs = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlTipoObs + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
