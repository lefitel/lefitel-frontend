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
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportGeneralSec from "./ReportGeneralSec";

const getOpcionesReporte = vi.fn();
const getReporteGeneral = vi.fn();
const getCiudad = vi.fn();

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
