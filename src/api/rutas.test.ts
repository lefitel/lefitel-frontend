// Where every request in this folder actually goes.
//
// **The gap this closes, and the first version of this paragraph got the size
// of it wrong.** It claimed exactly one of the addresses D1 touched was watched
// by a test. Counted properly, **six** were: the three `/opciones` in
// `opciones.api.test.ts`, `/bitacora/autores` in `Bitacora.api.test.ts`, and two
// reports in `reporte.api.test.ts`. The real gap is the other twenty-six, among
// them every `/restore`, both incident verbs, all seven sub-resources and the
// five routes of the generator — none of which had an assertion of any kind.
//
// What makes that gap total rather than partial is that **every screen test
// mocks its `*.api` module whole**, 79 `vi.mock` calls of them, so not one of
// them can see a URL. A rename typed wrong in an unwatched function leaves
// `npm test` completely green and shows up in production as a 404, which the
// screens turn into "no se pudo" — indistinguishable from a refusal or a broken
// server.
//
// **Why it is not a copy of the code it watches.** A file that said
// `expect(URL).toBe("poste/7/restore")` would be a second copy of one line,
// updated without reading whenever the first changed. Three things here are not
// that:
//
//   1. **The functions are run**, and what is asserted is the URL axios really
//      received. That covers the composition — `urlApi + urlPoste + id` — which
//      is where the mistakes actually live, and it is how a segment ending up in
//      the wrong order gets caught.
//   2. **The shapes are anchored patterns, not strings.** `/\/poste\/7\/adss$/`
//      says the identifier is in the middle and the child at the end. Writing
//      `/api/adss/7/poste` satisfies no reading of it.
//   3. **A rule no table can satisfy by copying**: no address this client asks
//      for may contain a Spanish verb. That is §3.4 of the API standard, and it
//      is the mirror of `naming.test.ts` on the server — the two have to agree
//      or the client is asking for addresses nobody answers.
//
// The completeness sweep at the end is what stops the table going stale: it
// reads every source file in this folder looking for a Spanish operation in a
// string, so a function that never joined the table is still caught.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getAdssPoste } from "./AdssPoste.api";
import { getEventoObs } from "./EventoObs.api";
import { getRevision } from "./Revision.api";
import { getSolucion_evento } from "./Solucion.api";
import { getEvento_poste, getEvento_usuario, reabrirEvento, resolverEvento, desarchivarEvento } from "./Evento.api";
import { getBitacora, getAutoresBitacora } from "./Bitacora.api";
import { desarchivarAdss } from "./Adss.api";
import { desarchivarCiudad } from "./Ciudad.api";
import { desarchivarMaterial } from "./Material.api";
import { desarchivarObs } from "./Obs.api";
import { desarchivarPropietario } from "./Propietario.api";
import { desarchivarRol } from "./Rol.api";
import { desarchivarTipoObs, getTipoObs } from "./TipoObs.api";
import { desarchivarPoste } from "./Poste.api";
import { desarchivarUsuario } from "./Usuario.api";
import { getOpcionesPoste, getOpcionesEvento, getOpcionesReporte } from "./opciones.api";
import { getMatrizPermisos, savePermisos } from "./Permisos.api";
import { getObsFrecuencia, getTiemposResumen } from "./reporte.api";
import { getCatalogo, runReporte, contarReporte, duplicarReporte } from "./generador.api";

const ID = 7;

/** A listing answer, in the envelope every list route uses since C3. */
const SOBRE = { data: { data: [], total: 0, page: 1, limit: 50 } };

afterEach(() => {
  vi.restoreAllMocks();
});

type Caso = {
  /** What it is called on screen, for the failure message. */
  nombre: string;
  verbo: "get" | "post" | "put" | "patch";
  /** Anchored: the identifier's position and the last segment both matter. */
  forma: RegExp;
  llamar: () => Promise<unknown>;
  /** Some readers post-process the answer; those that do get their own. */
  respuesta?: unknown;
};

/**
 * Every address D1 moved or renamed, plus the neighbours that share a constant
 * with one of them.
 *
 * The neighbours are not filler. `urlBitacora` and `urlRevision` each serve a
 * route that moved **and** one that stayed, so "rename the constant" is a change
 * that looks right and breaks recording an inspection or reading the whole log.
 */
