// The three options requests: where each one goes, and what it hands back.
//
// This layer had **no test at all** before C2, and neither did the eight
// catalogue modules it replaces — coverage of functions across `Ciudad.api`,
// `Adss.api`, `Material.api`, `Propietario.api`, `Obs.api`, `TipoObs.api` and
// `Poste.api` was zero, meaning not one of their functions had ever been
// executed by the suite. Seven screens changed the address they ask for and
// nothing in the repository could have noticed if one of them went to the wrong
// place, which is why these tests come first.
//
// **What this file proves, stated narrowly, because its first version claimed
// more than it did.** These three functions are `axios.get(...).then(r =>
// r.data)` and nothing else — they read no field — so an assertion here about
// `ciudad[0].lat` is an assertion about this file's own fixture, not about the
// module. Its own audit caught that. What is genuinely pinned:
//
//   - **the address**, anchored at the end of the string axios is handed. This
//     is the whole point: the eight endpoints being replaced carry no
//     permission at all, so drifting back to any of them leaves every seeded
//     role working and the task quietly undone.
//   - **that no config travels** with the request, so no `params` nobody reads.
//   - **that a rejection reaches the caller.** A client that answered `[]` on
//     403 would rebuild the exact defect this arc removes, one layer down.
//   - **`opcionesDenegadas`**, including the 403s that are not a missing
//     permission.
//   - and, at the bottom, **the block names the server really sends**, read out
//     of the other repository's source.
//
// The fixtures below are kept byte-exact against the server's projections
// anyway: they are what every screen test's own fixture is copied from, and a
// fixture richer than the wire is how a suite goes green over a screen that
// cannot work.

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import {
  getOpcionesPoste, getOpcionesEvento, getOpcionesReporte, opcionesDenegadas,
} from "./opciones.api";

afterEach(() => {
  vi.restoreAllMocks();
});

/** What `/api/poste/opciones` really answers, shapes included. */
const POSTE = {
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
};

const EVENTO = {
  obs: [{ id: 5, name: "Poste inclinado", id_tipoObs: 2 }],
  tipoObs: [{ id: 2, name: "Estructura" }],
};

const REPORTE = {
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  obs: [{ id: 5, name: "Poste inclinado" }],
  tramos: [{ id_ciudadA: 3, id_ciudadB: 11 }],
};

describe("getOpcionesPoste", () => {
  it("asks the pole router for its options, and nothing else", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: POSTE });

    await getOpcionesPoste();

    expect(get).toHaveBeenCalledTimes(1);
    // Anchored at the end. The four addresses this replaces — `/api/adss/`,
    // `/api/ciudad/`, `/api/material/`, `/api/propietario/` — carry no
    // permission at all, so a drift back to any of them keeps every screen
    // working for every seeded role and quietly undoes the whole task.
    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/poste\/opciones$/);
    expect(get.mock.calls[0][1]).toBeUndefined();
  });

  it("hands back the four blocks under their own names", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: POSTE });

    const o = await getOpcionesPoste();

    expect(Object.keys(o).sort()).toEqual(["adss", "ciudad", "material", "propietario"]);
  });

  it("keeps the coordinates the pole sheet draws its map with", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: POSTE });

    const o = await getOpcionesPoste();

    // By value. `PosteSheet` guards with `if (!a?.lat || !a?.lng …) return`, so
    // a city list that lost the two columns produces a sheet with a map, no
    // stretch line, no neighbouring poles and no error of any kind.
    expect(o.ciudad[0].lat).toBe(-18.0146);
    expect(o.ciudad[0].lng).toBe(-70.2536);
  });

  it("lets a refusal through instead of answering an empty catalogue", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({ response: { status: 403 } });

    // A client that caught its own error and returned empty lists would give
    // every caller the exact screen this task exists to remove: four empty
    // dropdowns and nothing said.
    await expect(getOpcionesPoste()).rejects.toBeTruthy();
  });
});

describe("getOpcionesEvento", () => {
  it("asks the incident router for its options", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: EVENTO });

    await getOpcionesEvento();

    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/evento\/opciones$/);
  });

  it("keeps the type each observation belongs to", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: EVENTO });

    const o = await getOpcionesEvento();

    // Both incident forms build their accordion with
    // `listObs.filter(o => o.id_tipoObs === tipo.id)`. Without the column every
    // group is empty and the section renders as though nothing were configured
    // — which is a claim about the database, not about the request.
    expect(o.obs[0].id_tipoObs).toBe(2);
    expect(Object.keys(o).sort()).toEqual(["obs", "tipoObs"]);
  });

  it("lets a refusal through", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({ response: { status: 403 } });
    await expect(getOpcionesEvento()).rejects.toBeTruthy();
  });
});

describe("getOpcionesReporte", () => {
  it("asks the report router for its options", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: REPORTE });

    await getOpcionesReporte();

    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/reporte\/opciones$/);
    expect(get.mock.calls[0][1]).toBeUndefined();
  });

  it("hands back the six blocks, stretches included", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: REPORTE });

    const o = await getOpcionesReporte();

    expect(Object.keys(o).sort())
      .toEqual(["adss", "ciudad", "material", "obs", "propietario", "tramos"]);
    // A pair, not a row: `{id, name}` here would mean the stretch comboboxes
    // offer nothing, on all three report screens, silently.
    expect(o.tramos[0].id_ciudadA).toBe(3);
    expect(o.tramos[0].id_ciudadB).toBe(11);
    expect(o.ciudad[0].lat).toBe(-18.0146);
  });

  it("lets a refusal through", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({ response: { status: 403 } });
    await expect(getOpcionesReporte()).rejects.toBeTruthy();
  });
});

