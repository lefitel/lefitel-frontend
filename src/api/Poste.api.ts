import axios from "axios";
import { urlPoste, urlApi } from "./url";
import { PosteInterface } from "../interfaces/interfaces";
import { posteExample } from "../data/example";

export const getPoste = (token: string): Promise<PosteInterface[]> => {
  return axios
    .get(urlApi + urlPoste, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: PosteInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          image: item.image,
          lat: item.lat,
          lng: item.lng,
          id_adss: item.id_adss,
          id_material: item.id_material,
          id_propietario: item.id_propietario,
          id_ciudadA: item.id_ciudadA,
          id_ciudadB: item.id_ciudadB,
          adss: item.adss,
          material: item.material,
          propietario: item.propietario,
          ciudadA: item.ciudadA,
          ciudadB: item.ciudadB,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const createPoste = (
  data: PosteInterface,
  token: string
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .post(urlApi + urlPoste, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);

      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: posteExample };
    });
};

export const searchPoste = (
  dataId: number,
  token: string
): Promise<PosteInterface> => {
  return axios
    .get(urlApi + urlPoste + dataId, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: PosteInterface = response.data;
      //console.log(data);
      return data;
    });
};

export const editPoste = (
  data: PosteInterface,
  token: string
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .put(urlApi + urlPoste + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: posteExample };
    });
};

export const deletePoste = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlPoste + id, {
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