const CASOS: Caso[] = [
  // The seven that now hang off their parent — §3.2.
  { nombre: "ADSS de un poste", verbo: "get", forma: /\/api\/poste\/7\/adss$/, llamar: () => getAdssPoste(ID), respuesta: SOBRE },
  { nombre: "observaciones de una incidencia", verbo: "get", forma: /\/api\/evento\/7\/obs$/, llamar: () => getEventoObs(ID), respuesta: SOBRE },
  { nombre: "revisiones de una incidencia", verbo: "get", forma: /\/api\/evento\/7\/revisiones$/, llamar: () => getRevision(ID), respuesta: SOBRE },
  { nombre: "solución de una incidencia", verbo: "get", forma: /\/api\/evento\/7\/solucion$/, llamar: () => getSolucion_evento(ID), respuesta: { data: null } },
  { nombre: "incidencias de un poste", verbo: "get", forma: /\/api\/poste\/7\/eventos$/, llamar: () => getEvento_poste(ID), respuesta: SOBRE },
  { nombre: "incidencias de una persona", verbo: "get", forma: /\/api\/usuario\/7\/eventos$/, llamar: () => getEvento_usuario(ID), respuesta: SOBRE },
  { nombre: "bitácora de una persona", verbo: "get", forma: /\/api\/usuario\/7\/bitacora$/, llamar: () => getBitacora(ID), respuesta: SOBRE },

  // The operations that went into English — §3.4.
  { nombre: "desarchivar ADSS", verbo: "patch", forma: /\/api\/adss\/7\/restore$/, llamar: () => desarchivarAdss(ID) },
  { nombre: "desarchivar ciudad", verbo: "patch", forma: /\/api\/ciudad\/7\/restore$/, llamar: () => desarchivarCiudad(ID) },
  { nombre: "desarchivar material", verbo: "patch", forma: /\/api\/material\/7\/restore$/, llamar: () => desarchivarMaterial(ID) },
  { nombre: "desarchivar observación", verbo: "patch", forma: /\/api\/obs\/7\/restore$/, llamar: () => desarchivarObs(ID) },
  { nombre: "desarchivar propietario", verbo: "patch", forma: /\/api\/propietario\/7\/restore$/, llamar: () => desarchivarPropietario(ID) },
  { nombre: "desarchivar rol", verbo: "patch", forma: /\/api\/rol\/7\/restore$/, llamar: () => desarchivarRol(ID) },
  { nombre: "desarchivar tipo de observación", verbo: "patch", forma: /\/api\/tipo-obs\/7\/restore$/, llamar: () => desarchivarTipoObs(ID) },
  { nombre: "desarchivar poste", verbo: "patch", forma: /\/api\/poste\/7\/restore$/, llamar: () => desarchivarPoste(ID) },
  { nombre: "desarchivar cuenta", verbo: "patch", forma: /\/api\/usuario\/7\/restore$/, llamar: () => desarchivarUsuario(ID) },
  { nombre: "desarchivar incidencia", verbo: "patch", forma: /\/api\/evento\/7\/restore$/, llamar: () => desarchivarEvento(ID) },
  { nombre: "reabrir incidencia", verbo: "post", forma: /\/api\/evento\/7\/reopen$/, llamar: () => reabrirEvento(ID) },
  {
    nombre: "resolver incidencia", verbo: "post", forma: /\/api\/evento\/7\/resolve$/,
    llamar: () => resolverEvento(ID, { description: "x", date: new Date(), image: "" }),
  },

  // The mounts that changed name.
  { nombre: "tipos de observación", verbo: "get", forma: /\/api\/tipo-obs\/$/, llamar: () => getTipoObs(), respuesta: SOBRE },
  { nombre: "matriz de permisos", verbo: "get", forma: /\/api\/permiso$/, llamar: () => getMatrizPermisos(), respuesta: { data: {} } },
  { nombre: "guardar permisos", verbo: "put", forma: /\/api\/permiso\/7$/, llamar: () => savePermisos(ID, {}) },
  { nombre: "catálogo del generador", verbo: "get", forma: /\/api\/generator\/catalog$/, llamar: () => getCatalogo(), respuesta: { data: {} } },
  { nombre: "consulta del generador", verbo: "post", forma: /\/api\/generator\/query$/, llamar: () => runReporte({} as never), respuesta: { data: {} } },
  { nombre: "conteo del generador", verbo: "post", forma: /\/api\/generator\/count$/, llamar: () => contarReporte({} as never), respuesta: { data: {} } },
  { nombre: "duplicar un informe", verbo: "post", forma: /\/api\/generator\/reportes\/7\/duplicate$/, llamar: () => duplicarReporte(ID), respuesta: { data: {} } },

  // The three option sets, and the two reports whose word order was wrong.
  { nombre: "opciones de poste", verbo: "get", forma: /\/api\/poste\/options$/, llamar: () => getOpcionesPoste(), respuesta: { data: {} } },
  { nombre: "opciones de incidencia", verbo: "get", forma: /\/api\/evento\/options$/, llamar: () => getOpcionesEvento(), respuesta: { data: {} } },
  { nombre: "opciones de informe", verbo: "get", forma: /\/api\/reporte\/options$/, llamar: () => getOpcionesReporte(), respuesta: { data: {} } },
  { nombre: "informe de frecuencia", verbo: "get", forma: /\/api\/reporte\/frecuencia-obs/, llamar: () => getObsFrecuencia({} as never), respuesta: { data: [] } },
  { nombre: "informe de tiempos", verbo: "get", forma: /\/api\/reporte\/resumen-tiempos/, llamar: () => getTiemposResumen({} as never), respuesta: { data: [] } },

  // The neighbours that share a constant with one of the above.
  { nombre: "autores de la bitácora", verbo: "get", forma: /\/api\/bitacora\/authors$/, llamar: () => getAutoresBitacora(), respuesta: { data: [] } },
];

