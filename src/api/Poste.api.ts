import axios from "axios";
import { urlPoste, urlApi } from "./url";
import { PosteInterface } from "../interfaces/interfaces";
import { posteExample } from "../data/example";

export const getPoste = (): Promise<PosteInterface[]> => {
  return axios.get(urlApi + urlPoste).then((response) => {
    const dataList: PosteInterface[] = response.data.map((item: any) => {
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
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
    //console.log(dataList);
    return dataList;
  });
};

export const createPoste = (
  data: PosteInterface
): Promise<{ status: number; data: PosteInterface }> => {
  type PosteWithoutId = Omit<PosteInterface, "id">;
  const newData: PosteWithoutId = {
    name: data.name,
    image: data.image,
    date: data.date,
    lat: data.lat,
    lng: data.lng,
    id_adss: data.id_adss,
    id_material: data.id_material,
    id_propietario: data.id_propietario,
    id_ciudadA: data.id_ciudadA,
    id_ciudadB: data.id_ciudadB,
  };

  return axios
    .post(urlApi + urlPoste, newData)
    .then((response) => {
      //console.log(response);

      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: posteExample };
    });
};

export const searchPoste = (dataId: number): Promise<PosteInterface> => {
  return axios.get(urlApi + urlPoste + dataId).then((response) => {
    const data: PosteInterface = response.data;
    //console.log(data);
    return data;
  });
};

export const editPoste = (
  data: PosteInterface
): Promise<{ status: number; data: PosteInterface }> => {
  return axios
    .put(urlApi + urlPoste + data.id, data)
    .then((response) => {
      //console.log(response);
      return { status: response.status, data: response.data };
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return { status: 400, data: posteExample };
    });
};

export const deletePoste = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlPoste + id)
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
