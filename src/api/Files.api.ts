import axios from "axios";
import { urlApi } from "./url";

const urlFiles = "files/";

export interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
}

export interface FileUsage {
  type: string;
  id: number;
  name: string;
}

export interface OrphanFileInfo extends FileInfo {
  id?: number | null;
  isOrphan: boolean;
  usedBy: FileUsage | null;
}

export const getOrphanFiles = (token: string): Promise<OrphanFileInfo[]> =>
  axios
    .get(urlApi + urlFiles + "orphans", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);

export const deleteFile = (name: string, token: string): Promise<void> =>
  axios
    .delete(urlApi + urlFiles + encodeURIComponent(name), {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);

export const deleteOrphanFiles = (token: string): Promise<{ deleted: number }> =>
  axios
    .delete(urlApi + urlFiles + "orphans", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
