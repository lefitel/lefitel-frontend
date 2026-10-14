// The two numbers this panel decides, and why they moved.
//
// The colour bands used to be green ≤1 day, amber ≤7, red above. Those were
// calibrated against a figure that measured the wrong thing: days until the
// last site visit, not days until the repair. Now that the panel measures the
// repair, the real median is 31 days — every tramo would have gone red and the
// colour would have stopped carrying information. Isaias set the bands at
// green ≤15, amber ≤45.
//
// The discard notice exists because the historical data contains eventos whose
// repair is dated before the fault. They used to be clamped to "0 days", which
// is how a third of the closed eventos were published as instantaneous. They
// are dropped now, and a panel that silently drops rows is a panel that lies by
// omission — so it has to say how many, and in words that a reader who has
// never seen the database can act on.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportTiemposSec from "./ReportTiemposSec";
import { diasColor, textoDescartados } from "./tiempos";
import { elegirTramo } from "./elegirTramo";

const getOpcionesReporte = vi.fn();
const getTiemposResumen = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getTiemposResumen: (...a: unknown[]) => getTiemposResumen(...a) }));
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

describe("diasColor", () => {
  it("es verde hasta quince días inclusive", () => {
    expect(diasColor(0)).toContain("green");
    expect(diasColor(15)).toContain("green");
  });

  it("pasa a ámbar en el día dieciséis", () => {
    expect(diasColor(16)).toContain("amber");
    expect(diasColor(45)).toContain("amber");
  });

  it("pasa a rojo por encima de cuarenta y cinco", () => {
    expect(diasColor(46)).toContain("red");
    expect(diasColor(400)).toContain("red");
  });

  it("la mediana real de la red no pinta el panel entero de rojo", () => {
    // 31 days is the measured median. Under the old bands this was red, which
    // is the whole reason the thresholds moved.
    expect(diasColor(31)).toContain("amber");
  });
});

describe("textoDescartados", () => {
  it("no dice nada cuando no se descartó ningún evento", () => {
    expect(textoDescartados(0)).toBeNull();
  });

  it("avisa en singular de un evento descartado", () => {
    const texto = textoDescartados(1);
    expect(texto).toContain("1 evento");
    expect(texto).not.toContain("1 eventos");
  });

  it("avisa en plural y explica el motivo sin jerga", () => {
    const texto = textoDescartados(37);
    expect(texto).toContain("37 eventos");
    // The reader has to learn WHY they are out, not just that they are.
    expect(texto).toMatch(/antes/i);
  });
});

// ─── The tramo selector ──────────────────────────────────────────────────────
//
// The screen had no tramo filter; the server applies one now. What it sends,
// and how each row of the answer is named, is what the tests below pin.

describe("the tramo selector", () => {
  const tramo = (id: number, nombre: string) => ({
    id, nombre,
    ciudades: [
      { id: id * 10, name: nombre.split(" – ")[0], lat: null, lng: null },
      { id: id * 10 + 1, name: nombre.split(" – ")[1], lat: null, lng: null },
    ],
    id_departamento: null, departamento: null, archivado: false,
  });
  const T1 = tramo(1, "Potosí – Sucre");
  const T14 = tramo(14, "Oruro – Potosí");
  const fila = (t: typeof T1) => ({ tramo: t, count: 3, avgVisitas: 2, avgDias: 20, minDias: 5, maxDias: 40 });
  const filtroEnviado = () => getTiemposResumen.mock.calls[0][0] as Record<string, unknown>;
  const pintar = () => render(<MemoryRouter><ReportTiemposSec /></MemoryRouter>);

  beforeEach(() => {
    vi.clearAllMocks();
    getOpcionesReporte.mockResolvedValue({
      ciudad: [], adss: [], material: [], propietario: [], obs: [], tramos: [T1, T14],
    });
    getTiemposResumen.mockResolvedValue({ tramos: [fila(T1), fila(T14)], descartados: 0 });
  });

  const generar = async (user: ReturnType<typeof userEvent.setup>) => {
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-31" } });
    await user.click(screen.getByRole("button", { name: /Generar/i }));
  };

  it("asks the server for the chosen tramo by its id", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);

    await generar(user);

    await waitFor(() => expect(getTiemposResumen).toHaveBeenCalledTimes(1));
    expect(filtroEnviado().tramo).toBe(14);
  });

  it("leaves the key out when no tramo is chosen, rather than sending it empty", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    await generar(user);

    await waitFor(() => expect(getTiemposResumen).toHaveBeenCalledTimes(1));
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

    expect(await screen.findAllByRole("row")).toHaveLength(3); // header + both tramos
  });

  it("names each row's tramo with the server's name", async () => {
    const user = userEvent.setup();
    pintar();
    await generar(user);

    const celdas = (await screen.findAllByRole("row")).slice(1)
      .map((f) => within(f).getAllByRole("cell")[0].textContent);
    expect(celdas).toEqual(["Potosí – Sucre", "Oruro – Potosí"]);
  });

  it("links each city of each row's tramo to its page", async () => {
    const user = userEvent.setup();
    pintar();
    await generar(user);

    const [fila1, fila2] = (await screen.findAllByRole("row")).slice(1);
    expect(within(fila1).getByRole("link", { name: "Potosí" })).toHaveAttribute("href", "/app/ciudades/10");
    expect(within(fila1).getByRole("link", { name: "Sucre" })).toHaveAttribute("href", "/app/ciudades/11");
    expect(within(fila2).getByRole("link", { name: "Oruro" })).toHaveAttribute("href", "/app/ciudades/140");
    expect(within(fila2).getByRole("link", { name: "Potosí" })).toHaveAttribute("href", "/app/ciudades/141");
  });

  it("says so on the screen when the tramo list did not arrive, and still generates", async () => {
    getOpcionesReporte.mockRejectedValue(new Error("Network Error"));
    const user = userEvent.setup();
    pintar();

    expect(await screen.findByText(/no se puede filtrar por tramo/i)).toBeTruthy();
    await generar(user);
    await waitFor(() => expect(getTiemposResumen).toHaveBeenCalledTimes(1));
  });
});
