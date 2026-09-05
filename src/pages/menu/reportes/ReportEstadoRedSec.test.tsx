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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import ReportEstadoRedSec from "./ReportEstadoRedSec";

const getEstadoRed = vi.fn();
vi.mock("../../../api/reporte.api", () => ({ getEstadoRed: (...a: unknown[]) => getEstadoRed(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

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

const TRAMO = {
  ciudadAId: 1, ciudadBId: 2, ciudadAName: "Sucre", ciudadBName: "Potosí",
  totalPostes: 4, conPendientes: 1, totalPendientes: 2, totalEventos: 3, pctSalud: 75,
};

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(screen.getByText("Sucre")).toBeTruthy();

    getEstadoRed.mockRejectedValue(rechazo429(AVISO));
    await generar(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AVISO));
    expect(screen.queryByText("Resultados")).toBeNull();
    expect(screen.queryByText("Sucre")).toBeNull();
  });
});
