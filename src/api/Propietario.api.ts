import axios from "axios";
import { urlPropietario, urlApi } from "./url";
import { PropietarioInterface } from "../interfaces/interfaces";

export const getPropietario = (
  token: string
): Promise<PropietarioInterface[]> => {
  return axios
    .get(urlApi + urlPropietario, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: PropietarioInterface[] = response.data.map((item) => {
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
  data: PropietarioInterface,
  token: string
): Promise<number> => {
  type PropietarioWithoutId = Omit<PropietarioInterface, "id">;
  const newData: PropietarioWithoutId = {
    name: data.name,
  };

  return axios
    .post(urlApi + urlPropietario, newData, {
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

export const editPropietario = (
  data: PropietarioInterface,
  token: string
): Promise<number> => {
  return axios
    .put(urlApi + urlPropietario + data.id, data, {
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

export const deletePropietario = (
  id: number,
  token: string
): Promise<number> => {
  return axios
    .delete(urlApi + urlPropietario + id, {
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
