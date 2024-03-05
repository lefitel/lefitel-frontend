import axios from "axios";
import { urlRol, urlApi } from "./url";
import { RolInterface } from "../interfaces/interfaces";

export const getRol = (token: string): Promise<RolInterface[]> => {
  return axios
    .get(urlApi + urlRol, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      const dataList: RolInterface[] = response.data.map((item: any) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      //console.log(dataList);
      return dataList;
    });
};
