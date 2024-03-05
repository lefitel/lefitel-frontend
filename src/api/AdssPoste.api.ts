import axios from "axios";
import { urlAdssPoste, urlApi } from "./url";
import { AdssPosteInterface } from "../interfaces/interfaces";

export const getAdssPoste = (
  id_poste: number,
  token: string
): Promise<AdssPosteInterface[]> => {
  return axios
    .get(urlApi + urlAdssPoste + id_poste, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: AdssPosteInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          id_adss: item.id_adss,
          id_poste: item.id_poste,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      return dataList;
    });
};

export const createAdssPoste = (
  data: AdssPosteInterface,
  token: string
): Promise<number> => {
  //type AdssPosteWithoutId = Omit<AdssPosteInterface, "id">;
  const newData: AdssPosteInterface = {
    id_adss: data.id_adss,
    id_poste: data.id_poste,
  };

  return axios
    .post(urlApi + urlAdssPoste, newData, {
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

export const deleteAdssPoste = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlAdssPoste + id, {
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
