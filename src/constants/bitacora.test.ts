// Where a row of the audit log can take the person reading it.
//
// The names of actions and entities are not tested here because they are not
// here: the server sends them with each row (see the header of `bitacora.ts`).
// A test in this file that read the server's vocabulary was the first attempt
// at keeping the two in step, and it protected nothing where it mattered — the
// deploy build has no API repository beside it, so the test skipped itself.
//
// What this file holds is the half only the client knows: its own addresses,
// and who is offered each one.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { destinoDeEntidad, enlaceDeFila, nombreDeAccion, nombreDeEntidad } from "./bitacora";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../lib/permissions";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Every entity the server writes or has written. */
const ENTIDADES = [
  "Poste", "Evento", "Revisión", "Solución", "Ciudad", "Tramo",
  "Material", "Propietario", "Adss", "TipoObs", "Obs",
  "ReporteVista", "File", "Usuario", "Rol",
  "Sesion", "FactorTotp", "credencial_webauthn", "CodigoRecuperacion",
];

const ROL = 3;
const YO = { id: 7, id_rol: ROL };
const con = (...modulos: Modulo[]) => {
  const p = sinPermisos();
  for (const m of modulos) p[m].ver = true;
  setPermisos(ROL, p);
};
const fila = (over: Record<string, unknown>) => ({
  action: "UPDATE_POSTE", entity: "Poste", entity_id: 12, id_usuario: 7, ...over,
}) as Parameters<typeof enlaceDeFila>[1];

beforeEach(() => olvidarPermisos());

describe("what a row is called", () => {
  it("is what the server says, and the stored code only when it says nothing", () => {
    expect(nombreDeAccion({ action: "STEP_UP_DENIED", action_label: "Se le pidió confirmar su identidad" }))
      .toBe("Se le pidió confirmar su identidad");
    // A server older than this client sends no label: shown raw, not blank.
    expect(nombreDeAccion({ action: "STEP_UP_DENIED" })).toBe("STEP_UP_DENIED");
    expect(nombreDeAccion({ action: "STEP_UP_DENIED", action_label: "" })).toBe("STEP_UP_DENIED");
    expect(nombreDeEntidad({ entity: "credencial_webauthn", entity_label: "Llave de acceso" })).toBe("Llave de acceso");
    expect(nombreDeEntidad({ entity: "credencial_webauthn" })).toBe("credencial_webauthn");
  });
});

describe("who is offered a link", () => {
  it("nobody who cannot open where it leads", () => {
    // The link used to be drawn for anyone. The route refused, and put the
    // person on some other screen without a word.
    con("bitacora");
    expect(enlaceDeFila(YO, fila({}))).toBeNull();
    expect(enlaceDeFila(YO, fila({ entity: "Rol", entity_id: 7 }))).toBeNull();
    expect(enlaceDeFila(YO, fila({ entity: "Material", entity_id: 5 }))).toBeNull();

    con("bitacora", "postes");
    expect(enlaceDeFila(YO, fila({}))).toBe("/app/postes/12");
    // One permission opens one module and no other.
    expect(enlaceDeFila(YO, fila({ entity: "Evento" }))).toBeNull();
    expect(enlaceDeFila(YO, fila({ entity: "Rol", entity_id: 7 }))).toBeNull();
  });

  it("each entity asks for its own module's permission", () => {
    // Stated one by one because a wrong module here is a link drawn for people
    // the route will then turn away — or hidden from people it would let in.
    const modulos = Object.fromEntries(ENTIDADES.map((e) => [e, destinoDeEntidad(e, 1)?.modulo ?? null]));
    expect(modulos).toEqual({
      Poste: "postes",
      Evento: "eventos", "Revisión": "eventos", "Solución": "eventos",
      Ciudad: "ciudades",
      Tramo: "tramos",
      Material: "parametros", Propietario: "parametros", Adss: "parametros",
      TipoObs: "parametros", Obs: "parametros",
      ReporteVista: "generador",
      File: "archivos",
      Usuario: "seguridad",
      Rol: "roles",
      // No screen of their own, and the id stored is the factor's, not the
      // person's: no link rather than a link to the wrong account.
      Sesion: null, FactorTotp: null, credencial_webauthn: null, CodigoRecuperacion: null,
    });
  });

  it("a sheet with no id leads nowhere; a list does", () => {
    expect(destinoDeEntidad("Poste", null)).toBeNull();
    expect(destinoDeEntidad("Usuario", undefined)).toBeNull();
    expect(destinoDeEntidad("File", null)?.path).toBe("/app/archivos");
    expect(destinoDeEntidad("ReporteVista", null)?.path).toBe("/app/generador");
    // A tramo has no sheet of its own: the network map opens on it; without an id, the screen.
    expect(destinoDeEntidad("Tramo", 14)).toEqual({ modulo: "tramos", path: "/app/tramos/14" });
    expect(destinoDeEntidad("Tramo", null)).toEqual({ modulo: "tramos", path: "/app/tramos" });
    expect(destinoDeEntidad("Rol", 7)?.path).toBe("/app/roles?rol=7");
    expect(destinoDeEntidad("Adss", 5)?.path).toBe("/app/parametros?tab=adss&id=5");
  });
});

