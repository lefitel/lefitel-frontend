import axios from "axios";
import { urlAdss, urlApi } from "./url";
import { AdssInterface } from "../interfaces/interfaces";

export const getAdss = (): Promise<AdssInterface[]> => {
  return axios.get(urlApi + urlAdss).then((response) => {
    const dataList: AdssInterface[] = response.data.map((item: any) => {
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

export const createAdss = (data: AdssInterface): Promise<number> => {
  //type AdssWithoutId = Omit<AdssInterface, "id">;
  const newData: AdssInterface = {
    name: data.name,
    description: data.description,
  };

  return axios
    .post(urlApi + urlAdss, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editAdss = (data: AdssInterface): Promise<number> => {
  return axios
    .put(urlApi + urlAdss + data.id, data)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteAdss = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlAdss + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
