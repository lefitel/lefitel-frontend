import axios from "axios";
import { urlApi } from "./url";

export interface DashboardEvento {
  id: number;
  description: string;
  state: boolean;
  date: Date;
  priority?: boolean;
  id_poste: number;
  poste?: {
    id?: number;
    name: string;
    lat: number;
    lng: number;
    propietario?: { name: string } | null;
  } | null;
}

export interface DashboardPoste {
  id: number;
  name: string;
  lat: number;
  lng: number;
  date: Date;
  ciudadA?: { id?: number; name: string } | null;
  ciudadB?: { id?: number; name: string } | null;
  propietario?: { name: string } | null;
  material?: { name: string } | null;
}

export interface DashboardData {
  eventos: DashboardEvento[];
  postes: DashboardPoste[];
}

export const getDashboard = (token: string): Promise<DashboardData> =>
  axios
    .get(urlApi + "dashboard/", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.data);
