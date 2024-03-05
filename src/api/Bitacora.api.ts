import axios from "axios";
import { urlBitacora, urlApi } from "./url";
import { BitacoraInterface } from "../interfaces/interfaces";

export const getBitacora = (
  id_usuario: number,
  token: string
): Promise<BitacoraInterface[]> => {
  return axios
    .get(urlApi + urlBitacora + id_usuario, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: BitacoraInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          id_usuario: item.id_usuario,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const createBitacora = (
  data: BitacoraInterface,
  token: string
): Promise<number> => {
  //type BitacoraWithoutId = Omit<BitacoraInterface, "id">;
  const newData: BitacoraInterface = {
    name: data.name,
    description: data.description,
    id_usuario: data.id_usuario,
  };

  return axios
    .post(urlApi + urlBitacora, newData, {
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
