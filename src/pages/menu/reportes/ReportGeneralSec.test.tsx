// The General report's tramo list, and what it says when it cannot have one.
//
// Narrower than its Por Tramo sibling on purpose, because the screen is
// narrower: only the tramo selector depends on the catalogues here, so
// the report itself is still worth generating without them and Generar stays
// enabled. There is no file-with-no-columns to prevent.
//
// What there is, and what this pins: a half-done migration. Ten calls became
// two, and a screen that quietly kept asking `GET /api/ciudad/` alongside the
// new endpoint would look and behave exactly right — every seeded role included
// — while leaving the task undone and the extra request in place.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import ReportGeneralSec from "./ReportGeneralSec";
import { elegirTramo } from "./elegirTramo";

const getOpcionesReporte = vi.fn();
const getReporteGeneral = vi.fn();
const getCiudad = vi.fn();
const exportExcelGeneral = vi.fn();
const exportPdfGeneral = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getReporteGeneral: (...a: unknown[]) => getReporteGeneral(...a) }));
// The one this screen used to call, kept so a drift back to it fails here.
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("exceljs", () => ({ default: { Workbook: class { } } }));
vi.mock("jspdf", () => ({ default: class { } }));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// Extended, not replaced: the screen also takes `latestRevision` from this
// module, and a factory that names only the exporters hands it `undefined`.
vi.mock("../../../lib/exports/reportGeneral", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/exports/reportGeneral")>()),
  exportExcelGeneral: (...a: unknown[]) => exportExcelGeneral(...a),
  exportPdfGeneral: (...a: unknown[]) => exportPdfGeneral(...a),
}));
// The real DatePicker is a Radix popover over a calendar, and nothing in this
// repository drives one through jsdom. What the screen needs from it is a
// `Date` through `onSelect`; a date input gives exactly that, labelled by the
// same placeholder, so a test can type a date instead of hunting a day cell.
// Local midnight, as the calendar hands it over.
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
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
  adss: [], material: [], propietario: [], obs: [],
  tramos: [TRAMO_1, TRAMO_14],
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getReporteGeneral.mockResolvedValue([]);
});

const pintar = () => render(<MemoryRouter><ReportGeneralSec /></MemoryRouter>);

describe("which endpoint the screen reads its lists from", () => {
  it("asks the options endpoint and never the city catalogue", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalledTimes(1));
    expect(getCiudad, "la pantalla volvió a pedir /api/ciudad/").not.toHaveBeenCalled();
  });
});

describe("when the catalogues did not arrive", () => {
  it("says what is missing, and that the rest still works", async () => {
    // On screen, not only in a toast: the toast is gone in four seconds and
    // this is a screen people leave open. And the sentence has to be accurate —
    // the report itself is unaffected, so promising less than that would send
    // somebody reloading for nothing.
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });

    pintar();

    expect(await screen.findByText(/no se puede filtrar por tramo/i)).toBeTruthy();
    expect(screen.getByText(/No tiene permiso/i)).toBeTruthy();
  });

  it("keeps the report itself available", async () => {
    getOpcionesReporte.mockRejectedValue(new Error("Network Error"));

    pintar();

    await screen.findByText(/No se pudieron cargar los catálogos/i);
    const generar = screen.getByRole("button", { name: /Generar/i }) as HTMLButtonElement;
    expect(generar.disabled).toBe(false);
  });
});

/**
 * The file's period is the rows' period — B3, the client half.
 *
 * `handleExport` used to read the two date pickers, and the pickers can be
 * moved without pressing Generar. Rare while Generar always answered; routine
 * once it can answer 429 "espere un momento" (B3: thirty heavy queries a
 * minute, shared with the generator), because "it failed, export what I have"
 * is what a person does. Generate January, move the pickers to February, get
 * refused, press Excel: a workbook headed "01/02 — 28/02" over January's
 * incidents, on its way to a client, with nothing inside it saying so.
 *
 * Two fixes, two tests: the export reads the range the rows were generated
 * with, and a failed Generar takes the rows down — as the generator already
 * does on its own Generar.
 */
const AVISO = "Demasiadas consultas seguidas. Espere un momento e intente de nuevo.";

/** What axios rejects with when the server answers 429 `{ message }`. `isAxiosError` has to be true for `mensajeDeError` to read it. */
const rechazo429 = (message: string) => {
  const error = new AxiosError("Request failed with status code 429");
  error.response = {
    data: { message },
    status: 429,
    statusText: "Too Many Requests",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
};

const filaDe = (id: number, description: string, tramo: typeof TRAMO_1) => ({
  id, description, date: "2026-01-10T12:00:00.000Z",
  state: false, priority: false, image: null,
  poste: {
    id: 5, name: "P-5", lat: -19.04, lng: -65.26, id_tramo: tramo.id, tramo,
    propietario: { id: 2, name: "Osefi" },
  },
  eventoObs: [], revisions: [], solucions: [],
});
const FILA = filaDe(1, "Poste inclinado", TRAMO_1);

const fechar = (etiqueta: string, iso: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: iso } });

/** January generated and on screen. */
const generarEnero = async (user: ReturnType<typeof userEvent.setup>) => {
  getReporteGeneral.mockResolvedValue([FILA]);
  pintar();
  await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
  fechar("Inicio", "2026-01-01");
  fechar("Fin", "2026-01-31");
  await user.click(screen.getByRole("button", { name: /Generar/i }));
  expect(await screen.findByText("Poste inclinado")).toBeTruthy();
};

