/**
 * The infrastructure diagram, in development only.
 *
 * **What keeps it out of production, and why it is two guards rather than
 * one.** The route in `App.tsx` and the menu entry in `AppSidebar.tsx` are
 * both wrapped in `import.meta.env.DEV`. Vite replaces that constant with the
 * literal `false` when it builds, so Rollup drops both branches and neither
 * the address nor the button exists in what Vercel serves. Hiding only the
 * button would leave the route reachable by typing it.
 *
 * **The document is deliberately not in `public/`.** Everything under
 * `public/` is copied verbatim into `dist/` and published whether or not
 * anything links to it, so a diagram of the servers, the mail providers and
 * the storage paths would be one guessed address away from anybody on the
 * internet. It lives in `web/dev/` instead, which Vite's dev server serves as
 * an ordinary static file and `vite build` never looks at.
 *
 * **It is a snapshot, not a reading.** Nothing here queries the running
 * system: the picture is as true as the day it was generated.
 * `web/dev/arquitectura-osefi.json` is its source — the diagram is rebuilt
 * from it with Archify, and `web/dev/README.md` has the command.
 *
 * **Why the table below exists at all.** Archify bounds how much text a node
 * can carry: a node's fine-detail tag has to fit the node's own width at six
 * legible pixels, which is about forty-five characters. Everything true about
 * this system that does not fit in forty-five characters lives here instead,
 * with the file that proves it named beside it, so a reader can check rather
 * than believe.
 */
const DIAGRAM_URL = "/dev/arquitectura-osefi.html";

/** The day every figure below was read off the working tree. */
const VERIFICADO = "8 de septiembre de 2026";

interface Dato {
  que: string;
  detalle: string;
  fuente: string;
}

interface Bloque {
  titulo: string;
  nota?: string;
  datos: Dato[];
}

