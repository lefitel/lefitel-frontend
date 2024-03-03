import axios from "axios";
import { urlPropietario, urlApi } from "./url";
import { PropietarioInterface } from "../interfaces/interfaces";

export const getPropietario = (): Promise<PropietarioInterface[]> => {
  return axios.get(urlApi + urlPropietario).then((response) => {
    const dataList: PropietarioInterface[] = response.data.map((item: any) => {
      // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
      return {
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
    //console.log(dataList);
    return dataList;
  });
};

export const createPropietario = (
  data: PropietarioInterface
): Promise<number> => {
  type PropietarioWithoutId = Omit<PropietarioInterface, "id">;
  const newData: PropietarioWithoutId = {
    name: data.name,
  };

  return axios
    .post(urlApi + urlPropietario, newData)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editPropietario = (
  data: PropietarioInterface
): Promise<number> => {
  return axios
    .put(urlApi + urlPropietario + data.id, data)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deletePropietario = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlPropietario + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