describe("opcionesDenegadas", () => {
  it("tells a refusal apart from everything else", () => {
    // The distinction every consumer draws its message from: "you may not" is
    // permanent and retrying is pointless, "it did not arrive" is worth another
    // go. They used to share one sentence, and two screens shared silence.
    expect(opcionesDenegadas({ response: { status: 403 } })).toBe(true);
    expect(opcionesDenegadas({ response: { status: 500 } })).toBe(false);
    expect(opcionesDenegadas({ response: { status: 401 } })).toBe(false);
    // A network failure has no response at all, and neither does a TypeError
    // thrown inside the `.then`.
    expect(opcionesDenegadas(new Error("Network Error"))).toBe(false);
    expect(opcionesDenegadas(undefined)).toBe(false);
  });

  it("does not call a pending second factor a missing permission", () => {
    // `authenticate` answers 403 with `code: FACTOR_PENDIENTE` when an
    // account's grace period for setting up a second factor has run out, and
    // `requireStepUp` answers 403 with `code: STEP_UP_REQUIRED`. The step-up
    // interceptor shows its own message and re-rejects, so the error reaches
    // the screen intact. Reading either as "you lack the permission" puts a
    // second sentence on screen that contradicts the first and is false — the
    // account has the permission; what it lacks is a factor.
    expect(opcionesDenegadas({ response: { status: 403, data: { code: "FACTOR_PENDIENTE" } } })).toBe(false);
    expect(opcionesDenegadas({ response: { status: 403, data: { code: "STEP_UP_REQUIRED" } } })).toBe(false);
    // And the plain one still is: `code` appears in no other 403 in the server.
    expect(opcionesDenegadas({ response: { status: 403, data: { message: "No tiene permiso." } } })).toBe(true);
  });
});

// ─── The other shore ──────────────────────────────────────────────────────────

/**
 * The block names, read from the server that serves them.
 *
 * Everything above proves the client reads `data.tramos`; none of it proves the
 * server sends `tramos`. The two repositories have no integration test between
 * them and are deployed separately, so the only thing that can tie the names
 * together here is reading the other side's source — the pattern
 * `lib/password.test.ts` already uses for the minimum password length.
 *
 * Its limits, stated rather than discovered later: it is skipped where `api` is
 * not checked out beside `web` (a single-repo CI, a Vercel build), and it is a
 * regex over source rather than a request, so it **fails** when it cannot find
 * what it expects instead of passing quietly. A rewrite of the controller that
 * returns a variable instead of an object literal will break this test, and
 * that is the intended behaviour: the mirror has to be re-aimed by hand rather
 * than silently stop looking.
 */
/**
 * `res.status(200).json({ a, b, c })` → `["a","b","c"]`, for one handler.
 *
 * The window is bounded at the **next** `export const`, which its first version
 * was not: searching the rest of the file meant that any handler written in a
 * shape this regex cannot read — a response built into a variable, a wrapper
 * helper, one nested object — silently matched the *following* handler's
 * response instead. That only failed today by luck, because the three block
 * sets happen to differ; a fourth handler repeating one of them would have made
 * it pass while comparing the wrong thing.
 */
const bloquesDe = (fuente: string, handler: string): string[] => {
  const desde = fuente.indexOf(`export const ${handler} =`);
  if (desde === -1) throw new Error(`no encontré ${handler} en opciones.controller.ts`);
  const resto = fuente.slice(desde);
  const siguiente = resto.indexOf("\nexport const ", 1);
  const ventana = siguiente === -1 ? resto : resto.slice(0, siguiente);
  const json = ventana.match(/res\.status\(200\)\.json\(\{([^}]*)\}\)/);
  if (!json) {
    throw new Error(
      `no encontré la respuesta de ${handler}: o cambió de forma —una variable ` +
      "intermedia, un helper, un objeto anidado— o dejó de responder ahí. " +
      "Este espejo hay que reapuntarlo a mano, no dejarlo mirando a otro sitio.",
    );
  }
  return json[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
};

describe("the blocks the server actually sends", () => {
  it("match the ones this module reads", (ctx) => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const CONTROLADORES = path.resolve(aqui, "../../../api/src/controllers");
    const CONTROLADOR = path.join(CONTROLADORES, "opciones.controller.ts");

    // Only the *repository* being absent is a skip. Its first version checked
    // the file, which meant renaming or moving the controller — exactly the
    // drift this exists to catch — turned the only cross-repository check in
    // the system green and silent.
    if (!existsSync(CONTROLADORES)) {
      ctx.skip("api no está junto a web; el espejo entre repos no se puede comprobar");
      return;
    }
    expect(
      existsSync(CONTROLADOR),
      `${CONTROLADOR} no existe, pero el repositorio api sí: el controlador se ` +
      "movió o se renombró, y este espejo dejó de comprobar nada.",
    ).toBe(true);
    const fuente = readFileSync(CONTROLADOR, "utf8");

    expect(bloquesDe(fuente, "getOpcionesPoste"))
      .toEqual(["adss", "ciudad", "material", "propietario"]);
    expect(bloquesDe(fuente, "getOpcionesEvento"))
      .toEqual(["obs", "tipoObs"]);
    expect(bloquesDe(fuente, "getOpcionesReporte"))
      .toEqual(["adss", "ciudad", "material", "obs", "propietario", "tramos"]);
  });
});
