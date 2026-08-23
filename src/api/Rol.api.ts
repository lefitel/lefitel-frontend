import axios from "axios";
import { urlRol, urlApi } from "./url";
import { RolInterface } from "../interfaces/interfaces";

export const getRol = (): Promise<RolInterface[]> => {
  return axios
    .get(urlApi + urlRol)
    .then((r) => r.data);
};
