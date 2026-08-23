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

export const getOrphanFiles = (): Promise<OrphanFileInfo[]> =>
  axios
    .get(urlApi + urlFiles + "orphans")
    .then((r) => r.data);

export const deleteFile = (name: string): Promise<void> =>
  axios
    .delete(urlApi + urlFiles + encodeURIComponent(name))
    .then((r) => r.data);

export const deleteOrphanFiles = (): Promise<{ deleted: number }> =>
  axios
    .delete(urlApi + urlFiles + "orphans")
    .then((r) => r.data);

export interface EntityImageStat {
  total: number;
  sinImagen: number;
  referenciaRota: number;
}

export interface EntityImageStats {
  postes: EntityImageStat;
  eventos: EntityImageStat;
  ciudades: EntityImageStat;
  usuarios: EntityImageStat;
  soluciones: EntityImageStat;
}

export interface BrokenRef {
  tipo: string;
  id: number;
  name: string;
  image: string;
}

export const getEntityImageStats = (): Promise<EntityImageStats> =>
  axios
    .get(urlApi + urlFiles + "entity-stats")
    .then((r) => r.data);

export const getBrokenImageRefs = (): Promise<BrokenRef[]> =>
  axios
    .get(urlApi + urlFiles + "broken-refs")
    .then((r) => r.data);

export const clearBrokenImageRefs = (): Promise<{ cleared: number }> =>
  axios
    .delete(urlApi + urlFiles + "broken-refs")
    .then((r) => r.data);
