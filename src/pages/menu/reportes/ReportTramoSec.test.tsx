// The Por Tramo report, and the export that could have gone out empty.
//
// **This is the defect C2 could have introduced, and it is the reason the file
// exists.** Four of this screen's six lists used to be fetched *inside*
// `handleGenerar`, in the same `try` as the report itself. That had a property
// nobody wrote down: if the catalogues failed, the generation failed with them,
// `list` stayed empty, the Resultados card never appeared — and the Export
// button lives inside that card. It was impossible to export without them.
//
// Moving the fetch to mount, which is what one response for six blocks forces,
// removes that protection silently. The report would generate perfectly well
// with `listPropietario`, `listMaterial`, `listAdss` and `listObs` empty, and
// every content column of this report is built from those four. What comes out
// is an Excel with its title, its date range, its pole numbers and coordinates,
// and **not one column of content** — nothing in the file saying so, on its way
// to a client. So the block that used to be a side effect is now stated, and
// this is what states it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportTramoSec from "./ReportTramoSec";

const getOpcionesReporte = vi.fn();
const getReporteTramo = vi.fn();
const getCiudad = vi.fn();
const getAdss = vi.fn();
const getMaterial = vi.fn();
const getPropietario = vi.fn();
const getObs = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getReporteTramo: (...a: unknown[]) => getReporteTramo(...a) }));
// The five this screen used to call, kept so a half-done migration fails here.
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("../../../api/Adss.api", () => ({ getAdss: (...a: unknown[]) => getAdss(...a) }));
vi.mock("../../../api/Material.api", () => ({ getMaterial: (...a: unknown[]) => getMaterial(...a) }));
vi.mock("../../../api/Propietario.api", () => ({ getPropietario: (...a: unknown[]) => getPropietario(...a) }));
vi.mock("../../../api/Obs.api", () => ({ getObs: (...a: unknown[]) => getObs(...a) }));
// Megabytes of parsing for menus this test never opens.
vi.mock("exceljs", () => ({ default: { Workbook: class { } } }));
vi.mock("jspdf", () => ({ default: class { } }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const OPCIONES = {
  ciudad: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  obs: [{ id: 5, name: "Poste inclinado" }],
  tramos: [{ id_ciudadA: 11, id_ciudadB: 12 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getReporteTramo.mockResolvedValue([]);
});

const pintar = () => render(<MemoryRouter><ReportTramoSec /></MemoryRouter>);

const botonGenerar = () => screen.getByRole("button", { name: /Generar/i }) as HTMLButtonElement;

describe("where the six lists come from", () => {
  it("asks once, and never the five old catalogues", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalledTimes(1));
    for (const [nombre, espia] of [
      ["ciudad", getCiudad], ["adss", getAdss], ["material", getMaterial],
      ["propietario", getPropietario], ["obs", getObs],
    ] as const) {
      expect(espia, `la pantalla volvió a pedir el catálogo de ${nombre}`).not.toHaveBeenCalled();
    }
  });

  it("lets the report be generated once they have arrived", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    // The other direction of the test below: without this one, blocking the
    // button unconditionally would pass just as well.
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));
  });
});

describe("while the catalogues are still in flight", () => {
  it("will not generate yet, so the export cannot be reached with empty lists", async () => {
    // **The hole the first version of this fix left, found by its own audit.**
    // Guarding on "did it fail" leaves `null` meaning both *not back yet* and
    // *fine*, so the whole loading window was open: the report is a different
    // request and can answer first, and the Resultados card — which is where
    // the Export button lives — would appear with the four content lists still
    // empty. The file that comes out has its title, its dates and its pole
    // numbers, and not one column of content.
    let entregar: (v: unknown) => void = () => { };
    getOpcionesReporte.mockReturnValue(new Promise((r) => { entregar = r; }));

    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    // The button, and only the button. `userEvent.click` on a disabled element
    // dispatches nothing, so "and clicking it anyway does nothing" would be the
    // previous line restated — which is what the first version of this test
    // did. The guard inside `handleGenerar` and the one inside `handleExport`
    // are deliberately unreachable while this holds; they are there for the day
    // somebody enables the button again, and no test can honestly claim to
    // exercise them from here.
    expect(botonGenerar().disabled).toBe(true);

    entregar(OPCIONES);
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));
  });
});

describe("when the catalogues did not arrive", () => {
  it("refuses to generate, so no export can be built from empty columns", async () => {
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });

    pintar();

    // Disabled is the whole assertion, and the consequence follows from it by
    // construction: no report, so no Resultados card, so no Export button, so
    // no file with its content columns missing. Asserting the rest here would
    // be asserting that a test which never clicked anything did not click
    // anything.
    await waitFor(() => expect(botonGenerar().disabled).toBe(true));
  });

  it("says so on the screen and not only in a toast that has gone", async () => {
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });

    pintar();

    // One sentence, so one assertion: the two halves used to be checked
    // separately as though they were two facts, and they are the same node.
    expect(await screen.findByText(
      /No tiene permiso para consultar los catálogos de informes, y sin ellos este informe saldría sin columnas\./,
    )).toBeTruthy();
  });

  it("tells a refusal apart from a request that failed", async () => {
    getOpcionesReporte.mockRejectedValue(new Error("Network Error"));

    pintar();

    expect(await screen.findByText(/No se pudieron cargar los catálogos/i)).toBeTruthy();
    expect(screen.queryByText(/No tiene permiso/i)).toBeNull();
  });
});
