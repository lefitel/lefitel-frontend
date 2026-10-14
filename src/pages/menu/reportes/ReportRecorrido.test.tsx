// The Recorrido screen: its one required tramo, and what the download button
// is handed.
//
// Two kinds of test in one file, which is the convention here — one file next
// to the source it covers. The first half drives the screen through the
// interface; the second reads its source for what the interface cannot reach
// (the CSV button's arguments), and says so.
//
// Recorrido is the report that suffers most from an empty tramo list, and the
// least visibly: `handleGenerar` requires a tramo, so without the list the
// screen is simply inert — a selector that offers nothing and a button that
// refuses. All it used to offer as an explanation was a toast that is gone four
// seconds later.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import ReportRecorrido from "./ReportRecorrido";
import { elegirTramo } from "./elegirTramo";
import { SesionContext } from "../../../context/SesionContext";
import { ThemeProvider } from "../../../components/theme-provider";
import { usuarioExample } from "../../../data/example";
import { MAP_DOT } from "../../../components/map/mapConstants";

const getOpcionesReporte = vi.fn();
const getReporteRecorrido = vi.fn();
const getPostesDelTramo = vi.fn();
const fetchOrsRoute = vi.fn();
const getCiudad = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getReporteRecorrido: (...a: unknown[]) => getReporteRecorrido(...a) }));
vi.mock("../../../api/Poste.api", () => ({ getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a) }));
// The one this screen used to call.
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: (...a: unknown[]) => fetchOrsRoute(...a) }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// The two sheets a map popup opens are stand-ins with one button that reports
// success, which is the only thing this screen does with them.
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => <button onClick={onSuccess}>sheet-resolver-ok</button>,
}));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => <button onClick={onSuccess}>sheet-revision-ok</button>,
}));
// The real DatePicker is a Radix popover over a calendar, which nothing in this
// repository drives through jsdom. A date input hands the screen the same
// `Date` through `onSelect`, labelled by the same placeholder.
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

// What the screen hands the map is what these tests read: one element per point
// (carrying its fill, which is how a city end is told from an event or a pole)
// and one per line. A point renders its popup content: the city-end label is under test.
vi.mock("../../../components/map/MapPoint", () => ({
  default: ({ fillColor, children }: { fillColor?: string; children?: React.ReactNode }) => (
    <div data-testid="map-point" data-fill={fillColor}>{children}</div>
  ),
}));
vi.mock("../../../components/map/MapLine", () => ({
  default: ({ positions }: { positions: unknown[] }) => <div data-testid="map-line" data-points={positions.length} />,
}));

/** The city-end markers on the map: the only points painted with the endpoint colour. */
const marcadoresDeCiudad = () =>
  screen.queryAllByTestId("map-point").filter((el) => el.getAttribute("data-fill") === MAP_DOT.endpoint);

const TACNA = { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 };
const ILO = { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 };
const MOQUEGUA = { id: 13, name: "Moquegua", lat: -17.1956, lng: -70.9356 };

const tramo = (id: number, ciudades: [typeof TACNA, typeof TACNA]) => ({
  id,
  nombre: `${ciudades[0].name} – ${ciudades[1].name}`,
  ciudades,
  id_departamento: null,
  departamento: null,
  archivado: false,
});
const TACNA_ILO = tramo(1, [TACNA, ILO]);
/** Ilo comes first in the name, so the line must start there. */
const ILO_MOQUEGUA = tramo(14, [ILO, MOQUEGUA]);

const OPCIONES = {
  ciudad: [TACNA, ILO, MOQUEGUA],
  adss: [], material: [], propietario: [], obs: [],
  tramos: [TACNA_ILO, ILO_MOQUEGUA],
};

/** Poles standing between the cities of the stretch. */
const POSTES = [
  { id: 1, name: "P-1", lat: -17.95, lng: -70.7 },
  { id: 2, name: "P-2", lat: -17.85, lng: -70.95 },
];

const FILA = {
  id: 1, description: "Poste inclinado", date: "2026-01-10T12:00:00.000Z",
  state: false, priority: false, image: null,
  poste: { id: 1, name: "P-1", lat: -17.95, lng: -70.7, id_tramo: 1, tramo: TACNA_ILO },
  eventoObs: [], revisions: [], solucions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getReporteRecorrido.mockResolvedValue([]);
  getPostesDelTramo.mockResolvedValue(POSTES);
  fetchOrsRoute.mockResolvedValue(null);
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

const fechar = (etiqueta: string, iso: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: iso } });

/** The screen drawn, the tramo chosen, January typed in, Generar pressed and answered. */
const generar = async (user: ReturnType<typeof userEvent.setup>, tramoElegido: string | RegExp) => {
  pintar();
  await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
  await elegirTramo(user, tramoElegido);
  fechar("Inicio", "2026-01-01");
  fechar("Fin", "2026-01-31");
  await user.click(screen.getByRole("button", { name: /Generar/i }));
  await waitFor(() => expect(getReporteRecorrido).toHaveBeenCalled());
};

