// The pole list's two inline dropdowns, which used to fail in complete silence.
//
// Material and Propietario are editable from the table itself. Their two lists
// were loaded with `.catch(() => { /* silent: dropdowns just won't populate */ })`.
// Since C2 they come from `/api/poste/opciones`, and whatever the reason a
// refusal or a network failure is, silence turns it into a menu that opens with
// nothing in it and no way to find out why. (The screen itself sits behind
// `postes.ver` through `<ModuleRoute>`, so the *refused* case is not reachable
// from here — it costs one branch and the screen should not have to know which
// gate protects it.)
//
// The third state matters as much as the other two: a catalogue that is
// legitimately empty must not say "Cargando…" for ever, which is the same class
// of lie this task removed from the pole sheet's "Sin ADSS registradas".
//
// The second thing pinned here is the one no other test can see: the cell's
// name is now resolved from the catalogue against `id_material`, which is what
// lets the optimistic update move only the id. Before C2 it wrote a whole
// `MaterialInterface` into the row — a shape the catalogue no longer hands
// back, and one this screen has in fact never received, since `GET /api/poste/`
// projects the association to `{id, name}` too.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PostePage from "./index";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import { toast } from "sonner";

const saveAs = vi.fn();
const getOpcionesPoste = vi.fn();
const getPoste = vi.fn();
const exportarPostes = vi.fn();
const editPoste = vi.fn();
const getMaterial = vi.fn();
const getPropietario = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesPoste: () => getOpcionesPoste(),
}));
vi.mock("../../../api/Poste.api", () => ({
  getPoste: (...a: unknown[]) => getPoste(...a),
  exportarPostes: (...a: unknown[]) => exportarPostes(...a),
  editPoste: (...a: unknown[]) => editPoste(...a),
  searchPoste: vi.fn(),
  deletePoste: vi.fn(),
  desarchivarPoste: vi.fn(),
}));
vi.mock("../../../api/Evento.api", () => ({ getEvento_poste: vi.fn() }));
// The two this screen used to call.
vi.mock("../../../api/Material.api", () => ({ getMaterial: (...a: unknown[]) => getMaterial(...a) }));
vi.mock("../../../api/Propietario.api", () => ({ getPropietario: (...a: unknown[]) => getPropietario(...a) }));
// The two sheets are somebody else's tests.
vi.mock("../../../components/dialogs/upsert/PosteSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/upsert/EventoSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
// `exceljs`, `jspdf` and `jspdf-autotable` were mocked here so the export menu
// would not drag megabytes of parser into a render test. This screen imports
// none of them any more: the file is built on the server and what arrives is
// bytes. `file-saver` stays, because saving those bytes is still the browser's
// job — and it is spied rather than stubbed, so the tests at the end can see
// what it was handed.
vi.mock("file-saver", () => ({ saveAs: (...a: unknown[]) => saveAs(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const OPCIONES = {
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }, { id: 8, name: "Concreto" }],
  propietario: [{ id: 2, name: "Osefi" }],
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
};

/** One row, with the association projected exactly as `GET /api/poste/` sends it. */
const FILA = {
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_ciudadA: 11, id_ciudadB: 12, id_usuario: 1,
  material: { id: 7, name: "Madera" },
  propietario: { id: 2, name: "Osefi" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesPoste.mockResolvedValue(OPCIONES);
  getPoste.mockResolvedValue({ data: [FILA], total: 1, page: 1, totalPages: 1, limit: 15 });
  exportarPostes.mockResolvedValue({ blob: new Blob(["x"]), filename: "Postes_01-01-2026_00-00-00.xlsx" });
  editPoste.mockResolvedValue({ status: 200 });
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = () =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <PostePage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

/** The cell trigger, found by its title rather than its text, which changes. */
const abrirMaterial = async () => {
  const disparador = await screen.findByTitle("Click para cambiar material");
  await userEvent.click(disparador);
};

describe("where the two inline lists come from", () => {
  it("asks the options endpoint and never the two old catalogues", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalledTimes(1));
    expect(getMaterial, "la pantalla volvió a pedir /api/material/").not.toHaveBeenCalled();
    expect(getPropietario, "la pantalla volvió a pedir /api/propietario/").not.toHaveBeenCalled();
  });

  it("offers the catalogue as options", async () => {
    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());

    await abrirMaterial();

    expect(await screen.findByRole("menuitem", { name: /Concreto/ })).toBeTruthy();
  });

  it("shows the new material as soon as it is chosen, before the server answers", async () => {
    // What this proves: the cell resolves its name from the catalogue against
    // `id_material`, so moving only the id is enough to repaint it. It does
    // **not** prove the converse — a version that also wrote a nested row would
    // paint the same thing and pass. That one is caught by the compiler, since
    // `MaterialInterface` requires a `description` the catalogue does not
    // carry; the first version of this comment claimed the test caught it.
    // Never settles: the assertion is about what the row shows *before* the
    // server answers, and resolving afterwards would only add a state update
    // outside `act`.
    editPoste.mockReturnValue(new Promise(() => { }));

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();
    await userEvent.click(await screen.findByRole("menuitem", { name: /Concreto/ }));

    await waitFor(() => expect(screen.getByTitle("Click para cambiar material").textContent)
      .toContain("Concreto"));
    expect(editPoste).toHaveBeenCalled();
  });
});

describe("when the lists are refused", () => {
  it("says so inside the menu instead of opening it empty", async () => {
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();

    expect(await screen.findByText(/No tiene permiso para consultar los materiales/i)).toBeTruthy();
  });

  it("does not claim to still be loading once the answer is in", async () => {
    // A fresh install, or every material archived. `falloOpciones` stayed null
    // in that case and the menu said "Cargando…" with nothing coming.
    getOpcionesPoste.mockResolvedValue({ ...OPCIONES, material: [] });

    pintar();
    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    await abrirMaterial();

    expect(await screen.findByText("Sin materiales registrados.")).toBeTruthy();
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("keeps showing the material the row already had", async () => {
    // The fallback in the cell. Without it, a refusal would blank the column
    // for every pole on screen — turning a permission problem into what looks
    // like missing data.
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });

    pintar();

    await waitFor(() => expect(screen.getByTitle("Click para cambiar material").textContent)
      .toContain("Madera"));
  });
});

describe("el botón de exportar", () => {
  /** Pinta, espera al primer listado y abre el menú de exportación. */
  const abrirMenu = async () => {
    pintar();
    await waitFor(() => expect(getPoste).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
  };

  it("pide el fichero al servidor y lo guarda con el nombre que el servidor eligió", async () => {
    await abrirMenu();
    await userEvent.click(await screen.findByText("Excel (.xlsx)"));

    await waitFor(() => expect(exportarPostes).toHaveBeenCalled());
    // El formato viaja como valor del vocabulario del servidor — "excel" — y no
    // como la extensión del fichero, que es sólo cómo acaba llamándose.
    expect(exportarPostes.mock.calls[0][0]).toBe("excel");
    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    // Lo que mide esta línea es que la pantalla reenvía a `saveAs` el nombre
    // que le dan, y nada más: el módulo de la API está simulado entero, así
    // que ni `descargarListado` ni la lectura de la cabecera llegan a
    // ejecutarse aquí. Que ese nombre salga de `Content-Disposition` — con sus
    // dos formas, para que los acentos sobrevivan — lo cubre
    // `generador.api.test.ts`, que ejercita la misma función de `descarga.ts`.
    expect(saveAs.mock.calls[0][1]).toBe("Postes_01-01-2026_00-00-00.xlsx");
  });

  it("manda el orden que la pantalla tiene puesto, no el de por defecto", async () => {
    // 🔴 Lo que este arco arregla. El botón de antes llamaba a la API sin un
    // solo parámetro: ni filtros, ni orden, ni pestaña. El fichero no tenía
    // relación con lo que estabas mirando y nada dentro lo decía.
    //
    // Se comprueba el orden y no el filtro porque la cabecera de una columna es
    // alcanzable y la barra de filtros vive tras un icono sin texto. **No son
    // el mismo objeto**: `exportar` construye el suyo y `load` el suyo, que es
    // precisamente por lo que pueden separarse — una auditoría encontró que
    // `load()` sin argumentos tiraba el filtro y el estado lo conservaba. Los
    // dos leen ahora `query.current`, y eso es lo que sujeta la prueba de
    // «refrescar conserva el orden», más abajo.
    pintar();
    await waitFor(() => expect(getPoste).toHaveBeenCalled());
    // La cabecera y no el botón del mismo nombre que hay dentro de cada fila:
    // ese navega a la ficha del poste. La cabecera ordenable es un `div` con
    // `onClick`, sin rol de botón — anotado de paso, porque tampoco se puede
    // usar con el teclado.
    // Dentro de la cabecera, no la cabecera: el `onClick` vive en un `div` de
    // dentro, y un clic en el `th` no baja hasta él.
    const cabecera = screen.getByRole("columnheader", { name: /Nombre/ });
    await userEvent.click(within(cabecera).getByText("Nombre"));
    await waitFor(() => expect(getPoste).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await userEvent.click(await screen.findByText("CSV"));

    await waitFor(() => expect(exportarPostes).toHaveBeenCalled());
    const [formato, params] = exportarPostes.mock.calls[0] as [string, { sortBy: string[]; archived: boolean }];
    expect(formato).toBe("csv");
    expect(params.sortBy).toEqual(["name"]);
    // La pestaña activa, dicha explícitamente. La rama de archivados existe en
    // `exportar` y hoy no se puede alcanzar: esa pestaña no tiene menú de
    // exportación, ni lo tenía antes de este cambio.
    expect(params.archived).toBe(false);
  });

  it("dice lo que falló, en vez de no hacer nada", async () => {
    // 🔴 Ninguno de los nueve botones tenía `.catch`. Un fallo no producía
    // fichero, ni mensaje, ni línea en la consola; y las frases que el servidor
    // escribe para el usuario — "ya hay una exportación en curso", "la lista
    // supera el máximo" — no llegaban a nadie.
    exportarPostes.mockRejectedValue(new Error("cualquier cosa"));
    await abrirMenu();
    await userEvent.click(await screen.findByText("PDF"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("mientras construye, lo dice y deja los tres formatos deshabilitados", async () => {
    // Sin estado de carga no había nada en pantalla entre el clic y la descarga,
    // así que la reacción natural a tres segundos de espera era volver a pulsar,
    // y cada clic era otra pasada entera sobre la tabla.
    //
    // Lo que sujeta esto es el `disabled` de los tres elementos del menú, y no
    // el `if (exportando) return` de `exportar`: quitar el guardían no rompe
    // esta prueba, porque el clic ya no llega. Comprobado con una mutación — la
    // primera versión de esta prueba se llamaba "no lanza una segunda
    // construcción" y pasaba por un motivo distinto del que decía. El guardían
    // se queda, para una llamada que no venga del menú; lo que se mide aquí es
    // lo que ve el usuario.
    let resolver: (v: unknown) => void = () => { };
    exportarPostes.mockReturnValue(new Promise((r) => { resolver = r; }));

    await abrirMenu();
    await userEvent.click(await screen.findByText("Excel (.xlsx)"));
    await waitFor(() => expect(exportarPostes).toHaveBeenCalledTimes(1));

    // El menú sigue abierto: `onSelect` cancela el cierre a propósito, para que
    // el "Generando…" se vea. (Y mientras está abierto, Radix marca el resto de
    // la página como oculta, así que el disparador no se puede volver a buscar.)
    expect(await screen.findByText("Generando…")).toBeInTheDocument();
    for (const etiqueta of ["Generando…", "CSV", "PDF"]) {
      expect(screen.getByText(etiqueta).closest("[role=\"menuitem\"]"))
        .toHaveAttribute("aria-disabled", "true");
    }
    await userEvent.click(screen.getByText("CSV"));
    expect(exportarPostes).toHaveBeenCalledTimes(1);

    resolver({ blob: new Blob(["x"]), filename: "Postes.csv" });
  });
});

describe("la consulta que el servidor recibe de verdad", () => {
  it("refrescar conserva el orden en vez de volver a la lista de siempre", async () => {
    // 🔴 `load` leía sus valores por defecto del cierre de la **primera**
    // renderización — `1, 15, [], []` — así que toda llamada sin argumentos
    // (el botón de refrescar, y lo que hacen los tres diálogos al guardar) pedía
    // en silencio la página uno sin filtro ni orden, mientras el estado
    // conservaba el filtro y el chip seguía dibujado en pantalla. Y como la
    // exportación leía ese mismo estado, el fichero habría salido filtrado y la
    // pantalla no: el desacuerdo que esta tarea existe para cerrar, entrando
    // por el otro lado.
    pintar();
    await waitFor(() => expect(getPoste).toHaveBeenCalled());

    const cabecera = screen.getByRole("columnheader", { name: /Nombre/ });
    await userEvent.click(within(cabecera).getByText("Nombre"));
    await waitFor(() => expect(getPoste).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(getPoste).toHaveBeenCalledTimes(3));

    const ultima = getPoste.mock.calls[2][0] as { sortBy?: string[] };
    expect(ultima.sortBy, "refrescar tiró el orden de la pantalla").toEqual(["name"]);
  });
});