const BLOQUES: Bloque[] = [
  {
    titulo: "Dónde vive cada cosa",
    datos: [
      {
        que: "www.osefi.net",
        detalle: "Vercel. React 19 y Vite 8, y toda dirección se reescribe a index.html.",
        fuente: "web/vercel.json",
      },
      {
        que: "api.osefi.net",
        detalle:
          "VPS propio gestionado con Coolify. Contenedor Docker sobre node:24-alpine, escuchando en el 3000; el proxy de Coolify termina el TLS por delante.",
        fuente: "api/Dockerfile",
      },
      {
        que: "PostgreSQL",
        detalle:
          "Servicio de Coolify, en la misma máquina que la API. Esto no se puede deducir del código: la confirmó Isaias.",
        fuente: "confirmado a mano",
      },
      {
        que: "Fotografías de campo",
        detalle:
          "Un volumen del host montado por Coolify. No está declarado con VOLUME a propósito: eso crearía un volumen anónimo por arranque, que parece persistencia y no lo es.",
        fuente: "api/Dockerfile",
      },
    ],
  },
  {
    titulo: "Servicios de fuera",
    nota: "Cuatro. Dos los pide el navegador —y no llevan clave— y dos los pide la API, con las claves guardadas en el servidor.",
    datos: [
      {
        que: "tiles.openfreemap.org",
        detalle: "Las teselas del mapa, sobre datos de OpenStreetMap. Sin clave de API.",
        fuente: "web/public/map-styles/basic.json",
      },
      {
        que: "nominatim.openstreetmap.org",
        detalle: "Búsqueda de direcciones sobre el mapa. Sin clave.",
        fuente: "web/src/components/map/MapSearch.tsx",
      },
      {
        que: "api.openrouteservice.org",
        detalle:
          "Rutas por carretera entre puntos. Con clave, y desde ahora la pone el servidor: el navegador pide POST /api/ruta/query y no sale de aquí. Es el único servicio de fuera que llama la API además del correo.",
        fuente: "api/src/routing/orsClient.ts",
      },
      {
        que: "Correo",
        detalle:
          "Cinco proveedores en cadena con relevo: resend, mailjet, smtp2go, mailtrap y elastic. Cada uno con cupo diario, y un cuarto de ese cupo reservado al código de acceso y a los avisos de seguridad. Hoy no hay ninguno configurado en producción.",
        fuente: "api/src/config/security.ts",
      },
    ],
  },
  {
    titulo: "Lo que el servidor exige para arrancar en producción",
    nota: "Si falta cualquiera de estas, el proceso escribe cuál falta y se muere. No arranca a medias.",
    datos: [
      {
        que: "Ocho variables",
        detalle:
          "CORS_ORIGIN, COOKIE_NAME, COOKIE_SECURE, MAIL_PROVIDERS, MAIL_FROM, MFA_ENCRYPTION_KEY_ACTIVE, WEBAUTHN_RP_ID y WEBAUTHN_ORIGIN.",
        fuente: "api/src/config/security.ts → requiredEnv",
      },
      {
        que: "Las dos de passkeys",
        detalle:
          "WEBAUTHN_RP_ID y WEBAUTHN_ORIGIN están en esa lista por un motivo que ninguna otra tiene: no se pueden corregir después. Una passkey registrada bajo un identificador equivocado deja de existir en cuanto se corrige, y hay que volver a darla de alta en cada dispositivo y por cada persona.",
        fuente: "api/src/config/security.ts",
      },
      {
        que: "ORS_API_KEY, aparte",
        detalle:
          "La clave del trazado por carretera, y a propósito FUERA de la lista de arriba: si falta, el servidor arranca igual y solo /api/ruta/query contesta 503. Una función sin configurar apaga esa función, no el ERP — la misma decisión que el segundo factor por TOTP.",
        fuente: "api/src/controllers/ruta.controller.ts",
      },
      {
        que: "La base de datos",
        detalle:
          "DATABASE_URL, o bien las cinco PG_* juntas. Manda la que esté completa, no el NODE_ENV; la elegida se escribe en la primera línea del log.",
        fuente: "api/src/database/sequelize.ts",
      },
      {
        que: "En Vercel",
        detalle:
          "VITE_PROD_API_URL y VITE_DEV_API_URL. VITE_ORS_API_KEY ya no se usa: bórrala del panel, porque cualquier valor VITE_* acaba escrito en el JavaScript público.",
        fuente: "web/src/api/url.ts",
      },
    ],
  },
  {
    titulo: "Las cifras",
    datos: [
      {
        que: "15 conexiones",
        detalle:
          "El tope del pool contra Postgres. El de fábrica eran 5, y cinco informes a la vez dejaban sin conexión al resto de la aplicación, login incluido.",
        fuente: "api/src/database/sequelize.ts",
      },
      {
        que: "5 MB por imagen",
        detalle: "Máximo por fotografía subida.",
        fuente: "api/src/routes/files.routes.ts",
      },
      {
        que: "100 y 10, cada 15 minutos",
        detalle: "Intentos de login por IP, y por la pareja cuenta más IP.",
        fuente: "api/src/config/security.ts",
      },
      {
        que: "20 trazados por minuto",
        detalle:
          "Y por persona. Cubo propio, no el de las consultas: lo escaso aquí no son filas de la base sino la cuota del proveedor de rutas, que es de la empresa entera.",
        fuente: "api/src/middleware/limiters.ts",
      },
      {
        que: "50 puntos por trazado",
        detalle:
          "El tope documentado de OpenRouteService. El servidor lo comprueba antes de llamar, así que un trazado demasiado largo ya no gasta una petición de la cuota para recibir un 400.",
        fuente: "api/src/routing/waypoints.ts",
      },
      {
        que: "Dos años de HSTS",
        detalle: "63.072.000 segundos, con subdominios incluidos.",
        fuente: "api/src/config/security.ts",
      },
      {
        que: "Dos barridos diarios",
        detalle:
          "Sesiones caducadas y dispositivos recordados, en dos temporizadores separados para que el fallo de uno no se lleve al otro.",
        fuente: "api/src/index.ts",
      },
    ],
  },
  {
    titulo: "Las puertas del despliegue",
    datos: [
      {
        que: "Linter y tests",
        detalle:
          "La imagen no llega a construirse si falla cualquiera de los dos. Los tests corren con un DATABASE_URL y un CORS_ORIGIN falsos que no salen de esa línea del Dockerfile.",
        fuente: "api/Dockerfile",
      },
      {
        que: "Migraciones",
        detalle:
          "Van como comando previo al despliegue, no encadenadas al arranque. Encadenadas, una migración que fallaba dejaba la API caída reiniciándose para siempre; así, el despliegue se aborta y sigue en pie la versión anterior.",
        fuente: "api/Dockerfile",
      },
      {
        que: "El volumen",
        detalle: "Sin la persistencia montada, cada despliegue borra las fotografías subidas desde el anterior.",
        fuente: "api/Dockerfile",
      },
    ],
  },
];

