// Which screens still compare a status number, and why each one is allowed to.
//
// **What this is for.** C4 found 82 literal comparisons against `200` across 32
// files, and 30 of them broke the moment the server started answering `201` on a
// create and `204` on an archive: "No se pudo archivar" over a row that was
// archived, "No se pudo crear el poste" over a pole that exists — and then the
// person presses the button again and makes a second one. The fix is not to
// change the number, it is to stop reading it: a call either resolves or it
// throws, and `mensajeDeError` says why.
//
// A count that goes down once goes back up. This is the ledger that stops it:
// every remaining comparison is in exactly one list below, and both directions
// are checked, so a new one fails here and a stale entry fails here too. It is
// the mechanism `listShape.test.ts` and `routeGuards.test.ts` already use.
//
// Counted per file rather than per line on purpose: line numbers move under
// three sessions working in this tree, and a ledger that goes red because
// somebody added an import above is a ledger people learn to edit without
// reading. Within a file it counts **comparisons**, not lines — one line holds
// two of them in the pole list (`=== 200 || === 201`), and counting lines meant
// a second comparison could be added to an existing line unseen.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every `=== 200` and its relatives, in code that is not a test.
 *
 * What it deliberately does not catch, because none of it exists in this
 * codebase and a regex that tried would mostly catch itself: a range check
 * (`>= 200 && < 300`), `[200, 201].includes(...)`, a `switch` on the status, a
 * named constant, or a comparison split across two lines. Measured before this
 * was written — the repo has none of those spellings — and if one ever appears
 * this ledger will not see it. The api-layer rule at the bottom of the file is
 * the second net under that.
 */
const COMPARACION = /(===|!==|==|!=)\s*(200|201|204)\b|\b(200|201|204)\s*(===|!==|==|!=)/g;

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { salida.push(...ficheros(ruta)); continue; }
    if (!/\.tsx?$/.test(nombre) || /\.test\.tsx?$/.test(nombre)) continue;
    salida.push(ruta);
  }
  return salida;
}

/** How many files the walk actually opened, so an empty result is detectable. */
let visitados = 0;

/** file → how many status-literal comparisons it makes. */
function inventario(): Record<string, number> {
  const cuenta: Record<string, number> = {};
  visitados = 0;
  // `api` is in the list, and it was the omission that mattered: this whole
  // task is about that folder, and six live comparisons sit in
  // `passkeyCeremony.ts` — one of them against 201 — that the first version of
  // this ledger could not see.
  for (const carpeta of ["api", "pages", "components", "context", "hooks"]) {
    for (const ruta of ficheros(join(src, carpeta))) {
      visitados += 1;
      let n = 0;
      for (const l of readFileSync(ruta, "utf8").split("\n")) {
        // A comment about the pattern is not the pattern. `LoginPage.tsx` has
        // one, and counting it made the first version of this file wrong by one
        // in a way that would have been copied forward for ever.
        if (l.trim().startsWith("//") || l.trim().startsWith("*")) continue;
        n += [...l.matchAll(COMPARACION)].length;
      }
      if (n > 0) cuenta[relative(src, ruta).replace(/\\/g, "/")] = n;
    }
  }
  return cuenta;
}

/**
 * The authentication module's own screens, which §2 of the standard puts
 * outside this arc altogether.
 *
 * None of their endpoints changed: logging in, the second factor, passkeys,
 * recovery codes, renaming an account and changing a password all still answer
 * `200` with a body. Their api functions hand back `{status, ...}` by their own
 * design, which is the shape the rescue flows need — `UsuarioDetallePage` reads
 * `status === 401` to stay quiet when a step-up challenge is really what
 * happened. Converting them is the authentication session's call, not this
 * task's, and doing it from here would edit files somebody else is holding.
 */
const AUTENTICACION = {
  // Six of these are the passkey ceremony's own three-step handshake, in
  // `src/api` itself. They were invisible until this ledger started reading
  // that folder, and one of them compares against **201** — the passkey
  // registration endpoint, which has answered 201 since before C4 and is not
  // one of the fifteen this task moved.
  "api/passkeyCeremony.ts": 6,
  "components/PermisosPanel.tsx": 1,
  "components/dialogs/StepUpDialog.tsx": 3,
  "context/SesionProvider.tsx": 2,
  "pages/ForgotPasswordPage.tsx": 1,
  "pages/LoginPage.tsx": 2,
  "pages/ResetPasswordPage.tsx": 1,
  "pages/login/SegundoFactorPage.tsx": 3,
  "pages/menu/perfil/PerfilPage.tsx": 6,
  "pages/menu/segundoFactor/PasskeysSection.tsx": 2,
  "pages/menu/segundoFactor/RecoveryCodesSection.tsx": 1,
  "pages/menu/segundoFactor/TotpSection.tsx": 4,
  // Three, and it was four: the account unlock stopped comparing against a
  // number at all when C4 moved that route to 204, and reads any 2xx instead.
  "pages/menu/usuario/UsuarioDetallePage.tsx": 3,
} as const;

