import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BajaInformePage from "./BajaInformePage";
import { ThemeProvider } from "../components/theme-provider";

const consultarBaja = vi.fn();
const confirmarBaja = vi.fn();
vi.mock("../api/Programacion.api", () => ({
  consultarBaja: (...a: unknown[]) => consultarBaja(...a),
  confirmarBaja: (...a: unknown[]) => confirmarBaja(...a),
}));

const TOKEN = "A".repeat(43);

const abrir = (hash: string) => {
  window.history.replaceState(null, "", `/baja-informe${hash}`);
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <BajaInformePage />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const fallo = (status: number) => Object.assign(new Error("x"), { response: { status, data: { message: "del servidor" } } });

beforeEach(() => {
  vi.clearAllMocks();
  consultarBaja.mockResolvedValue({ informe: "Eventos de la semana", programadoPor: "Ana Pérez", deBaja: false });
  confirmarBaja.mockResolvedValue(undefined);
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("opening the link", () => {
  it("unsubscribes nobody: it asks what the link is for and waits for the button", async () => {
    // A mail scanner opens every link in a message. If opening were enough,
    // those recipients would be unsubscribed the moment the email arrived.
    abrir(`#t=${TOKEN}`);

    expect(await screen.findByText(/Eventos de la semana/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument();
    expect(consultarBaja).toHaveBeenCalledWith(TOKEN);
    expect(confirmarBaja).not.toHaveBeenCalled();
  });

  it("takes the token out of the address bar as soon as it has read it", async () => {
    abrir(`#t=${TOKEN}`);
    await screen.findByText(/Eventos de la semana/);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/baja-informe");
  });

  it("asks only once, even if the page renders again", async () => {
    const { rerender } = abrir(`#t=${TOKEN}`);
    await screen.findByText(/Eventos de la semana/);
    rerender(
      <ThemeProvider>
        <MemoryRouter>
          <BajaInformePage />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(consultarBaja).toHaveBeenCalledTimes(1);
  });
});

describe("pressing the button", () => {
  it("unsubscribes with the same token and says it is done", async () => {
    const user = userEvent.setup();
    abrir(`#t=${TOKEN}`);
    await user.click(await screen.findByRole("button", { name: "Dejar de recibirlo" }));

    expect(confirmarBaja).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByRole("heading", { name: "Ya no lo recibirás" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dejar de recibirlo" })).not.toBeInTheDocument();
  });

  it("cannot be pressed twice while the first is on its way", async () => {
    let soltar: () => void = () => undefined;
    confirmarBaja.mockReturnValue(new Promise<void>((r) => (soltar = r)));
    const user = userEvent.setup();
    abrir(`#t=${TOKEN}`);
    const boton = await screen.findByRole("button", { name: "Dejar de recibirlo" });
    await user.click(boton);
    expect(boton).toBeDisabled();
    await user.click(boton);
    expect(confirmarBaja).toHaveBeenCalledTimes(1);
    soltar();
    expect(await screen.findByRole("heading", { name: "Ya no lo recibirás" })).toBeInTheDocument();
  });

  it("keeps the button and says so when it fails, so the person can try again", async () => {
    confirmarBaja.mockRejectedValueOnce(fallo(500));
    const user = userEvent.setup();
    abrir(`#t=${TOKEN}`);
    await user.click(await screen.findByRole("button", { name: "Dejar de recibirlo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo/);
    await user.click(screen.getByRole("button", { name: "Dejar de recibirlo" }));
    expect(await screen.findByRole("heading", { name: "Ya no lo recibirás" })).toBeInTheDocument();
  });

  it("explains the wait when there were too many attempts", async () => {
    confirmarBaja.mockRejectedValueOnce(fallo(429));
    const user = userEvent.setup();
    abrir(`#t=${TOKEN}`);
    await user.click(await screen.findByRole("button", { name: "Dejar de recibirlo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Espera unos minutos/);
  });
});

describe("a link that was already used", () => {
  it("says so and offers no button", async () => {
    consultarBaja.mockResolvedValue({ informe: "Eventos de la semana", programadoPor: "Ana Pérez", deBaja: true });
    abrir(`#t=${TOKEN}`);
    expect(await screen.findByRole("heading", { name: "Ya no lo recibirás" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dejar de recibirlo" })).not.toBeInTheDocument();
  });
});

describe("a link that is no good", () => {
  it("says so without asking the server when there is no token at all", async () => {
    abrir("");
    expect(await screen.findByRole("heading", { name: "Enlace no válido" })).toBeInTheDocument();
    expect(consultarBaja).not.toHaveBeenCalled();
  });

  it("says so when the server does not know the token", async () => {
    consultarBaja.mockRejectedValue(fallo(404));
    abrir(`#t=${TOKEN}`);
    expect(await screen.findByRole("heading", { name: "Enlace no válido" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dejar de recibirlo" })).not.toBeInTheDocument();
  });

  it("does not call a link bad because the server was unreachable: it offers to try again", async () => {
    consultarBaja.mockRejectedValueOnce(fallo(500));
    const user = userEvent.setup();
    abrir(`#t=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "No se pudo comprobar el enlace" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Enlace no válido" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(consultarBaja).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Eventos de la semana/)).toBeInTheDocument();
  });
});

describe("what it shows when the report is gone", () => {
  it("still lets the person stop it, without a name it does not have", async () => {
    consultarBaja.mockResolvedValue({ informe: null, programadoPor: null, deBaja: false });
    abrir(`#t=${TOKEN}`);
    expect(await screen.findByRole("button", { name: "Dejar de recibirlo" })).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });
});
