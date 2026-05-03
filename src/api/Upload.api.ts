import axios from "axios";
import imageCompression from "browser-image-compression";
import { urlApi, urlUpload } from "./url";

const MAX_MB = 4;

export const uploadImage = async (data: File, token: string): Promise<string> => {
  try {
    let file = data;
    if (data.size > MAX_MB * 1024 * 1024) {
      file = await imageCompression(data, {
        maxSizeMB: MAX_MB,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(urlApi + urlUpload, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.path;
  } catch {
    return "500";
  }
};
