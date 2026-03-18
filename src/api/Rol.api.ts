import axios from "axios";
import { urlRol, urlApi } from "./url";
import { RolInterface } from "../interfaces/interfaces";

export const getRol = (token: string): Promise<RolInterface[]> => {
  return axios
    .get(urlApi + urlRol, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
};
