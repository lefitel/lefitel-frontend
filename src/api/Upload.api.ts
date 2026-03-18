import axios from "axios";
import { urlApi, urlUpload } from "./url";

export const uploadImage = (data: File, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", data);
  return axios
    .post(urlApi + urlUpload, formData, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => response.data.path)
    .catch(() => "500");
};