describe("the file's period is the rows' period", () => {
  it("exports with the range the rows were generated for, not the pickers", async () => {
    const user = userEvent.setup();
    await generarEnero(user);

    // Moved, and Generar not pressed again.
    fechar("Inicio", "2026-02-01");
    fechar("Fin", "2026-02-28");
    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Excel/i }));

    await waitFor(() => expect(exportExcelGeneral).toHaveBeenCalledTimes(1));
    const [filas, desde, hasta] = exportExcelGeneral.mock.calls[0] as [unknown[], Date, Date];
    expect(filas).toHaveLength(1);
    // As the file prints them: the header the client reads.
    expect(desde.toLocaleDateString("es-ES")).toBe("1/1/2026");
    expect(hasta.toLocaleDateString("es-ES")).toBe("31/1/2026");

    // And the PDF, which takes the same two positionally — where a swap hides.
    await user.click(screen.getByRole("button", { name: /Exportar/i }));
    await user.click(await screen.findByRole("menuitem", { name: /PDF/i }));
    await waitFor(() => expect(exportPdfGeneral).toHaveBeenCalledTimes(1));
    const [, pdfDesde, pdfHasta] = exportPdfGeneral.mock.calls[0] as [unknown[], Date, Date];
    expect(pdfDesde.toLocaleDateString("es-ES")).toBe("1/1/2026");
    expect(pdfHasta.toLocaleDateString("es-ES")).toBe("31/1/2026");
  });

  it("takes the rows down when Generar fails, and says what the server said", async () => {
    const user = userEvent.setup();
    await generarEnero(user);

    getReporteGeneral.mockRejectedValue(rechazo429(AVISO));
    fechar("Fin", "2026-02-28");
    await user.click(screen.getByRole("button", { name: /Generar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AVISO));
    expect(toast.error).not.toHaveBeenCalledWith("Error al generar el reporte");
    expect(screen.queryByText("Poste inclinado")).toBeNull();
    // No rows, no Resultados card, no Exportar: there is nothing to put in a file.
    expect(screen.queryByRole("button", { name: /Exportar/i })).toBeNull();
  });
});

describe("the tramo is asked of the server", () => {
  const filtroEnviado = () => getReporteGeneral.mock.calls[0][0] as Record<string, unknown>;

  it("asks the server for the chosen tramo by its id", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Ilo – Moquegua/);

    getReporteGeneral.mockResolvedValue([FILA]);
    fechar("Inicio", "2026-01-01");
    fechar("Fin", "2026-01-31");
    await user.click(screen.getByRole("button", { name: /Generar/i }));

    await waitFor(() => expect(getReporteGeneral).toHaveBeenCalledTimes(1));
    expect(filtroEnviado().tramo).toBe(14);
    expect("TramoInicial" in filtroEnviado()).toBe(false);
    expect("TramoFinal" in filtroEnviado()).toBe(false);
  });

  it("leaves the key out when no tramo is chosen, rather than sending it empty", async () => {
    await generarEnero(userEvent.setup());

    expect("tramo" in filtroEnviado()).toBe(false);
    expect("TramoInicial" in filtroEnviado()).toBe(false);
    expect("TramoFinal" in filtroEnviado()).toBe(false);
  });

  it("shows the rows it was given without filtering them again in the browser", async () => {
    // Rows of two different tramos come back while one is chosen: the server
    // has narrowed already. The old filter compared the pole's two cities with
    // the two picked and would have hidden one of them.
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Ilo – Moquegua/);

    getReporteGeneral.mockResolvedValue([
      filaDe(1, "Poste inclinado", TRAMO_1),
      filaDe(2, "Cable roto", TRAMO_14),
    ]);
    fechar("Inicio", "2026-01-01");
    fechar("Fin", "2026-01-31");
    await user.click(screen.getByRole("button", { name: /Generar/i }));

    expect(await screen.findByText("Poste inclinado")).toBeTruthy();
    expect(screen.getByText("Cable roto")).toBeTruthy();
  });

  it("names each row's tramo with the server's name", async () => {
    getReporteGeneral.mockResolvedValue([
      filaDe(1, "Poste inclinado", TRAMO_1),
      filaDe(2, "Cable roto", TRAMO_14),
    ]);
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    fechar("Inicio", "2026-01-01");
    fechar("Fin", "2026-01-31");
    await userEvent.setup().click(screen.getByRole("button", { name: /Generar/i }));

    const fila1 = (await screen.findByText("Poste inclinado")).closest("tr")!;
    const fila2 = screen.getByText("Cable roto").closest("tr")!;
    expect(within(fila1).getByRole("link", { name: "Tacna" }).closest("td")?.textContent).toBe("Tacna – Ilo");
    expect(within(fila2).getByRole("link", { name: "Ilo" }).closest("td")?.textContent).toBe("Ilo – Moquegua");
  });

  it("links each city of each row's tramo to its page", async () => {
    getReporteGeneral.mockResolvedValue([
      filaDe(1, "Poste inclinado", TRAMO_1),
      filaDe(2, "Cable roto", TRAMO_14),
    ]);
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    fechar("Inicio", "2026-01-01");
    fechar("Fin", "2026-01-31");
    await userEvent.setup().click(screen.getByRole("button", { name: /Generar/i }));

    const fila1 = (await screen.findByText("Poste inclinado")).closest("tr")!;
    const fila2 = screen.getByText("Cable roto").closest("tr")!;
    expect(within(fila1).getByRole("link", { name: "Tacna" })).toHaveAttribute("href", "/app/ciudades/11");
    expect(within(fila1).getByRole("link", { name: "Ilo" })).toHaveAttribute("href", "/app/ciudades/12");
    expect(within(fila2).getByRole("link", { name: "Ilo" })).toHaveAttribute("href", "/app/ciudades/12");
    expect(within(fila2).getByRole("link", { name: "Moquegua" })).toHaveAttribute("href", "/app/ciudades/13");
  });
});
