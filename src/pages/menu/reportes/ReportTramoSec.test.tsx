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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportTramoSec from "./ReportTramoSec";
import { elegirTramo } from "./elegirTramo";

const getOpcionesReporte = vi.fn();
const getReporteTramo = vi.fn();
const exportExcelTramo = vi.fn();
const exportPdfTramo = vi.fn();
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
// Extended, not replaced: a factory naming only the two spied exporters would
// hand the screen `undefined` for everything else it takes from this module.
vi.mock("../../../lib/exports/reportTramo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/exports/reportTramo")>()),
  exportExcelTramo: (...a: unknown[]) => exportExcelTramo(...a),
  exportPdfTramo: (...a: unknown[]) => exportPdfTramo(...a),
}));
// The real DatePicker is a Radix popover over a calendar, and nothing in this
// repository drives one through jsdom. A date input gives the screen the same
// `Date` through `onSelect`, labelled by the same placeholder, so a test can
// type a date instead of hunting a day cell. Local midnight, as the calendar
// hands it over.
vi.mock("../../../components/ui/date-picker", () => ({
  DatePicker: ({ value, onSelect, placeholder }: {
    value?: Date; onSelect?: (d: Date | undefined) => void; placeholder?: string;
  }) => (
    <input
      aria-label={placeholder}
      type="date"
      value={value ? [value.getFullYear(), value.getMonth() + 1, value.getDate()]
        .map((n) => String(n).padStart(2, "0")).join("-") : ""}
      onChange={(e) => onSelect?.(e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined)}
    />
  ),
}));

const TRAMO_1 = {
  id: 1,
  nombre: "Tacna – Ilo",
  ciudades: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
  id_departamento: null,
  departamento: null,
  archivado: false,
};
const TRAMO_14 = {
  id: 14,
  nombre: "Ilo – Moquegua",
  ciudades: [
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
    { id: 13, name: "Moquegua", lat: -17.1956, lng: -70.9356 },
  ],
  id_departamento: null,
  departamento: null,
  archivado: false,
};

const OPCIONES = {
  ciudad: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  obs: [{ id: 5, name: "Poste inclinado" }],
  tramos: [TRAMO_1, TRAMO_14],
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

/**
 * The file's header is the rows' filter — B3, the client half.
 *
 * `handleExport` used to read the two date pickers and the stretch
 * comboboxes, and all of them can be moved without pressing Generar. Rare while
 * Generar always answered; routine once it can answer 429 "espere un momento"
 * (B3: thirty heavy queries a minute, shared with the generator), because "it
 * failed, export what I have" is what a person does. B3's own post-audit found
 * the stretch half after the date half was fixed: generate the whole network
 * for January, pick a stretch in the comboboxes, press Excel — a workbook
 * headed `Tramo: Tacna — …` over every incident on the network, with nothing
 * inside it saying so. The export now reads what the rows were generated with,
 * dates and stretch alike, and this is what pins it.
 */
const filaDe = (id: number, description: string, tramo: typeof TRAMO_1) => ({
  id, description, date: "2026-01-10T12:00:00.000Z",
  state: false, priority: false, image: null,
  poste: {
    id: 5, name: "P-5", lat: -18.01, lng: -70.25, id_tramo: tramo.id, tramo,
    material: { id: 7, name: "Madera" }, propietario: { id: 2, name: "Osefi" }, adsspostes: [],
  },
  eventoObs: [], revisions: [], solucions: [],
});
const FILA = filaDe(1, "Poste inclinado", TRAMO_1);

const fechar = (etiqueta: string, iso: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: iso } });

/** January typed in and Generar pressed; the rows are on screen after it. */
const generarEnero = async (user: ReturnType<typeof userEvent.setup>) => {
  fechar("Inicio", "2026-01-01");
  fechar("Fin", "2026-01-31");
  await user.click(botonGenerar());
  expect(await screen.findByText("Resultados")).toBeTruthy();
};

