import axios from "axios";
import { urlRevicion, urlApi } from "./url";
import { RevicionInterface } from "../interfaces/interfaces";

export const getRevicion = (
  id_evento: number
): Promise<RevicionInterface[]> => {
  return axios.get(urlApi + urlRevicion + id_evento).then((response) => {
    const dataList: RevicionInterface[] = response.data.map((item: any) => {
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

export const createRevicion = (data: RevicionInterface): Promise<number> => {
  //type RevicionWithoutId = Omit<RevicionInterface, "id">;
  const newData: RevicionInterface = {
    description: data.description,
    date: data.date,
    id_evento: data.id_evento,
  };

  return axios
    .post(urlApi + urlRevicion, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteRevicion = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlRevicion + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
