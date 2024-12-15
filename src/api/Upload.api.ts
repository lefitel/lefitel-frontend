import axios from "axios";
import { urlApi, urlUpload } from "./url";

export const uploadImage = (data: File, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", data);
  return axios
    .post(urlApi + urlUpload, formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response.data);
      return response.data.path;
    })
    .catch((e) => {
      console.log(JSON.stringify(e.response.data.message));
      return "500";
    });
};
