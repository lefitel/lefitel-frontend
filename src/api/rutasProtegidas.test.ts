// Every route the server puts behind the reauthentication gate has something
// in this client that asks for it.
//
// **The gap this closes, and it is the mirror image of `rutas.test.ts`'s.**
// That file starts from the functions this folder exports and checks where each
// one sends its request. It cannot see the failure that runs the other way: a
// route the server mounts that **no function in this client addresses at all**.
// There is no call to inspect, so there is nothing for a sweep over calls to be
// wrong about, and the suite stays green while the operation is unreachable
// from the application.
//
// That is not hypothetical. `id_rol` was taken off `PUT /api/usuario/:id` and
// moved to `PUT /api/usuario/:id/rol` on the server, and this client was never
// taught the new address. The screen went on posting the role inside the
// profile save; the server discarded the field it no longer accepts, wrote the
// rest, and answered 200; the screen said "Usuario actualizado" and reloaded
// the table with the role unchanged. **Assigning a role — the only way to hand
// out authority from the ERP — said yes and did nothing**, and the shape of it
// was the worst available: the caller who *was* allowed got silence, while the
// caller who was not went on getting a 403 with a sentence.
//
// **Why the gated routes and not all of them.** A route with no caller is only
// a defect if somebody was supposed to be calling it, and plenty of the API is
// legitimately unused by this client. The gated ones are different: the gate is
// there because the route performs an administrative write, and this
// application is what performs them. So "mounted behind the reauthentication
// gate and addressed by nobody" is either server code nothing reaches, or a
// screen sending that operation somewhere it is not honoured. Both want
// looking at, and today the list of exceptions is empty — every one of them has
// a caller.
//
// **Why it parses instead of listing.** A table of routes here would be a
// second copy of the server's mounts, updated by whoever remembered. Both sides
// are read from source: the mounts out of `api/src/routes/*.routes.ts` through
// `app.ts`'s prefixes, and the addresses out of the concatenations this folder
// actually writes. Neither list can be satisfied by editing this file.
//
// **And if the `api` repository is not next door, this is skipped and says so**
// — the two deploy from different machines. Same criterion as its neighbours.
// The half that runs everywhere is `Usuario.api.test.ts`, which pins what each
// function puts on the wire.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_API = resolve(AQUI, "../../../api");

/** Comments discuss old addresses on purpose, here and on the server. */
const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** `//api//usuario/` → `/api/usuario`. Express is not in strict routing mode. */
const normalizar = (camino: string) =>
  ("/" + camino).replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";

/** `/api/usuario/:id/rol` → an expression that matches `/api/usuario/:id/rol`. */
const comoPatron = (ruta: string) =>
  new RegExp(
    "^" + normalizar(ruta).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:[A-Za-z_]+/g, "[^/]+") + "$",
  );

// ─── The server side ─────────────────────────────────────────────────────────

type RutaDelServidor = { ruta: string; conPuerta: boolean };

/**
 * Every route the API mounts, and whether `requireStepUp` is on it.
 *
 * The mount is read whole, from the path up to the `);` that closes the call,
 * so a gate three lines below the path is still seen. That matters: the newest
 * mounts are written one middleware per line.
 */
const rutasDelServidor = (): RutaDelServidor[] => {
  const app = sinComentarios(readFileSync(join(RAIZ_API, "src/app.ts"), "utf8"));

  // `import usuarioRoutes from "./routes/usuario.routes.js";`
  const fichero = new Map<string, string>();
  for (const m of app.matchAll(/import\s+(\w+)\s+from\s+"\.\/routes\/([\w.-]+)\.js"/g)) {
    fichero.set(m[1], m[2] + ".ts");
  }

  const rutas: RutaDelServidor[] = [];
  // `app.use("/api/usuario", authenticate, usuarioRoutes);` — read to the
  // semicolon and not to the first `)`, because a mount can carry a middleware
  // that takes arguments of its own before the router.
  for (const m of app.matchAll(/app\.use\("(\/api[^"]*)"([^;]*);/g)) {
    const prefijo = m[1];
    for (const ident of m[2].matchAll(/(\w+Routes)\b/g)) {
      const nombre = fichero.get(ident[1]);
      if (!nombre) continue;
      const fuente = sinComentarios(readFileSync(join(RAIZ_API, "src/routes", nombre), "utf8"));
      for (const r of fuente.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]*)"([\s\S]*?)\);/g)) {
        rutas.push({
          ruta: `${r[1].toUpperCase()} ${normalizar(prefijo + r[2])}`,
          conPuerta: r[3].includes("requireStepUp"),
        });
      }
    }
  }
  return rutas;
};

// ─── The client side ─────────────────────────────────────────────────────────

type DireccionDelCliente = { verbo: string; camino: string; fichero: string };

/**
 * The verb each helper in this folder ends up using, so a listing read through
 * `todasLasFilas` is not mistaken for a route nobody calls.
 */
const VERBO_DEL_AYUDANTE: Record<string, string> = {
  todasLasFilas: "GET",
  pedirListado: "GET",
  descargarListado: "POST",
};

