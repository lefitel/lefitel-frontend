// The General report's city list, and what it says when it cannot have one.
//
// Narrower than its Por Tramo sibling on purpose, because the screen is
// narrower: only the two stretch comboboxes depend on the catalogues here, so
// the report itself is still worth generating without them and Generar stays
// enabled. There is no file-with-no-columns to prevent.
//
// What there is, and what this pins: a half-done migration. Ten calls became
// two, and a screen that quietly kept asking `GET /api/ciudad/` alongside the
// new endpoint would look and behave exactly right — every seeded role included
// — while leaving the task undone and the extra request in place.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import ReportGeneralSec from "./ReportGeneralSec";

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

const OPCIONES = {
  ciudad: [{ id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 }],
  adss: [], material: [], propietario: [], obs: [],
  tramos: [{ id_ciudadA: 11, id_ciudadB: 12 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getReporteGeneral.mockResolvedValue([]);
});

const pintar = () => render(<MemoryRouter><ReportGeneralSec /></MemoryRouter>);

describe("where the city list comes from", () => {
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

const FILA = {
  id: 1, description: "Poste inclinado", date: "2026-01-10T12:00:00.000Z",
  state: false, priority: false, image: null,
  poste: {
    id: 5, name: "P-5", lat: -19.04, lng: -65.26, id_ciudadA: 11, id_ciudadB: 12,
    ciudadA: { id: 11, name: "Tacna" }, ciudadB: { id: 12, name: "Ilo" },
    propietario: { id: 2, name: "Osefi" },
  },
  eventoObs: [], revisions: [], solucions: [],
};

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
