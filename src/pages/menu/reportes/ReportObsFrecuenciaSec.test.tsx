// The Observaciones Frecuentes report and its tramo selector.
//
// The screen had no tramo filter; the server applies one now, so the selector
// is new and what it sends is what this pins. The rows are unchanged — they
// are observations, not tramos — and the screen shows what it is given.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportObsFrecuenciaSec from "./ReportObsFrecuenciaSec";
import { elegirTramo } from "./elegirTramo";

const getOpcionesReporte = vi.fn();
const getObsFrecuencia = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getObsFrecuencia: (...a: unknown[]) => getObsFrecuencia(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
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

const tramo = (id: number, nombre: string) => ({
  id, nombre,
  ciudades: [{ id: id * 10, name: "A", lat: null, lng: null }, { id: id * 10 + 1, name: "B", lat: null, lng: null }],
  id_departamento: null, departamento: null, archivado: false,
});
const OPCIONES = {
  ciudad: [], adss: [], material: [], propietario: [], obs: [],
  tramos: [tramo(1, "Potosí – Sucre"), tramo(14, "Oruro – Potosí")],
};
const FILAS = [
  { tipoObs: "Poste", obs: "Poste inclinado", criticality: 4, count: 7, pct: 70 },
  { tipoObs: "Cable", obs: "Cable suelto", criticality: 6, count: 3, pct: 30 },
];

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue(OPCIONES);
  getObsFrecuencia.mockResolvedValue(FILAS);
});

const pintar = () => render(<ReportObsFrecuenciaSec />);
const filtroEnviado = () => getObsFrecuencia.mock.calls[0][0] as Record<string, unknown>;

/** January typed in and Generar pressed. */
const generar = async (user: ReturnType<typeof userEvent.setup>) => {
  fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-01-01" } });
  fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-31" } });
  await user.click(screen.getByRole("button", { name: /Generar/i }));
};

describe("the tramo is asked of the server", () => {
  it("asks the server for the chosen tramo by its id", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);

    await generar(user);

    await waitFor(() => expect(getObsFrecuencia).toHaveBeenCalledTimes(1));
    expect(filtroEnviado().tramo).toBe(14);
    expect(filtroEnviado().fechaInicial).toBeInstanceOf(Date);
  });

  it("leaves the key out when no tramo is chosen, rather than sending it empty", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    await generar(user);

    await waitFor(() => expect(getObsFrecuencia).toHaveBeenCalledTimes(1));
    expect("tramo" in filtroEnviado()).toBe(false);
    expect("TramoInicial" in filtroEnviado()).toBe(false);
    expect("TramoFinal" in filtroEnviado()).toBe(false);
  });

  it("shows the rows it was given without filtering them again in the browser", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);

    await generar(user);

    expect(await screen.findByText("Poste inclinado")).toBeTruthy();
    expect(screen.getByText("Cable suelto")).toBeTruthy();
  });
});

describe("which tramo the results are for", () => {
  it("names the tramo the report was generated for, even after the selector moves on", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);
    await generar(user);
    await screen.findByText("Poste inclinado");
    expect(screen.getByText("Tramo: Oruro – Potosí")).toBeTruthy();

    await elegirTramo(user, /Potosí – Sucre/);

    // The selector now says Y; the ranking on screen is still X's.
    expect(screen.getByText("Tramo: Oruro – Potosí")).toBeTruthy();
    expect(screen.queryByText("Tramo: Potosí – Sucre")).toBeNull();
  });

  it("says 'Todos los tramos' when none was chosen", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    await generar(user);

    await screen.findByText("Poste inclinado");
    expect(screen.getByText("Tramo: Todos los tramos")).toBeTruthy();
  });
});

describe("when the tramo list did not arrive", () => {
  it("says so on the screen, and the report can still be generated", async () => {
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });
    const user = userEvent.setup();
    pintar();

    expect(await screen.findByText(/no se puede filtrar por tramo/i)).toBeTruthy();
    await generar(user);
    await waitFor(() => expect(getObsFrecuencia).toHaveBeenCalledTimes(1));
    expect("tramo" in filtroEnviado()).toBe(false);
  });
});
