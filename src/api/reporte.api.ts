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
    .then((response) => {
      //console.log(response.data);
      /* @ts-expect-error No se sabe el tipo de event */
      const dataList: EventoInterface[] = response.data.map((item) => {
        // Aquí puedes hacer cualquier transformación que necesites para mapear los datos
        return {
          id: item.id,
          description: item.description,
          image: item.image,
          state: item.state,
          date: item.date,

          id_poste: item.id_poste,
          solucions: item.solucions,
          revicions: item.revicions,

          poste: item.poste,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });
      const filteredData = dataList.filter((evento) => {
        const reviciones = evento.revicions || [];
        // Busca la fecha más reciente en las revisiones
        const maxFecha = reviciones.reduce((max, rev) => {
          const fecha = new Date(rev.date);
          return fecha > max ? fecha : max;
        }, new Date(0)); // Fecha inicial muy baja

        // Verifica si la fecha está dentro del rango
        return maxFecha >= filtro.fechaInicial && maxFecha <= filtro.fechaFinal;
      });
      return filteredData;
    });
};

export const getReporteTramo = (
  filtro: ReporteInterface,
  token: string
): Promise<EventoInterface[]> => {
  return axios
    .put(urlApi + urlReporte + "tramo", filtro, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => {
      //console.log(response.data);
      const dataListFilter: EventoInterface[] = response.data.filter(
        /* @ts-expect-error No se sabe el tipo de event */
        (item) => item.poste
      );

      const dataList: EventoInterface[] = dataListFilter.map((item) => {
        return {
          id: item.id,
          description: item.description,
          image: item.image,
          state: item.state,
          date: item.date,

          id_poste: item.id_poste,
          id_usuario: item.id_usuario,
          solucions: item.solucions,
          revicions: item.revicions,
          eventoObs: item.eventoObs,

          poste: item.poste,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

      // console.log(dataList);
      const filteredData = dataList.filter((evento) => {
        const reviciones = evento.revicions || [];
        // Busca la fecha más reciente en las revisiones
        const maxFecha = reviciones.reduce((max, rev) => {
          const fecha = new Date(rev.date);
          return fecha > max ? fecha : max;
        }, new Date(0)); // Fecha inicial muy baja

        // Verifica si la fecha está dentro del rango
        return maxFecha >= filtro.fechaInicial && maxFecha <= filtro.fechaFinal;
      });
      //console.log(dataList);
      return filteredData;

      //return dataList;
    });
};
