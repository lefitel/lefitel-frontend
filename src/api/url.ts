const baseUrl: string = import.meta.env.PROD
  ? import.meta.env.VITE_PROD_API_URL
  : import.meta.env.VITE_DEV_API_URL;

export const url = baseUrl.replace(/\/$/, "");
export const urlApi = baseUrl + "api/";

export const urlAdss = "adss/";

export const urlMaterial = "material/";
export const urlObs = "obs/";
export const urlPropietario = "propietario/";
export const urlTipoObs = "tipo-obs/";
export const urlCiudad = "ciudad/";
export const urlPoste = "poste/";
export const urlUsuario = "usuario/";
export const urlRol = "rol/";
export const urlFiles = "files/";
export const urlBitacora = "bitacora/";
export const urlReporte = "reporte/";

export const urlEvento = "evento/";
export const urlRevision = "revision/";

// D1 (§3.2). Four constants left with it: `urlAdssPoste`, `urlEventoObs`,
// `urlSolucion` and `urlUpload` named mounts that no longer exist. The
// listings they addressed hang off their parent now — `poste/:id/adss`,
// `evento/:id/obs`, `evento/:id/solucion` — and storing a file is
// `POST /api/files/`.
//
// 🔴 `urlBitacora` and `urlRevision` are the two to be careful with. Each
// named a route that moved *and* routes that stayed, so "delete the constant
// with its route" would have broken something that never changed:
// `urlBitacora` still serves the whole log and its author list, and
// `urlRevision` still serves `POST /api/revision/`, which is how an
// inspection is recorded. The moved halves compose from `urlUsuario` and
// `urlEvento` now, so neither constant has a moved reader left — which is
// what makes them look unused at a glance, and they are not.