describe("the tramo is asked of the server", () => {
  it("asks the server for the chosen tramo by its id", async () => {
    getReporteTramo.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    await elegirTramo(user, /Ilo – Moquegua/);
    await generarEnero(user);

    const [filtro] = getReporteTramo.mock.calls[0] as [Record<string, unknown>];
    expect(filtro.tramo).toBe(14);
    expect("TramoInicial" in filtro).toBe(false);
    expect("TramoFinal" in filtro).toBe(false);
  });

  it("leaves the key out when no tramo is chosen, rather than sending it empty", async () => {
    getReporteTramo.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    await generarEnero(user);

    const [filtro] = getReporteTramo.mock.calls[0] as [Record<string, unknown>];
    expect("tramo" in filtro).toBe(false);
    expect("TramoInicial" in filtro).toBe(false);
    expect("TramoFinal" in filtro).toBe(false);
  });

  it("goes back to the whole network when 'Todos los tramos' is picked again", async () => {
    getReporteTramo.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    await elegirTramo(user, /Ilo – Moquegua/);
    await elegirTramo(user, /Todos los tramos/);
    await generarEnero(user);

    const [filtro] = getReporteTramo.mock.calls[0] as [Record<string, unknown>];
    expect("tramo" in filtro).toBe(false);
  });

  it("shows the rows it was given without filtering them again in the browser", async () => {
    // Rows of two different tramos come back while one is chosen. The server
    // already narrowed; the old client-side filter compared the pole's two
    // cities against the two the person had picked and would have hidden one.
    getReporteTramo.mockResolvedValue([
      filaDe(1, "Poste inclinado", TRAMO_1),
      filaDe(2, "Cable roto", TRAMO_14),
    ]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    await elegirTramo(user, /Ilo – Moquegua/);
    await generarEnero(user);

    expect(screen.getByText("2 eventos")).toBeTruthy();
  });
});

describe("the file's header is the rows' filter", () => {
  it("exports with the dates and the tramo the rows were generated for, not the pickers", async () => {
    getReporteTramo.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    // January, one tramo.
    await elegirTramo(user, /Ilo – Moquegua/);
    await generarEnero(user);

    // Moved, and Generar not pressed again: February, and another tramo.
    fechar("Inicio", "2026-02-01");
    fechar("Fin", "2026-02-28");
    await elegirTramo(user, /Tacna – Ilo/);

    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Excel/i }));
    await waitFor(() => expect(exportExcelTramo).toHaveBeenCalledTimes(1));
    const [excel] = exportExcelTramo.mock.calls[0] as [{
      fechaInicio: Date; fechaFin: Date; tramo: { id: number; nombre: string } | null;
    }];
    // As the file prints them: "Fecha:" and "Tramo:" in its header.
    expect(excel.fechaInicio.toLocaleDateString("es-ES")).toBe("1/1/2026");
    expect(excel.fechaFin.toLocaleDateString("es-ES")).toBe("31/1/2026");
    expect(excel.tramo?.id).toBe(14);
    expect(excel.tramo?.nombre).toBe("Ilo – Moquegua");

    // The PDF takes the same three positionally, which is where a swap hides.
    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /PDF/i }));
    await waitFor(() => expect(exportPdfTramo).toHaveBeenCalledTimes(1));
    const pdf = exportPdfTramo.mock.calls[0] as unknown[];
    expect((pdf[5] as Date).toLocaleDateString("es-ES")).toBe("1/1/2026");
    expect((pdf[6] as Date).toLocaleDateString("es-ES")).toBe("31/1/2026");
    expect((pdf[7] as { id: number }).id).toBe(14);
    expect(pdf).toHaveLength(8);
  });

  it("exports 'the whole network' when the rows were generated without a tramo, even if one is picked after", async () => {
    getReporteTramo.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(botonGenerar().disabled).toBe(false));

    await generarEnero(user);
    await elegirTramo(user, /Tacna – Ilo/);

    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Excel/i }));
    await waitFor(() => expect(exportExcelTramo).toHaveBeenCalledTimes(1));
    expect((exportExcelTramo.mock.calls[0] as [{ tramo: unknown }])[0].tramo).toBeNull();

    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /PDF/i }));
    await waitFor(() => expect(exportPdfTramo).toHaveBeenCalledTimes(1));
    expect((exportPdfTramo.mock.calls[0] as unknown[])[7]).toBeNull();
  });
});
