// The Recorrido screen: where its cities come from, and what the download
// button is handed.
//
// Two kinds of test in one file, which is the convention here — one file next
// to the source it covers — and they were two files until C2 gave this screen
// a rendering harness. The second half used to live in `ReportRecorrido.test.ts`
// and justified being source-level by saying that driving it through the
// interface would mean rendering Leaflet, a routing request and four endpoints.
// That harness now exists, three lines below, so the trade is worth revisiting
// the next time somebody touches the export; the assertions themselves are
// unchanged and still earn their place.
//
// **The first half, which C2 adds.** Recorrido is the report that suffers most
// from an empty city list, and the least visibly: `handleGenerar` requires a
// stretch, a stretch requires two cities, so without them the screen is simply
// inert — two comboboxes that offer nothing and a button that refuses. All it
// used to offer as an explanation was a toast that is gone four seconds later.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportRecorrido from "./ReportRecorrido";
import { SesionContext } from "../../../context/SesionContext";
import { ThemeProvider } from "../../../components/theme-provider";
import { usuarioExample } from "../../../data/example";

const getOpcionesReporte = vi.fn();
const getReporteRecorrido = vi.fn();
const getPosteByTramo = vi.fn();
const getCiudad = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getReporteRecorrido: (...a: unknown[]) => getReporteRecorrido(...a) }));
vi.mock("../../../api/Poste.api", () => ({ getPosteByTramo: (...a: unknown[]) => getPosteByTramo(...a) }));
// The one this screen used to call.
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: () => Promise.resolve(null) }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// @vis.gl/react-maplibre is mocked whole: no test in this repository renders a
// real map, and the real one wants a sized DOM element and a WebGL context
// that jsdom does not give it.
vi.mock("@vis.gl/react-maplibre", () => ({
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  useMap: () => ({ current: null }),
}));

const OPCIONES = {
  ciudad: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
  adss: [], material: [], propietario: [], obs: [],
  tramos: [{ id_ciudadA: 11, id_ciudadB: 12 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getReporteRecorrido.mockResolvedValue([]);
  getPosteByTramo.mockResolvedValue([]);
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <SesionContext.Provider
          value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
        >
          <ReportRecorrido />
        </SesionContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("where the cities come from", () => {
  it("asks the options endpoint and never the city catalogue", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalledTimes(1));
    expect(getCiudad, "la pantalla volvió a pedir /api/ciudad/").not.toHaveBeenCalled();
  });

  it("offers a city once the stretch pairs say it has a neighbour", async () => {
    // Both comboboxes filter `listCiudad` through the stretch map, so this is
    // the observable proof that the `ciudad` and `tramos` blocks arrived and
    // agree with each other. With either missing, the screen offers nothing.
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    // The options only exist in the DOM once the combobox is open.
    const [desde] = await screen.findAllByText("Seleccionar ciudad");
    await userEvent.click(desde);

    expect(await screen.findByText("Tacna")).toBeTruthy();
  });
});

describe("when the catalogues did not arrive", () => {
  it("says the screen has no stretch to offer, instead of sitting there empty", async () => {
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });

    pintar();

    expect(await screen.findByText(/no puede ofrecerle ningún tramo/i)).toBeTruthy();
    expect(screen.getByText(/No tiene permiso/i)).toBeTruthy();
  });

  it("tells a refusal apart from a request that failed", async () => {
    getOpcionesReporte.mockRejectedValue(new Error("Network Error"));

    pintar();

    expect(await screen.findByText(/No se pudieron cargar los catálogos/i)).toBeTruthy();
    expect(screen.queryByText(/No tiene permiso/i)).toBeNull();
  });
});

// ─── What the download button is handed ──────────────────────────────────────
//
// A download button gives you what the screen is showing.
//
// The Recorrido screen has a severity filter and a status filter, and the CSV
// button sits in the same header row as both. It was handed `list` — everything
// the query returned — instead of `filteredList`, the rows actually drawn
// underneath. Narrow to three critical events, press CSV, get four hundred
// rows, and nothing anywhere says the file is not what you were looking at.
// Somebody sends that file to a client.
//
// The check is narrow on purpose: it does not try to understand the filtering,
// only that no export on this screen is fed the raw list. `criticality.test.ts`
// covers the bands the filter uses, which is the other half — that
// `filteredList` holds the right rows in the first place.

const SOURCE = readFileSync(join(__dirname, "ReportRecorrido.tsx"), "utf8");

describe("el CSV del recorrido exporta lo que hay en pantalla", () => {
  it("recibe la lista filtrada, no la completa", () => {
    const calls = SOURCE.match(/exportCsv\([^)]*\)/g) ?? [];

    // One call site. If a second appears, it has to be looked at, not assumed.
    expect(calls.filter((c) => !c.startsWith("exportCsv(rowsOnScreen"))).toHaveLength(1);

    for (const call of calls) {
      if (call.startsWith("exportCsv(rowsOnScreen")) continue; // the definition
      expect(call, "el botón de CSV debe recibir filteredList").toContain("filteredList");
      expect(call).not.toMatch(/exportCsv\(\s*list\b/);
    }
  });

  it("el botón dice cuántas filas se va a llevar", () => {
    // Without this the person cannot tell a filtered download from a full one
    // until they open the file.
    expect(SOURCE).toMatch(/title=\{`Descargar \$\{filteredList\.length\}/);
  });

  it("no se puede pedir un fichero vacío", () => {
    expect(SOURCE).toMatch(/disabled=\{filteredList\.length === 0\}/);
  });
});
