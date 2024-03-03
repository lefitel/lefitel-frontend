import axios from "axios";
import { url, urlApi, urlUpload } from "./url";

export const uploadImage = (data: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", data);
  return axios
    .post(urlApi + urlUpload, formData)
    .then((response) => {
      //.log(response.data.path);
      return response.data.path;
    })
    .catch((e) => {
      //console.log(JSON.stringify(e.response.data.message));
      return "400";
    });
};
