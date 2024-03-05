import axios from "axios";
import { urlApi } from "./url";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";

export const loginUsuario = (
  data: UsuarioInterface
): Promise<{
  status: number;
  message: string | null;
  usuario: SesionInterface | null;
}> => {
  return axios
    .post(urlApi + "login", data)
    .then((response) => {
      return {
        status: response.status,
        message: null,
        usuario: {
          token: response.data.message,
          usuario: response.data.usuario,
        },
      };
    })
    .catch((e) => {
      return {
        status: 500,
        message: e.response.data.message,
        usuario: null,
      };
    });
};

export const comprobarToken = (
  token: string
): Promise<{ status: number; usuario: UsuarioInterface | null }> => {
  return axios
    .get(urlApi + "login", {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      return {
        status: response.status,
        usuario: response.data,
      };
    })
    .catch((e) => {
      console.log(e);
      return {
        status: 500,
        usuario: null,
      };
    });
};