/** The URL the function really handed axios. */
const direccionDe = async (caso: Caso): Promise<string> => {
  const espia = vi.spyOn(axios, caso.verbo).mockResolvedValue(caso.respuesta ?? { data: {} });
  await caso.llamar().catch(() => undefined);
  expect(espia, `${caso.nombre}: no llamó a axios.${caso.verbo}`).toHaveBeenCalled();
  return String(espia.mock.calls[0][0]);
};

describe("a qué dirección va cada petición", () => {
  for (const caso of CASOS) {
    it(`${caso.nombre} → ${caso.forma.source}`, async () => {
      const direccion = await direccionDe(caso);
      expect(direccion, `${caso.nombre} pidió ${direccion}`).toMatch(caso.forma);
    });
  }

  it("cubre las diecinueve direcciones que D1 movió, una por una", () => {
    // 🔴 A bound on the length used to stand here, and it does not do this job:
    // each case is its own `it`, so deleting three of them deletes three tests
    // and leaves 29 — still over any floor — with nothing anywhere else in `web`
    // asserting those URLs. Measured by removing the sub-resources for solución,
    // bitácora and the incidents of a person: the file went green at 32/32.
    //
    // So the nineteen are named. A case removed fails here by name; a case added
    // for a route that did not move is simply not in this list and is fine.
    const MOVIDAS = [
      "ADSS de un poste", "observaciones de una incidencia",
      "revisiones de una incidencia", "solución de una incidencia",
      "incidencias de un poste", "incidencias de una persona",
      "bitácora de una persona",
      "desarchivar ADSS", "desarchivar ciudad", "desarchivar material",
      "desarchivar observación", "desarchivar propietario", "desarchivar rol",
      "desarchivar tipo de observación", "desarchivar poste",
      "desarchivar cuenta", "desarchivar incidencia",
      "reabrir incidencia", "resolver incidencia",
    ];
    const cubiertos = new Set(CASOS.map((c) => c.nombre));
    const faltan = MOVIDAS.filter((n) => !cubiertos.has(n));
    expect(faltan, `estas direcciones movidas ya no las mira nadie: ${faltan.join(", ")}`).toEqual([]);
    expect(MOVIDAS.length).toBe(19);
    // Y sigue habiendo suelo, para las que no son de la lista.
    expect(CASOS.length).toBeGreaterThan(28);
  });
});

/**
 * Verbs and operations in Spanish — the same list `naming.test.ts` holds on the
 * server, and it says so because it now is one.
 *
 * 🔴 It was eight words shorter, while claiming to be the same list. The two
 * repositories deploy separately, which is the exact case this file exists for:
 * a function asking for `/api/evento/7/archivar` or `/api/poste/subir` passed
 * the client sweep and was only ever going to be caught on the other side.
 */