/** The first argument of a call, as written, starting just after its `(`. */
function primerArgumento(fuente: string, desde: number): string {
  let profundidad = 0;
  let comilla = "";
  for (let i = desde; i < fuente.length; i++) {
    const c = fuente[i];
    if (comilla) {
      if (c === "\\") { i++; continue; }
      if (c === comilla) comilla = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { comilla = c; continue; }
    if ("([{".includes(c)) { profundidad++; continue; }
    if (")]}".includes(c)) {
      if (profundidad === 0) return fuente.slice(desde, i);
      profundidad--;
      continue;
    }
    if (c === "," && profundidad === 0) return fuente.slice(desde, i);
  }
  return "";
}

/** `urlApi + urlUsuario + id + "/rol"` → the four pieces, unevaluated. */
function sumandos(expresion: string): string[] {
  const partes: string[] = [];
  let actual = "";
  let profundidad = 0;
  let comilla = "";
  for (let i = 0; i < expresion.length; i++) {
    const c = expresion[i];
    if (comilla) {
      actual += c;
      if (c === "\\") { actual += expresion[++i] ?? ""; continue; }
      if (c === comilla) comilla = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { comilla = c; actual += c; continue; }
    if ("([{".includes(c)) { profundidad++; actual += c; continue; }
    if (")]}".includes(c)) { profundidad--; actual += c; continue; }
    if (c === "+" && profundidad === 0) { partes.push(actual); actual = ""; continue; }
    actual += c;
  }
  partes.push(actual);
  return partes.map((p) => p.trim()).filter((p) => p !== "");
}

/**
 * One piece of a concatenation as text: a literal for what is written down, the
 * constant's value for a name this folder declares, and `:id` for everything
 * else — which is exactly what an identifier in an address is.
 */
function comoTexto(trozo: string, constantes: Map<string, string>): string {
  if (/^["'][\s\S]*["']$/.test(trozo)) return trozo.slice(1, -1);
  if (trozo.startsWith("`")) {
    return trozo.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_entero, dentro: string) => {
      const nombre = dentro.trim();
      return constantes.get(nombre) ?? ":id";
    });
  }
  return constantes.get(trozo) ?? ":id";
}

/**
 * Every address this folder builds, read out of the source.
 *
 * Anything that does not start with `/api` is dropped, and that is the filter
 * that keeps this honest: `urlApi` is the only thing in the folder that
 * produces that prefix, so a `.get(` belonging to a `Map` or a `URLSearchParams`
 * cannot contribute a stray address. Dropping is safe in the direction that
 * matters — a missed address can only make this test fail, never pass.
 */
const direccionesDelCliente = (): DireccionDelCliente[] => {
  const base = new Map<string, string>([["urlApi", "/api/"]]);
  for (const m of readFileSync(join(AQUI, "url.ts"), "utf8")
    .matchAll(/export const (url\w*) = "([^"]*)"/g)) {
    base.set(m[1], m[2]);
  }

  const direcciones: DireccionDelCliente[] = [];
  for (const fichero of readdirSync(AQUI)) {
    if (!fichero.endsWith(".ts") || fichero.endsWith(".test.ts")) continue;
    const fuente = sinComentarios(readFileSync(join(AQUI, fichero), "utf8"));

    // A file may declare an address constant of its own — `urlGenerador` does.
    const constantes = new Map(base);
    for (const m of fuente.matchAll(/const (url\w*) = "([^"]*)"/g)) constantes.set(m[1], m[2]);

    const llamadas = [
      ...fuente.matchAll(/\.(get|post|put|patch|delete)\s*(?:<[^<>()]*>)?\s*\(/g),
      ...fuente.matchAll(/\b(todasLasFilas|pedirListado|descargarListado)\s*(?:<[^<>()]*>)?\s*\(/g),
    ];
    for (const llamada of llamadas) {
      const verbo = VERBO_DEL_AYUDANTE[llamada[1]] ?? llamada[1].toUpperCase();
      const expresion = primerArgumento(fuente, llamada.index! + llamada[0].length);
      const camino = normalizar(
        sumandos(expresion).map((t) => comoTexto(t, constantes)).join(""),
      );
      if (!camino.startsWith("/api")) continue;
      direcciones.push({ verbo, camino, fichero });
    }
  }
  return direcciones;
};

// ─── The assertions ──────────────────────────────────────────────────────────

describe("las rutas protegidas del servidor tienen quien las llame", () => {
  const hayApi = existsSync(join(RAIZ_API, "src/app.ts"));

  it.skipIf(!hayApi)("se leyeron los dos lados, y no dos listas cortas", () => {
    // Anti-vacuity, and it is the whole safety of the sweep below: a parser
    // that stopped understanding either side would return nothing and certify
    // everything. Both bounds sit just under today's numbers on purpose — this
    // is a floor, not a census, so adding a route or a function moves neither.
    const rutas = rutasDelServidor();
    const conPuerta = rutas.filter((r) => r.conPuerta);

    expect(rutas.length, "el análisis del servidor devolvió casi nada").toBeGreaterThan(110);
    expect(
      conPuerta.length,
      "no se reconoció ninguna puerta de reautenticación en los routers",
    ).toBeGreaterThan(20);
    expect(
      direccionesDelCliente().length,
      "no se reconoció ninguna dirección en src/api",
    ).toBeGreaterThan(60);
  });

  it.skipIf(!hayApi)("ninguna operación protegida se pide desde ningún sitio", () => {
    const direcciones = direccionesDelCliente();
    const huerfanas = rutasDelServidor()
      .filter((r) => r.conPuerta)
      .filter(({ ruta }) => {
        const [verbo, camino] = ruta.split(" ");
        const patron = comoPatron(camino);
        return !direcciones.some((d) => d.verbo === verbo && patron.test(d.camino));
      })
      .map((r) => r.ruta);

    expect(
      huerfanas,
      `el servidor protege operaciones que este cliente no pide desde ninguna función:\n  ${huerfanas.join("\n  ")}`,
    ).toEqual([]);
  });
});