const RIESGOS: { nivel: "alto" | "medio"; texto: string }[] = [
  {
    nivel: "alto",
    texto:
      "MAIL_PROVIDERS es obligatoria en producción y hoy no hay correo configurado. El siguiente despliegue del servidor no arrancará hasta que esté puesta, con al menos un proveedor con sus credenciales completas.",
  },
  {
    nivel: "medio",
    texto:
      "La clave de OpenRouteService ya no viaja en el bundle: la llamada pasa por POST /api/ruta/query y la clave vive en el servidor. Pero el código no des-publica lo ya publicado. Quedan tres cosas, y son tuyas: revocar la clave vieja en OpenRouteService y sacar una nueva, ponerla como ORS_API_KEY en Coolify, y borrar VITE_ORS_API_KEY de Vercel. Hasta el siguiente despliegue del frontend, el bundle que se sirve sigue llevando la clave antigua dentro.",
  },
  {
    nivel: "medio",
    texto:
      "Copias de seguridad: no consta nada en el repositorio, ni de la base de datos ni del volumen de fotografías. Puede estar configurado en Coolify, que es lo único que queda por mirar.",
  },
  {
    nivel: "medio",
    texto:
      "web/public/_redirects es un fichero de Netlify. Vercel no lo lee — quien reescribe las direcciones es vercel.json — así que quien lo edite creyendo que configura algo no configurará nada.",
  },
];

const InfraestructuraPage = () => (
  <div className="flex flex-col w-full gap-8 pt-4 px-6 md:px-8 pb-6 md:pb-8 animate-in fade-in duration-500">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Infraestructura</h1>
      <p className="text-muted-foreground">
        Cómo está montado el sistema, de punta a punta. Esta pantalla solo existe en
        desarrollo, y el dibujo es una foto fija: hay que regenerarlo cuando cambie algo.
      </p>
    </div>

    {/* A fixed height rather than `flex-1`: the page has content underneath now, so a
        frame that grew to fill the window would push the table off the bottom on every
        screen. The diagram carries its own zoom, and `<main>` already scrolls.

        The frame keeps its own light/dark switch and does not follow the app's: it is a
        self-contained document with its own viewer inside, which is the same property
        that lets it be opened straight from disk. */}
    <iframe
      src={DIAGRAM_URL}
      title="Diagrama de la infraestructura de Osefi"
      className="h-168 w-full shrink-0 rounded-lg border border-border bg-background"
    />

    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          El detalle que no cabe en el dibujo
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada dato con el fichero que lo prueba, para que se pueda comprobar en vez de creer.
        </p>
      </div>

      {BLOQUES.map((bloque) => (
        <div key={bloque.titulo} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {bloque.titulo}
            </h3>
            {bloque.nota && <p className="text-sm text-foreground/80">{bloque.nota}</p>}
          </div>
          <dl className="space-y-3 border-l-2 border-border/60 pl-4">
            {bloque.datos.map((dato) => (
              <div key={dato.que} className="grid gap-x-6 gap-y-1 lg:grid-cols-[14rem_1fr]">
                <dt className="text-sm font-medium text-foreground">{dato.que}</dt>
                <dd className="text-sm text-muted-foreground">
                  {dato.detalle}{" "}
                  <span className="whitespace-nowrap font-mono text-xs text-foreground/50">
                    {dato.fuente}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lo que falta y lo que preocupa
        </h3>
        <ul className="space-y-3 border-l-2 border-border/60 pl-4">
          {RIESGOS.map((riesgo) => (
            <li key={riesgo.texto} className="flex gap-3 text-sm">
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  riesgo.nivel === "alto" ? "bg-red-500" : "bg-amber-500"
                }`}
                aria-hidden
              />
              <span className="sr-only">{riesgo.nivel === "alto" ? "Riesgo alto:" : "Riesgo medio:"}</span>
              <span className="text-muted-foreground">{riesgo.texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-border/40 pt-4 text-xs text-muted-foreground">
        Comprobado contra el árbol de trabajo el {VERIFICADO}. Las cifras envejecen en días
        porque hay varias sesiones tocando estos repositorios: si algo no cuadra, gana el código.
      </p>
    </section>
  </div>
);

export default InfraestructuraPage;
