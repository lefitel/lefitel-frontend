import axios from "axios";
import { urlApi, urlReporte } from "./url";
import { EventoInterface, ReporteInterface } from "../interfaces/interfaces";

export const getReporteGeneral = (
  filtro: ReporteInterface,
  token: string
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "general", filtro, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};

export const getReporteTramo = (
  filtro: ReporteInterface,
  token: string
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "tramo", filtro, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};

export const getReporteRecorrido = (
  filtro: ReporteInterface,
  token: string
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "recorrido", filtro, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.data);
};
