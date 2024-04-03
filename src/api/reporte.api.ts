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
      //console.log(dataList);
      return dataList;
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
          solucions: item.solucions,
          revicions: item.revicions,
          eventoObs: item.eventoObs,

          poste: item.poste,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

      // console.log(dataList);
      return dataList;
    });
};
