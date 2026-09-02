// Una sola pregunta, en su propio módulo: ¿esta petición va a nuestra API?
//
// Está aquí y no en `http.ts` para romper un ciclo de imports. `http.ts`
// instala el interceptor del step-up, y ese interceptor necesita esta función:
// dejarla allí hacía que los dos módulos se importaran mutuamente. Funcionaba
// por el orden en que se evalúan las cosas, que es justo la clase de detalle
// que deja de cumplirse cuando alguien mueve una línea.

import { url } from "./url";

/**
 * Si una petición va a nuestra propia API.
 *
 * Vivía dentro del efecto de `SesionProvider.tsx`, donde nació. Vive aquí
 * desde que hay un segundo interceptor global —el del step-up— que necesita
 * exactamente la misma pregunta: dos copias de esta función es como una de las
 * dos se queda sin el arreglo que la otra recibió.
 *
 * 🔴 **Hace falta porque el interceptor es global y ve TODO lo que la
 * aplicación pide**, incluidas las fotos que los exportadores descargan contra
 * rutas guardadas en la base de datos. Un valor de `image` fabricado como
 * ".atacante.tld/x.jpg" pegado al host de la API produce una petición a un
 * host ajeno, y ese host controla sus propias cabeceras y su propio CORS: sin
 * esta comprobación puede devolvernos el `code` que quiera y hacer que le
 * pidamos la contraseña a la persona en un diálogo que no es nuestro.
 *
 * Una `url` relativa se resuelve como la resolvió axios: contra `baseURL` si
 * la petición traía una, y sólo contra la página si no. Resolver siempre
 * contra `window.location` era una trampa latente — el día que alguien ponga
 * un `baseURL` (hoy no hay ningún `axios.create` en este repositorio), toda
 * `url` pasa a ser la ruta pelada, toda ruta resuelve al origen del *frontend*
 * y esta guarda deja de coincidir en silencio, sin que ningún test lo note
 * porque los tests construyen URLs absolutas. Tomar la base de la propia
 * petición la mantiene honesta en los dos casos. Y no se puede volver en
 * nuestra contra: `baseURL` lo pone esta aplicación y `url` es la mitad que
 * puede salir de la base de datos — y una `url` absoluta ignora la base contra
 * la que se resuelve, así que el host de un extraño sigue resolviendo al
 * origen de un extraño.
 */
export const esNuestraApi = (config: { url?: string; baseURL?: string } | undefined): boolean => {
  if (!config?.url) return false;
  try {
    return new URL(config.url, config.baseURL || window.location.href).origin === new URL(url).origin;
  } catch {
    return false;
  }
};
