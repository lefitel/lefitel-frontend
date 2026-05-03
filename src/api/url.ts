const baseUrl: string = import.meta.env.PROD
  ? import.meta.env.VITE_PROD_API_URL
  : import.meta.env.VITE_DEV_API_URL;

export const url = baseUrl.replace(/\/$/, "");
export const urlApi = baseUrl + "api/";

export const urlAdss = "adss/";
export const urlAdssPoste = "adssposte/";
export const urlEventoObs = "eventoObs/";

export const urlMaterial = "material/";
export const urlObs = "obs/";
export const urlPropietario = "propietario/";
export const urlTipoObs = "tipoObs/";
export const urlCiudad = "ciudad/";
export const urlPoste = "poste/";
export const urlUsuario = "usuario/";
export const urlRol = "rol/";
export const urlUpload = "upload/";
export const urlBitacora = "bitacora/";
export const urlReporte = "reporte/";

export const urlEvento = "evento/";
export const urlRevision = "revision/";
export const urlSolucion = "solucion/";