const VERBOS_EN_ESPANOL = [
  "desarchivar", "archivar", "reabrir", "resolver", "exportar", "consulta",
  "conteo", "duplicar", "catalogo", "opciones", "autores", "buscar", "crear",
  "editar", "borrar", "subir", "descargar", "listar",
];

/**
 * And the rule that does not depend on anybody having listed the word: Spanish
 * infinitives end in `-ar`, `-er` or `-ir`. `naming.test.ts` carries the same
 * check, with the same single exception — `user`, from `/api/usuario/user/:user`.
 */
const TERMINA_COMO_INFINITIVO = /(ar|er|ir)$/;
const NO_ES_INFINITIVO = ["user"];

describe("ninguna dirección lleva un verbo en español", () => {
  it("en ninguna de las que esta tabla ejecuta", async () => {
    // The rule, run against the addresses the client really builds. It cannot be
    // satisfied by copying the code, because it says what the words *are*.
    const malas: string[] = [];
    const infinitivos: string[] = [];
    for (const caso of CASOS) {
      const direccion = await direccionDe(caso);
      const sucio = VERBOS_EN_ESPANOL.find((v) => direccion.includes(`/${v}`));
      if (sucio) malas.push(`${caso.nombre}: ${direccion}`);
      // Y la regla que no depende de la lista: cualquier segmento que termine
      // como un infinitivo. Es lo que atrapa un verbo que nadie previó —
      // `restaurar`, `guardar`, `asignar`— sin tener que enumerarlo antes.
      for (const s of direccion.split("?")[0].split("/")) {
        if (!s || /^\d+$/.test(s)) continue;
        if (TERMINA_COMO_INFINITIVO.test(s) && !NO_ES_INFINITIVO.includes(s)) {
          infinitivos.push(`${caso.nombre}: ${s}`);
        }
      }
      vi.restoreAllMocks();
    }
    expect(malas, `verbos en español en la superficie que pide el cliente:\n  ${malas.join("\n  ")}`).toEqual([]);
    expect(
      infinitivos,
      `segmentos que parecen un infinitivo en español:\n  ${infinitivos.join("\n  ")}`,
    ).toEqual([]);
  });

  it("ni en ninguna cadena de src/api, que es lo que atrapa una función fuera de la tabla", () => {
    // The completeness half. The table above proves the shape of what it runs;
    // this reads every source file in the folder, so a request that never joined
    // it is still caught. Comments are stripped first — this file and its
    // neighbours discuss the old names on purpose.
    const aqui = dirname(fileURLToPath(import.meta.url));
    const malas: string[] = [];
    for (const fichero of readdirSync(aqui)) {
      if (!fichero.endsWith(".ts") || fichero.endsWith(".test.ts")) continue;
      const fuente = readFileSync(join(aqui, fichero), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const verbo of VERBOS_EN_ESPANOL) {
        // Inside a string literal and preceded by a slash: that is a URL
        // segment, and not the name of an exported function like
        // `desarchivarPoste`, which is code and stays as it is.
        if (new RegExp(`["'\`][^"'\`]*\\/${verbo}`).test(fuente)) {
          malas.push(`${fichero}: /${verbo}`);
        }
      }
    }
    expect(malas, `direcciones en español en src/api:\n  ${malas.join("\n  ")}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Que la dirección exista al otro lado.
 *
 * 🔴 **Ésta es la comprobación que no existía en ninguno de los dos
 * repositorios**, y la única que caza la clase de fallo entera. Todo lo de
 * arriba mide la *forma* de lo que pide el cliente; nada medía que el servidor
 * conteste ahí. Una auditoría lo demostró apuntando dos funciones a
 * `/api/files/orphan` y `/api/usuario/usuario/:user` —direcciones que el
 * servidor no monta— y corriendo las suites de los dos repos: **verdes las
 * dos**, 1.071 pruebas aquí y 2.655 allí. Una de ellas, además, cae justo donde
 * el fallo se lee como éxito: la comprobación de si un nombre de usuario está
 * libre trata cualquier rechazo como «libre».
 *
 * **Cómo se lee el otro lado.** Se parsea `api/src/app.ts` para saber qué
 * router se monta en qué prefijo, y luego cada fichero de router para sus
 * rutas. Es mecánico y aguanta: las dos formas son de una línea y una sola
 * manera. Lo que no se hace es fiarse — si el análisis devuelve menos rutas de
 * las que debería, falla, porque un parser que se queda corto certifica
 * cualquier cosa.
 *
 * **Y si el repositorio `api` no está al lado, esto se salta y lo dice.** Un
 * fichero que existe y no declara lo que debería es un fallo; un fichero que no
 * está es otra máquina. Mismo criterio que `lib/password.test.ts`.
 */
const RAIZ_API = resolve(dirname(fileURLToPath(import.meta.url)), "../../../api");

/** Cada ruta montada por el servidor, como `MÉTODO /api/...`. */
const rutasDelServidor = (): string[] => {
  const app = readFileSync(join(RAIZ_API, "src/app.ts"), "utf8");

  // `import filesRoutes from "./routes/files.routes.js";`
  const fichero = new Map<string, string>();
  for (const m of app.matchAll(/import\s+(\w+)\s+from\s+"\.\/routes\/([\w.-]+)\.js"/g)) {
    fichero.set(m[1], m[2] + ".ts");
  }

  const rutas: string[] = [];
  // `app.use("/api/files", authenticate, filesRoutes);`
  for (const m of app.matchAll(/app\.use\("(\/api[^"]*)"([^)]*)\)/g)) {
    const prefijo = m[1];
    for (const ident of m[2].matchAll(/(\w+Routes)\b/g)) {
      const nombre = fichero.get(ident[1]);
      if (!nombre) continue;
      const fuente = readFileSync(join(RAIZ_API, "src/routes", nombre), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const r of fuente.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
        const sufijo = r[2] === "/" ? "/" : r[2];
        rutas.push(`${r[1].toUpperCase()} ${prefijo}${sufijo}`);
      }
    }
  }
  return [...new Set(rutas)];
};

/**
 * La barra final no distingue, y por eso se normaliza a los dos lados.
 *
 * Express arranca con `strict routing` **apagado** —`app.ts` no lo activa, y
 * ése es el valor por defecto—, así que `/api/permiso` y `/api/permiso/` son
 * la misma dirección para el enrutador. El cliente escribe una y el servidor
 * monta la otra en varios sitios, y eso no es un defecto.
 *
 * 🔴 Si alguien enciende `strict routing` alguna vez, esta normalización
 * pasa a esconder roturas reales y hay que quitarla. Queda dicho porque es la
 * única línea de este fichero que da algo por equivalente.
 */
const sinBarraFinal = (camino: string) => camino.replace(/\/+$/, "") || "/";

/** `/api/poste/:id/adss` → una expresión que casa `/api/poste/7/adss`. */
const comoPatron = (ruta: string) =>
  new RegExp(
    "^" + sinBarraFinal(ruta).replace(/[.*+?^${}()|[\]]/g, "\\$&")
      .replace(/:[A-Za-z_]+/g, "[^/]+") + "$",
  );

describe("la dirección existe al otro lado", () => {
  const hayApi = existsSync(join(RAIZ_API, "src/app.ts"));

  it.skipIf(!hayApi)("se ley\u00f3 la tabla del servidor, y no una lista corta", () => {
    const rutas = rutasDelServidor();
    // Anti-vacuidad, y con margen estrecho a prop\u00f3sito: hoy son 135. Un parser
    // que dejara de entender `app.use` devolver\u00eda cero y todo lo de abajo
    // pasar\u00eda sin mirar nada.
    expect(rutas.length, "el an\u00e1lisis del servidor devolvi\u00f3 casi nada").toBeGreaterThan(110);
    expect(rutas.filter((r) => r.startsWith("GET /api/")).length).toBeGreaterThan(40);
  });

  it.skipIf(!hayApi)("cada direcci\u00f3n que pide el cliente la sirve el servidor", async () => {
    const patrones = rutasDelServidor().map((r) => ({ ruta: r, patron: comoPatron(r.split(" ")[1]) }));
    const huerfanas: string[] = [];

    for (const caso of CASOS) {
      const direccion = await direccionDe(caso);
      const camino = sinBarraFinal(new URL(direccion).pathname);
      const verbo = caso.verbo.toUpperCase();
      const casa = patrones.some((p) => p.ruta.startsWith(verbo + " ") && p.patron.test(camino));
      if (!casa) huerfanas.push(`${caso.nombre}: ${verbo} ${camino}`);
      vi.restoreAllMocks();
    }

    expect(
      huerfanas,
      `el cliente pide direcciones que el servidor no monta: ${huerfanas.join(" | ")}`,
    ).toEqual([]);
  });
});
