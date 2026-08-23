import axios from "axios";
import { urlUsuario, urlApi } from "./url";
import { UsuarioInterface } from "../interfaces/interfaces";

export const getUsuario = (archived = false): Promise<UsuarioInterface[]> => {
  return axios
    .get(urlApi + urlUsuario, {
      params: archived ? { archived: true } : {},
    })
    .then((r) => r.data);
};

export const searchUsuario = (dataId: number): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + dataId)
    .then((response) => response.data as UsuarioInterface);
};

export const searchUsuario_user = (user: string): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + "user/" + user, { headers: { "Cache-Control": "no-cache" } })
    .then((response) => response.data as UsuarioInterface);
};

export const createUsuario = (data: UsuarioInterface): Promise<number> => {
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
    .post(urlApi + urlUsuario, newData)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editUsuario = (data: UsuarioInterface): Promise<number> => {
  return axios
    .put(urlApi + urlUsuario + data.id, data)
    .then((response) => response.status)
    .catch(() => 400);
};

export const editUserName = (
  data: UsuarioInterface
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "username/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const editUserPass = (
  data: UsuarioInterface & { oldPass?: string }
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "userpass/" + data.id, data)
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const deleteUsuario = (id: number): Promise<number> => {
  return axios
    .delete(urlApi + urlUsuario + id)
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarUsuario = (id: number): Promise<number> => {
  return axios
    .patch(urlApi + urlUsuario + id + "/desarchivar", {})
    .then((response) => response.status)
    .catch(() => 400);
};
