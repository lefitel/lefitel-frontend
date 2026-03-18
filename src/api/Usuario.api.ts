import axios from "axios";
import { urlUsuario, urlApi } from "./url";
import { UsuarioInterface } from "../interfaces/interfaces";

export const getUsuario = (token: string, archived = false): Promise<UsuarioInterface[]> => {
  return axios
    .get(urlApi + urlUsuario, {
      headers: { Authorization: `Bearer ${token}` },
      params: archived ? { archived: true } : {},
    })
    .then((r) => r.data);
};

export const searchUsuario = (dataId: number, token: string): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + dataId, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.data as UsuarioInterface);
};

export const searchUsuario_user = (user: string, token: string): Promise<UsuarioInterface> => {
  return axios
    .get(urlApi + urlUsuario + "user/" + user, { headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" } })
    .then((response) => response.data as UsuarioInterface);
};

export const createUsuario = (data: UsuarioInterface, token: string): Promise<number> => {
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
    .post(urlApi + urlUsuario, newData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editUsuario = (data: UsuarioInterface, token: string): Promise<number> => {
  return axios
    .put(urlApi + urlUsuario + data.id, data, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const editUserName = (
  data: UsuarioInterface,
  token: string
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "username/" + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const editUserPass = (
  data: UsuarioInterface & { oldPass?: string },
  token: string
): Promise<{ status: number; message?: string }> => {
  return axios
    .put(urlApi + urlUsuario + "userpass/" + data.id, data, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => ({ status: response.status }))
    .catch((e) => {
      const msg = e.response?.data?.message || "Error desconocido";
      return { status: e.response?.status || 500, message: msg };
    });
};

export const deleteUsuario = (id: number, token: string): Promise<number> => {
  return axios
    .delete(urlApi + urlUsuario + id, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};

export const desarchivarUsuario = (id: number, token: string): Promise<number> => {
  return axios
    .patch(urlApi + urlUsuario + id + "/desarchivar", {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.status)
    .catch(() => 400);
};