describe("a saved report, which is private to whoever made it", () => {
  // The server writes `READ_REPORTE_DENIED` against anyone who asks for
  // somebody else's private report. So an administrator reading the log and
  // pressing «Vista de informe #12» on a colleague's row was recorded as
  // trying to open it — and that record was itself a link that wrote another.
  const vista = (over: Record<string, unknown>) =>
    fila({ action: "CREATE_REPORTE_VISTA", entity: "ReporteVista", entity_id: 12, ...over });

  beforeEach(() => con("bitacora", "generador"));

  it("is linked from a row its reader wrote", () => {
    expect(enlaceDeFila(YO, vista({ id_usuario: 7 }))).toBe("/app/generador?vista=12");
    expect(enlaceDeFila(YO, vista({ id_usuario: 7, action: "UPDATE_REPORTE_VISTA" }))).toBe("/app/generador?vista=12");
    // The copy belongs to whoever duplicated it, and the row carries the copy's id.
    expect(enlaceDeFila(YO, vista({ id_usuario: 7, action: "DUPLICATE_REPORTE_VISTA" }))).toBe("/app/generador?vista=12");
  });

  it("is not linked from somebody else's row: the Generador itself is", () => {
    expect(enlaceDeFila(YO, vista({ id_usuario: 99 }))).toBe("/app/generador");
    expect(enlaceDeFila(YO, vista({ id_usuario: 99, action: "UPDATE_REPORTE_VISTA" }))).toBe("/app/generador");
  });

  it("is never linked from a refusal, not even the reader's own", () => {
    // Their own refusal is about a report that is not theirs, by definition.
    for (const action of ["READ_REPORTE_DENIED", "EDIT_REPORTE_DENIED", "DELETE_REPORTE_DENIED", "DUPLICATE_REPORTE_DENIED"]) {
      expect(enlaceDeFila(YO, vista({ id_usuario: 7, action })), action).toBe("/app/generador");
    }
  });

  it("is not linked once archived, which would only answer that it does not exist", () => {
    expect(enlaceDeFila(YO, vista({ id_usuario: 7, action: "DELETE_REPORTE_VISTA" }))).toBe("/app/generador");
  });

  it("still asks for the module: no link at all without `generador`", () => {
    con("bitacora");
    expect(enlaceDeFila(YO, vista({ id_usuario: 7 }))).toBeNull();
    expect(enlaceDeFila(YO, vista({ id_usuario: 99 }))).toBeNull();
  });

  it("leaves every other entity's link alone, whoever wrote the row", () => {
    con("bitacora", "postes", "roles");
    expect(enlaceDeFila(YO, fila({ id_usuario: 99 }))).toBe("/app/postes/12");
    expect(enlaceDeFila(YO, fila({ id_usuario: 99, action: "DELETE_POSTE" }))).toBe("/app/postes/12");
    expect(enlaceDeFila(YO, fila({ id_usuario: 99, entity: "Rol", entity_id: 7, action: "ROLE_CHANGE_DENIED" })))
      .toBe("/app/roles?rol=7");
  });
});

describe("every destination is an address the application serves", () => {
  it("read from the route table, not assumed", () => {
    // Two screens kept tables of their own that pointed at `/eventos/7`. No
    // such route: the catch-all sent it to the home page, and nothing failed.
    // Read from `App.tsx`, so a screen that moves takes its links with it or
    // fails here.
    const app = readFileSync(resolve(AQUI, "../App.tsx"), "utf8");
    // `tramos/:id?` is one route that serves two addresses — the map, and a
    // tramo's card on it — so it is read as both.
    const rutas = Array.from(app.matchAll(/<Route path="([a-z-]+(?:\/:id\??)?)"/g), (m) => m[1])
      .flatMap((ruta) => (ruta.endsWith("/:id?") ? [ruta.slice(0, -"/:id?".length), ruta.slice(0, -1)] : [ruta]));
    expect(rutas.length, "no se leyó la tabla de rutas").toBeGreaterThan(10);

    let comprobadas = 0;
    for (const entidad of ENTIDADES) {
      const destino = destinoDeEntidad(entidad, 7);
      if (!destino) continue;
      const camino = destino.path.split("?")[0];
      expect(camino.startsWith("/app/"), `${entidad} → ${camino}`).toBe(true);
      expect(rutas, `${entidad} → ${camino}`).toContain(camino.slice("/app/".length).replace(/\/7$/, "/:id"));
      comprobadas += 1;
    }
    expect(comprobadas).toBe(15);
  });

  it("no screen keeps a table of addresses of its own", () => {
    // The defect was not one wrong table; it was three tables. Any file under
    // `src` that builds one of these paths by hand, outside this module and the
    // route table, is a fourth.
    const raiz = resolve(AQUI, "..");
    const ficheros: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = resolve(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) ficheros.push(ruta);
      }
    };
    recorrer(raiz);
    expect(ficheros.length).toBeGreaterThan(100);

    const sinApp = /[`"']\/(eventos|postes|ciudades|usuarios|roles|parametros|generador|archivos)\/?\$?\{/;
    const culpables = ficheros
      .filter((f) => sinApp.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(raiz.length + 1).replace(/\\/g, "/"));
    expect(culpables, "direcciones construidas sin /app, que caen en la página de inicio").toEqual([]);
  });
});