/**
 * What C4 could not finish, and exactly why.
 *
 * Three files are being rewritten by the map migration right now, and the rule
 * in this tree is that a file mixing two sessions' work stays out of the commit.
 * So five functions in `src/api` still return a number — `createCiudad`,
 * `editCiudad`, `createPoste`, `editPoste`, `reabrirEvento` — each with a note
 * in its own source saying so, and each resolving **200 on success whatever the
 * server really answered**, which is what keeps these eleven comparisons true
 * instead of turning every successful create into a reported failure.
 *
 * Four of the eleven are not in a blocked file: `evento/index.tsx` and
 * `usePosteDetalleData.ts` call `reabrirEvento`, and the function cannot change
 * shape while `EventoDetallePage.tsx` is holding it. The other two,
 * `poste/index.tsx`, call `editPoste` and are held by `PosteSheet.tsx` the same
 * way.
 *
 * **This list must shrink to nothing.** When the map work lands, the five
 * functions become `Promise<void>` or `Promise<T>` like their neighbours and
 * these entries go with them.
 */
const PENDIENTE_MAPLIBRE = {
  "components/dialogs/upsert/CiudadSheet.tsx": 2,
  "components/dialogs/upsert/PosteSheet.tsx": 2,
  "pages/menu/evento/EventoDetallePage.tsx": 1,
  "pages/menu/evento/index.tsx": 1,
  "pages/menu/poste/PosteDetalle/usePosteDetalleData.ts": 1,
  // Four on two lines: both inline edits accept `200 || 201`.
  "pages/menu/poste/index.tsx": 4,
} as const;

describe("el registro de comparaciones contra un código de estado", () => {
  const encontrado = inventario();

  it("leyó los ficheros, así que una barrida vacía no puede pasar", () => {
    // The bound is on **files opened**, not on matches found. Bounding the
    // matches would make this test go red the day the authentication session
    // converts its own screens — a change that is entirely correct — and the
    // person fixing it would edit the threshold, which is exactly the "ledger
    // people learn to edit without reading" this file warns about.
    expect(visitados, "el recorrido no abrió casi ningún fichero").toBeGreaterThan(150);
  });

  it("clasifica cada comparación, y cada entrada clasificada existe", () => {
    const permitido: Record<string, number> = { ...AUTENTICACION, ...PENDIENTE_MAPLIBRE };

    const sinClasificar = Object.keys(encontrado).filter((f) => !(f in permitido));
    expect(
      sinClasificar,
      `estas pantallas comparan contra un código de estado y no dicen por qué:\n  ${sinClasificar.join("\n  ")}\n` +
      "Una escritura que va bien ya no contesta 200: o se lee el fallo con mensajeDeError, o se añade aquí con su motivo.",
    ).toEqual([]);

    const fantasmas = Object.keys(permitido).filter((f) => !(f in encontrado));
    expect(
      fantasmas,
      `estos ficheros ya no comparan nada: quítalos de la lista en vez de dejarla crecer:\n  ${fantasmas.join("\n  ")}`,
    ).toEqual([]);
  });

  it("cuenta cuántas hay en cada uno, así que una nueva no se cuela en un fichero que ya estaba", () => {
    const permitido: Record<string, number> = { ...AUTENTICACION, ...PENDIENTE_MAPLIBRE };
    const desviados = Object.entries(encontrado)
      .filter(([f, n]) => permitido[f] !== undefined && permitido[f] !== n)
      .map(([f, n]) => `${f}: la lista dice ${permitido[f]}, hay ${n}`);

    expect(desviados, `la cuenta cambió:\n  ${desviados.join("\n  ")}`).toEqual([]);
  });

  it("mantiene a la vista la deuda que dejó el trabajo del mapa", () => {
    // Eleven comparisons on nine lines — the pole list holds two per line. The
    // number is here so that closing part of the debt and leaving the rest
    // reads as unfinished rather than as done.
    const deuda = Object.values(PENDIENTE_MAPLIBRE).reduce((a, b) => a + b, 0);
    expect(deuda, "quedan comparaciones esperando a que MapLibre suelte sus tres ficheros").toBe(11);
  });

  it("no deja ninguna función de negocio de src/api tragándose el fallo salvo esas cinco", () => {
    // "de negocio", and the qualifier is load-bearing: about thirty functions
    // in `Login.api.ts`, `Mfa.api.ts`, `Webauthn.api.ts`, `Permisos.api.ts` and
    // the rescue half of `Usuario.api.ts` also swallow their rejection into a
    // `{status, message}` of their own. That is the authentication module,
    // which §2 of the standard puts outside this arc, and converting it is that
    // session's call. This rule is about the two shapes C4 removed.
    // The other half of the same debt, read from the api layer instead of from
    // the screens. Two shapes and not one: thirty-seven ended `.catch(() => 400)`
    // and four more answered `.catch(() => ({ status: 400, data: <fixture> }))`
    // — those four were the worse ones, because the fixture is a UI example row
    // typed as a real entity, so a caller reading `.data` after a failure got a
    // pole that does not exist. Looking only for the first shape is how the
    // first count of this came out at 37 instead of 41.
    const TRAGA = /\.catch\(\(\) => \(?\{? ?status: 400|\.catch\(\(\) => 400\)/;
    const culpables: string[] = [];
    for (const ruta of ficheros(join(src, "api"))) {
      readFileSync(ruta, "utf8").split("\n").forEach((linea, i) => {
        if (!TRAGA.test(linea)) return;
        if (linea.trim().startsWith("*") || linea.trim().startsWith("//")) return;
        culpables.push(`${relative(src, ruta).replace(/\\/g, "/")}:${i + 1}`);
      });
    }
    expect(culpables.length, `quedan estas:\n  ${culpables.join("\n  ")}`).toBe(5);
  });
});
