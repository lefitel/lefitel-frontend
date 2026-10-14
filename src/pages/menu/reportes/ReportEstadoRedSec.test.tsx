// The Estado de la Red report, and what it says when the server refuses.
//
// Since B3 the six fixed reports answer 429 after thirty heavy queries a
// minute — a budget shared with the report generator, so it can be spent on a
// screen the person never opened. The refusal carries a sentence written for
// them ("Espere un momento…"), and every one of the six screens used to throw
// it away for "Error al generar el reporte", which is the sentence that sends
// somebody straight back to the button.
//
// This is the one screen of the six whose Generar needs no date, so it is the
// one that can be driven through the interface without a calendar. The other
// five are held to the same catch by `fallos.test.ts`, at source level, and
// `ReportGeneralSec.test.tsx` drives the export half of the same defect.
//
// The error has to be an `AxiosError`. `mensajeDeError` asks
// `axios.isAxiosError`, which checks `isAxiosError === true` on the object —
// a plain `{ response: { data } }` fails that check and shows the fallback,
// and a test asserting the fallback would stay green with the reader deleted.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import ReportEstadoRedSec from "./ReportEstadoRedSec";
import { elegirTramo } from "./elegirTramo";

const getEstadoRed = vi.fn();
const getOpcionesReporte = vi.fn();
vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesReporte: () => getOpcionesReporte(),
}));
vi.mock("../../../api/reporte.api", () => ({ getEstadoRed: (...a: unknown[]) => getEstadoRed(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

// The real DatePicker is a Radix popover over a calendar, which nothing in this
// repository drives through jsdom. A date input hands the screen the same
// `Date` through `onSelect`, labelled by the same placeholder. Local midnight,
// as the calendar hands it over.
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

const AVISO = "Demasiadas consultas seguidas. Espere un momento e intente de nuevo.";

/** What axios rejects with when the server answers 429 `{ message }`. */
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

const filaDe = (t: typeof T1) => ({
  tramo: t, totalPostes: 4, conPendientes: 1, totalPendientes: 2, totalEventos: 3, pctSalud: 75,
});
const TRAMO = filaDe(T1);

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesReporte.mockResolvedValue({ ciudad: [], adss: [], material: [], propietario: [], obs: [], tramos: [T1, T14] });
  getEstadoRed.mockResolvedValue([TRAMO]);
});

const pintar = () => render(<MemoryRouter><ReportEstadoRedSec /></MemoryRouter>);
/** The button reads "Generar" before the first run and "Actualizar" after. */
const generar = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /Generar|Actualizar/i }));

describe("when the server refuses", () => {
  it("shows the server's sentence for a 429, not the screen's own", async () => {
    getEstadoRed.mockRejectedValue(rechazo429(AVISO));
    const user = userEvent.setup();
    pintar();

    await generar(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AVISO));
    expect(toast.error).not.toHaveBeenCalledWith("Error al cargar el estado de la red");
  });

  it("keeps its own sentence for a failure that carries none", async () => {
    // The other direction, so "always print `data.message`" fails too: a
    // network error has no server sentence, and `undefined` on a toast is
    // worse than the generic one.
    getEstadoRed.mockRejectedValue(new Error("Network Error"));
    const user = userEvent.setup();
    pintar();

    await generar(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar el estado de la red"));
  });

  it("takes the previous table down with the failure", async () => {
    // A toast is gone in four seconds; "1 tramos" over rows from the previous
    // run is not, and nothing on the card would say they are stale.
    const user = userEvent.setup();
    pintar();
    await generar(user);
    expect(await screen.findByText("Resultados")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Potosí" })).toBeTruthy();

    getEstadoRed.mockRejectedValue(rechazo429(AVISO));
    await generar(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AVISO));
    expect(screen.queryByText("Resultados")).toBeNull();
    expect(screen.queryByRole("link", { name: "Potosí" })).toBeNull();
  });
});

describe("the tramo is asked of the server", () => {
  const filtroEnviado = () => getEstadoRed.mock.calls[0][0] as Record<string, unknown>;

  it("asks the server for the chosen tramo by its id", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);

    await generar(user);

    await waitFor(() => expect(getEstadoRed).toHaveBeenCalledTimes(1));
    expect(filtroEnviado().tramo).toBe(14);
  });

  it("leaves the key out when no tramo is chosen, rather than sending it empty", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());

    await generar(user);

    await waitFor(() => expect(getEstadoRed).toHaveBeenCalledTimes(1));
    expect("tramo" in filtroEnviado()).toBe(false);
    expect("TramoInicial" in filtroEnviado()).toBe(false);
    expect("TramoFinal" in filtroEnviado()).toBe(false);
  });

  it("sends the dates too, beside the tramo", async () => {
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-01-31" } });

    await generar(user);

    await waitFor(() => expect(getEstadoRed).toHaveBeenCalledTimes(1));
    expect(filtroEnviado().tramo).toBe(14);
    expect(filtroEnviado().fechaInicial).toBeInstanceOf(Date);
    expect(filtroEnviado().fechaFinal).toBeInstanceOf(Date);
  });

  it("shows the rows it was given without filtering them again in the browser", async () => {
    getEstadoRed.mockResolvedValue([filaDe(T1), filaDe(T14)]);
    const user = userEvent.setup();
    pintar();
    await waitFor(() => expect(getOpcionesReporte).toHaveBeenCalled());
    await elegirTramo(user, /Oruro – Potosí/);

    await generar(user);

    expect(await screen.findByRole("link", { name: "Sucre" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Oruro" })).toBeTruthy();
  });

  it("names each row's tramo with the server's name", async () => {
    getEstadoRed.mockResolvedValue([filaDe(T1), filaDe(T14)]);
    const user = userEvent.setup();
    pintar();
    await generar(user);

    const celdas = (await screen.findAllByRole("row")).slice(1).map((fila) => within(fila).getAllByRole("cell")[0].textContent);
    expect(celdas).toEqual(["Potosí – Sucre", "Oruro – Potosí"]);
  });

  it("links each city of each row's tramo to its page", async () => {
    getEstadoRed.mockResolvedValue([filaDe(T1), filaDe(T14)]);
    const user = userEvent.setup();
    pintar();
    await generar(user);

    const [fila1, fila2] = (await screen.findAllByRole("row")).slice(1);
    expect(within(fila1).getByRole("link", { name: "Potosí" })).toHaveAttribute("href", "/app/ciudades/10");
    expect(within(fila1).getByRole("link", { name: "Sucre" })).toHaveAttribute("href", "/app/ciudades/11");
    expect(within(fila2).getByRole("link", { name: "Oruro" })).toHaveAttribute("href", "/app/ciudades/140");
    expect(within(fila2).getByRole("link", { name: "Potosí" })).toHaveAttribute("href", "/app/ciudades/141");
  });
});

describe("when the tramo list did not arrive", () => {
  it("says so on the screen, and the report can still be generated", async () => {
    getOpcionesReporte.mockRejectedValue({ response: { status: 403 } });
    const user = userEvent.setup();
    pintar();

    expect(await screen.findByText(/no se puede filtrar por tramo/i)).toBeTruthy();
    await generar(user);
    await waitFor(() => expect(getEstadoRed).toHaveBeenCalledTimes(1));
  });
});