describe("where the tramos come from", () => {
  it("asks the options endpoint and never the city catalogue", async () => {
    pintar();

    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalledTimes(1));
    expect(getCiudad, "la pantalla volvió a pedir /api/ciudad/").not.toHaveBeenCalled();
  });

  it("offers the tramos the server sent, by name, and no 'all' entry: this report needs exactly one", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    // The list is filled by the time the trigger can be pressed to any effect.
    await waitFor(() => expect(screen.getByRole("button", { name: "Tramo" })).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "Tramo" }));

    expect(await screen.findByRole("button", { name: /Tacna – Ilo/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ilo – Moquegua/ })).toBeTruthy();
    expect(screen.queryByText("Todos los tramos")).toBeNull();
  });
});

describe("the tramo is one field", () => {
  it("has no 'Tramo desde' and no 'Tramo hasta'", async () => {
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    expect(screen.queryByText(/Tramo desde/)).toBeNull();
    expect(screen.queryByText(/Tramo hasta/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tramo" })).toBeTruthy();
  });

  it("cannot be generated without a tramo", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    fechar("Inicio", "2026-01-01");
    fechar("Fin", "2026-01-31");

    await user.click(screen.getByRole("button", { name: /Generar/i }));

    expect(toast.warning).toHaveBeenCalledWith("Selecciona un tramo");
    expect(getReporteRecorrido).not.toHaveBeenCalled();
  });

  it("asks the server for the chosen tramo by its id, and its poles by the same id", async () => {
    const user = userEvent.setup();
    await generar(user, /Ilo – Moquegua/);

    const [filtro] = getReporteRecorrido.mock.calls[0] as [Record<string, unknown>];
    expect(filtro.tramo).toBe(14);
    expect("TramoInicial" in filtro).toBe(false);
    expect("TramoFinal" in filtro).toBe(false);
    expect(getPostesDelTramo).toHaveBeenCalledWith(14);
  });
});

describe("the line starts at the first end of the tramo's name", () => {
  it.each([
    ["Tacna – Ilo", /Tacna – Ilo/, TACNA, ILO],
    ["Ilo – Moquegua", /Ilo – Moquegua/, ILO, MOQUEGUA],
  ])("for %s", async (_nombre, seleccion, primera, segunda) => {
    const user = userEvent.setup();
    await generar(user, seleccion);

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    const [waypoints] = fetchOrsRoute.mock.calls[0] as [number[][]];
    // `[lng, lat]`, the order the routing service takes, and the first city of
    // the name.
    expect(waypoints[0]).toEqual([primera.lng, primera.lat]);
    expect(waypoints.at(-1)).toEqual([segunda.lng, segunda.lat]);
  });

  it("is still drawn, from the poles, when the second end of the tramo has no position", async () => {
    getOpcionesReporte.mockResolvedValue({
      ...OPCIONES,
      tramos: [{ ...TACNA_ILO, ciudades: [TACNA, { ...ILO, lat: null, lng: null }] }],
    });
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    const [waypoints] = fetchOrsRoute.mock.calls[0] as [number[][]];
    expect(waypoints[0]).toEqual([TACNA.lng, TACNA.lat]);
    expect(waypoints).toHaveLength(POSTES.length + 1);
  });
});

describe("re-running after a map popup changes an incident", () => {
  it.each(["sheet-resolver-ok", "sheet-revision-ok"])(
    "asks again for the tramo and dates the rows were generated with, not the ones the controls show now (%s)",
    async (boton) => {
      getReporteRecorrido.mockResolvedValue([FILA]);
      const user = userEvent.setup();
      await generar(user, /Tacna – Ilo/);
      await screen.findByText("Mapa del Recorrido");
      expect(getReporteRecorrido).toHaveBeenCalledTimes(1);
      const primera = getReporteRecorrido.mock.calls[0][0] as { tramo: number; fechaInicial: Date; fechaFinal: Date };
      expect(primera.tramo).toBe(1);

      // The controls move on without Generar being pressed.
      await elegirTramo(user, /Ilo – Moquegua/);
      fechar("Inicio", "2026-03-01");
      fechar("Fin", "2026-03-31");

      await user.click(screen.getByRole("button", { name: boton }));

      await waitFor(() => expect(getReporteRecorrido).toHaveBeenCalledTimes(2));
      const segunda = getReporteRecorrido.mock.calls[1][0] as typeof primera;
      expect(segunda.tramo).toBe(1);
      expect(segunda.fechaInicial).toEqual(primera.fechaInicial);
      expect(segunda.fechaFinal).toEqual(primera.fechaFinal);
      expect(getPostesDelTramo).toHaveBeenLastCalledWith(1);
    },
  );
});

describe("a tramo whose two ends have no position", () => {
  const SIN_POSICION = {
    ...TACNA_ILO,
    ciudades: [{ ...TACNA, lat: null, lng: null }, { ...ILO, lat: null, lng: null }],
  };
  const sinPosicion = () =>
    getOpcionesReporte.mockResolvedValue({ ...OPCIONES, tramos: [SIN_POSICION] });

  it("control: a tramo whose ends do have a position does show both city markers", async () => {
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    // Without this, the "no city markers" below would pass on a map that never draws them.
    await screen.findByText("Mapa del Recorrido");
    expect(marcadoresDeCiudad()).toHaveLength(2);
  });

  it("labels both city markers 'Extremo del tramo': a tramo has no start and no end", async () => {
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    await screen.findByText("Mapa del Recorrido");
    const marcadores = marcadoresDeCiudad();
    expect(marcadores).toHaveLength(2);
    for (const marcador of marcadores) {
      expect(marcador).toHaveTextContent("Extremo del tramo");
      expect(marcador.textContent).not.toMatch(/Inicio|Fin del/);
    }
  });

  it("draws the line through the poles alone, with no city markers, and does not crash", async () => {
    sinPosicion();
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    await waitFor(() => expect(fetchOrsRoute).toHaveBeenCalledTimes(1));
    const [waypoints] = fetchOrsRoute.mock.calls[0] as [number[][]];
    // Only the poles, `[lng, lat]`: no city end was added on either side.
    expect(waypoints).toHaveLength(POSTES.length);
    expect(waypoints).toEqual(expect.arrayContaining(POSTES.map((p) => [p.lng, p.lat])));
    expect(await screen.findByText("Mapa del Recorrido")).toBeTruthy();
    expect(marcadoresDeCiudad()).toHaveLength(0);
    // The line is there, through the poles.
    await waitFor(() => expect(screen.getByTestId("map-line").getAttribute("data-points")).toBe(String(POSTES.length)));
  });

  it("draws nothing when it also has no poles, and still shows the rows it was given", async () => {
    sinPosicion();
    getPostesDelTramo.mockResolvedValue([]);
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    expect(await screen.findByText("Mapa del Recorrido")).toBeTruthy();
    expect(fetchOrsRoute).not.toHaveBeenCalled();
    expect(marcadoresDeCiudad()).toHaveLength(0);
    expect(screen.queryByTestId("map-line")).toBeNull();
    expect(screen.getByText("Tramo:", { exact: false })).toBeTruthy();
  });

  it("with no poles and no events says so instead of drawing an empty map", async () => {
    sinPosicion();
    getPostesDelTramo.mockResolvedValue([]);
    getReporteRecorrido.mockResolvedValue([]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("No hay eventos para el tramo y período seleccionado"));
    expect(screen.queryByText("Mapa del Recorrido")).toBeNull();
    expect(fetchOrsRoute).not.toHaveBeenCalled();
  });
});

describe("the title and the downloaded file are named by the tramo", () => {
  /** Presses CSV and returns the file name the anchor was given. */
  const descargar = async (user: ReturnType<typeof userEvent.setup>) => {
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
    const nombres: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nombres.push(this.download);
    });
    await user.click(await screen.findByRole("button", { name: "CSV" }));
    click.mockRestore();
    return nombres;
  };

  it("titles the results with the server's name for the tramo", async () => {
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);

    expect(await screen.findByText("Tacna – Ilo", { selector: "span.font-semibold" })).toBeTruthy();
  });

  it("names the file after the tramo that was asked, not the one the selector shows now", async () => {
    getReporteRecorrido.mockResolvedValue([FILA]);
    const user = userEvent.setup();
    await generar(user, /Tacna – Ilo/);
    await screen.findByText("Tacna – Ilo", { selector: "span.font-semibold" });
    // Moved, and Generar not pressed again.
    await elegirTramo(user, /Ilo – Moquegua/);

    const [archivo] = await descargar(user);

    expect(archivo).toMatch(/^recorrido_Tacna – Ilo_\d{8}_\d{6}\.csv$/);
  });

  it("keeps characters a file system refuses out of the name", async () => {
    const raro = { ...TACNA_ILO, nombre: 'Tacna / Ilo: "norte"' };
    getOpcionesReporte.mockResolvedValue({ ...OPCIONES, tramos: [raro] });
    getReporteRecorrido.mockResolvedValue([{ ...FILA, poste: { ...FILA.poste, tramo: raro } }]);
    const user = userEvent.setup();
    await generar(user, /Tacna/);

    const [archivo] = await descargar(user);

    expect(archivo).not.toMatch(/[\\/:*?"<>|]/);
    expect(archivo).toMatch(/^recorrido_Tacna/);
  });
});

describe("when the catalogues did not arrive", () => {
  it("says the screen has no tramo to offer, instead of sitting there empty", async () => {
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
