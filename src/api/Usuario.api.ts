import axios from "axios";
import { urlUsuario, urlApi } from "./url";
import { UsuarioInterface } from "../interfaces/interfaces";

export const getUsuario = (token: string): Promise<UsuarioInterface[]> => {
  return axios
    .get(urlApi + urlUsuario, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      const dataList: UsuarioInterface[] = response.data.map((item: any) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          lastname: item.lastname,
          image: item.image,
          phone: item.phone,
          birthday: item.birthday,
          user: item.user,
          pass: item.pass,
          id_rol: item.id_rol,
          rol: item.rol,

          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};

export const searchUsuario = (
  dataId: number,
  token: string
): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + dataId, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: UsuarioInterface = response.data;
      //console.log(data);
      return data;
    });
};

export const searchUsuario_user = (
  user: string,
  token: string
): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + "user/" + user, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      const data: UsuarioInterface = response.data;
      //console.log(data);
      return data;
    });
};

export const createUsuario = (
  data: UsuarioInterface,
  token: string
): Promise<number> => {
  type UsuarioWithoutId = Omit<UsuarioInterface, "id">;
  const newData: UsuarioWithoutId = {
    name: data.name,
    lastname: data.lastname,
    image: data.image,
    phone: data.phone,
    birthday: data.birthday,
    user: data.user,
    pass: data.pass,
    id_rol: data.id_rol,
  };

  return axios
    .post(urlApi + urlUsuario, newData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const editUsuario = (
  data: UsuarioInterface,
  token: string
): Promise<number> => {
  return axios
    .put(urlApi + urlUsuario + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};

export const deleteUsuario = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlUsuario + id, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response);
      return response.status;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return 400;
    });
};
