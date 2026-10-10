import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Programacion } from "../../../api/Programacion.api";
import EnvioDialog from "./EnvioDialog";

const api = vi.hoisted(() => ({
  actualizarProgramacion: vi.fn(),
  crearProgramacion: vi.fn(),
  eliminarProgramacion: vi.fn(),
  enviarProgramacionAhora: vi.fn(),
  listarDestinatariosPosibles: vi.fn(),
  listarEjecuciones: vi.fn(),
}));
const getReportesGuardados = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }));

vi.mock("../../../api/Programacion.api", () => api);
vi.mock("../../../api/generador.api", () => ({ getReportesGuardados }));
vi.mock("sonner", () => ({ toast }));

const guardado = (over: Partial<Programacion> = {}): Programacion => ({
  id: 5,
  id_reporte: 3,
  informe: { name: "Eventos de la semana", archivado: false },
  id_usuario: 7,
  dueno: { name: "Isaias", lastname: "Salas" },
  frecuencia: "semanal",
  dia_semana: 1,
  dia_mes: null,
  hora: 7,
  minuto: 0,
  formato: "excel",
  con_fotos: false,
  activa: true,
  motivo_pausa: null,
  fallos_seguidos: 0,
  proxima_ejecucion: "2026-10-12T11:00:00.000Z",
  destinatarios: {
    usuarios: [{ id_usuario: 20, name: "Beto", lastname: "Mamani", tieneCorreo: true }],
    correos: [{ email: "cliente@fuera.com", deBaja: false, rechazado: false }],
  },
  ultima: null,
  ...over,
});

const onClose = vi.fn();
const onChanged = vi.fn();

const abrir = (props: Partial<Parameters<typeof EnvioDialog>[0]> = {}) =>
  render(
    <EnvioDialog
      open programacion={null} puedeEditar puedeEliminar={false}
      onClose={onClose} onChanged={onChanged} {...props}
    />,
  );

const elegir = async (user: ReturnType<typeof userEvent.setup>, control: string, opcion: string) => {
  await user.click(screen.getByRole("combobox", { name: control }));
  await user.click(await screen.findByRole("option", { name: opcion }));
};

beforeEach(() => {
  vi.clearAllMocks();
  getReportesGuardados.mockResolvedValue({
    rows: [{ id: 3, name: "Eventos de la semana" }, { id: 4, name: "Postes sin revisar" }],
    total: 2, limit: 200, offset: 0,
  });
  api.listarDestinatariosPosibles.mockResolvedValue({
    data: [
      { id: 20, name: "Beto", lastname: "Mamani", tieneCorreo: true },
      { id: 21, name: "Carla", lastname: "Quispe", tieneCorreo: false },
    ],
    total: 2, page: 1, limit: "all",
  });
  api.listarEjecuciones.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
  api.crearProgramacion.mockResolvedValue(guardado());
  api.actualizarProgramacion.mockResolvedValue(guardado());
  api.eliminarProgramacion.mockResolvedValue(undefined);
});

describe("a new schedule", () => {
  it("starts from the report it was handed", async () => {
    abrir({ informeInicial: 4 });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Informe" })).toHaveTextContent("Postes sin revisar"));
  });

  it("says what is missing instead of sending, by the names on screen", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Beto Mamani");
    await user.click(screen.getByRole("button", { name: "Programar envío" }));

    expect(await screen.findByText(/Faltan 2 campos: Informe y Destinatarios/)).toBeInTheDocument();
    expect(api.crearProgramacion).not.toHaveBeenCalled();
  });

  it("sends what was chosen, tells the list behind and closes", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Beto Mamani");
    await elegir(user, "Informe", "Eventos de la semana");
    await elegir(user, "Día de la semana", "Viernes");
    await user.click(screen.getByRole("button", { name: "Elegir una hora en punto" }));
    await user.click(await screen.findByRole("option", { name: "09:00" }));
    await user.click(screen.getByRole("checkbox", { name: /Beto Mamani/ }));
    await user.type(screen.getByLabelText("Correos externos"), "Cliente@Fuera.com");
    await user.click(screen.getByRole("button", { name: "Programar envío" }));

    await waitFor(() => expect(api.crearProgramacion).toHaveBeenCalledTimes(1));
    expect(api.crearProgramacion).toHaveBeenCalledWith({
      id_reporte: 3, frecuencia: "semanal", dia_semana: 5, dia_mes: null, hora: 9, minuto: 0,
      formato: "excel", con_fotos: false, activa: true,
      destinatarios: { usuarios: [20], correos: ["cliente@fuera.com"] },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Envío programado");
  });

  it("refuses an address that is not one, naming it, and sends nothing", async () => {
    const user = userEvent.setup();
    abrir({ informeInicial: 3 });
    await screen.findByText("Beto Mamani");
    await user.click(screen.getByRole("checkbox", { name: /Beto Mamani/ }));
    await user.type(screen.getByLabelText("Correos externos"), "no-es-correo");

    expect(screen.getByRole("alert")).toHaveTextContent("No es una dirección válida: no-es-correo");
    await user.click(screen.getByRole("button", { name: "Programar envío" }));
    expect(api.crearProgramacion).not.toHaveBeenCalled();
  });

  it("keeps the form open and says why when the server refuses", async () => {
    api.crearProgramacion.mockRejectedValue({ response: { status: 400, data: { message: "El informe no existe." } } });
    const user = userEvent.setup();
    abrir({ informeInicial: 3 });
    await screen.findByText("Beto Mamani");
    await user.click(screen.getByRole("checkbox", { name: /Beto Mamani/ }));
    await user.click(screen.getByRole("button", { name: "Programar envío" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("the day field follows the frequency", () => {
  it("asks for a weekday when weekly, a day of the month when monthly, and nothing when daily", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Beto Mamani");
    expect(screen.getByRole("combobox", { name: "Día de la semana" })).toBeInTheDocument();

    await elegir(user, "Frecuencia", "Cada mes");
    expect(screen.queryByRole("combobox", { name: "Día de la semana" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Día del mes" })).toBeInTheDocument();
    expect(screen.getByText(/Del 1 al 28/)).toBeInTheDocument();

    await elegir(user, "Frecuencia", "Cada día");
    expect(screen.queryByRole("combobox", { name: "Día del mes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Día de la semana" })).not.toBeInTheDocument();
  });

  it("offers photographs only for Excel", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Beto Mamani");
    expect(screen.getByRole("switch", { name: "Con fotos" })).toBeInTheDocument();
    await elegir(user, "Formato", "PDF");
    expect(screen.queryByRole("switch", { name: "Con fotos" })).not.toBeInTheDocument();
  });
});

describe("the recipients", () => {
  it("warns about an account that lost its address after it was added, and lets it be taken off — not put back", async () => {
    const user = userEvent.setup();
    const base = guardado();
    abrir({
      programacion: guardado({
        destinatarios: {
          ...base.destinatarios,
          usuarios: [...base.destinatarios.usuarios, { id_usuario: 21, name: "Carla", lastname: "Quispe", tieneCorreo: false }],
        },
      }),
    });
    const carla = await screen.findByRole("checkbox", { name: /Carla Quispe/ });
    expect(carla).toBeChecked();
    expect(carla).toBeEnabled();
    expect(screen.getByText(/Carla Quispe no tiene un correo verificado/)).toBeInTheDocument();

    await user.click(carla);
    expect(carla).not.toBeChecked();
    expect(carla).toBeDisabled();
    expect(screen.queryByText(/Carla Quispe no tiene un correo verificado/)).not.toBeInTheDocument();
  });

  it("counts accounts and addresses together against the ceiling", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("checkbox", { name: /Beto Mamani/ }));
    await user.type(screen.getByLabelText("Correos externos"), "a@b.com, c@d.com");
    expect(screen.getByText("3 de 10 destinatarios")).toBeInTheDocument();
  });

  it("filters the accounts by name", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Beto Mamani");
    await user.type(screen.getByPlaceholderText("Buscar por nombre…"), "carla");
    expect(screen.queryByText("Beto Mamani")).not.toBeInTheDocument();
    expect(screen.getByText("Carla Quispe")).toBeInTheDocument();
  });
});

describe("an existing schedule", () => {
  it("opens as it was saved and saves a change through the update", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await screen.findByText("Beto Mamani");
    expect(screen.getByLabelText("Correos externos")).toHaveValue("cliente@fuera.com");
    expect(screen.getByRole("checkbox", { name: /Beto Mamani/ })).toBeChecked();

    const hora = screen.getByLabelText("Hora");
    expect(hora).toHaveValue("07:00");
    await user.clear(hora);
    await user.type(hora, "10:20");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(api.actualizarProgramacion).toHaveBeenCalledTimes(1));
    expect(api.actualizarProgramacion.mock.calls[0]).toEqual([5, expect.objectContaining({ hora: 10, minuto: 20, id_reporte: 3 })]);
    expect(toast.success).toHaveBeenCalledWith("Envío actualizado");
  });

  it("takes a typed time as soon as it reads as one, and puts the last good one back over nonsense", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await screen.findByText("Beto Mamani");
    const hora = screen.getByLabelText("Hora");

    await user.clear(hora);
    await user.type(hora, "730");
    await user.tab();
    expect(hora).toHaveValue("07:30");

    await user.clear(hora);
    await user.type(hora, "25:99");
    expect(hora).toBeInvalid();
    await user.tab();
    expect(hora).toHaveValue("07:30");
    expect(hora).toBeValid();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.actualizarProgramacion).toHaveBeenCalledTimes(1));
    expect(api.actualizarProgramacion.mock.calls[0][1]).toEqual(expect.objectContaining({ hora: 7, minuto: 30 }));
  });

  it("goes back on the dot when an hour is picked from the list", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado({ minuto: 45 }) });
    await screen.findByText("Beto Mamani");
    expect(screen.getByLabelText("Hora")).toHaveValue("07:45");

    await user.click(screen.getByRole("button", { name: "Elegir una hora en punto" }));
    await user.click(await screen.findByRole("option", { name: "18:00" }));
    expect(screen.getByLabelText("Hora")).toHaveValue("18:00");
  });

  it("does not let an account with no verified address be added, and lets one already there be taken off", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await screen.findByText("Beto Mamani");
    const carla = screen.getByRole("checkbox", { name: /Carla Quispe/ });
    expect(carla).toBeDisabled();
    await user.click(carla);
    expect(carla).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Beto Mamani/ })).toBeEnabled();
  });

  it("says who unsubscribed and who the mail no longer reaches, apart from the box", async () => {
    abrir({
      programacion: guardado({
        destinatarios: {
          usuarios: [],
          correos: [
            { email: "sigue@fuera.com", deBaja: false, rechazado: false },
            { email: "baja@fuera.com", deBaja: true, rechazado: false },
            { email: "rebota@fuera.com", deBaja: false, rechazado: true },
          ],
        },
      }),
    });
    await screen.findByText("Beto Mamani");
    expect(screen.getByLabelText("Correos externos")).toHaveValue("sigue@fuera.com, rebota@fuera.com");
    expect(screen.getByText(/Se dio de baja y ya no recibe: baja@fuera.com/)).toBeInTheDocument();
    expect(screen.getByText(/El correo no llega a rebota@fuera.com/)).toBeInTheDocument();
  });

  it("sends it now, says how many received it, and does not close", async () => {
    api.enviarProgramacionAhora.mockResolvedValue({ tipo: "ejecutado", estado: "enviado", enviados: 2, no_enviados: 0 });
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await user.click(await screen.findByRole("button", { name: "Enviar ahora" }));

    await waitFor(() => expect(api.enviarProgramacionAhora).toHaveBeenCalledWith(5));
    expect(toast.success).toHaveBeenCalledWith("Enviado a 2 destinatarios");
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not report a failed or a paused attempt as sent", async () => {
    const user = userEvent.setup();
    api.enviarProgramacionAhora.mockResolvedValueOnce({ tipo: "ejecutado", estado: "fallido", enviados: 0, no_enviados: 2 });
    abrir({ programacion: guardado() });
    await user.click(await screen.findByRole("button", { name: "Enviar ahora" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    api.enviarProgramacionAhora.mockResolvedValueOnce({ tipo: "pausada", motivo: "sin_destinatarios" });
    await user.click(screen.getByRole("button", { name: "Enviar ahora" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("will not send now what has not been saved: it would send the old version", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await screen.findByText("Beto Mamani");
    await user.type(screen.getByLabelText("Hora"), "{Control>}a{/Control}10:00");
    expect(screen.getByRole("button", { name: "Enviar ahora" })).toBeDisabled();
    expect(screen.getByText("Guarda los cambios antes de enviar.")).toBeInTheDocument();
  });

  it("asks before removing, and removes only on the second press", async () => {
    const user = userEvent.setup();
    abrir({ programacion: guardado(), puedeEliminar: true });
    await user.click(await screen.findByRole("button", { name: "Eliminar envío" }));
    expect(api.eliminarProgramacion).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() => expect(api.eliminarProgramacion).toHaveBeenCalledWith(5));
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the history, each run with how it ended", async () => {
    api.listarEjecuciones.mockResolvedValue({
      data: [
        { id: 1, id_programacion: 5, programada_para: "2026-10-05T11:00:00.000Z", manual: false, estado: "enviado", iniciada_at: "", terminada_at: "", filas: 214, bytes: 98304, enviados: 3, no_enviados: 0, detalle: null },
        { id: 2, id_programacion: 5, programada_para: "2026-09-21T11:00:00.000Z", manual: true, estado: "fallido", iniciada_at: "", terminada_at: "", filas: null, bytes: null, enviados: 0, no_enviados: 3, detalle: "La consulta tardó demasiado." },
        { id: 3, id_programacion: 5, programada_para: "2026-09-14T11:00:00.000Z", manual: false, estado: "omitido", iniciada_at: "", terminada_at: "", filas: null, bytes: null, enviados: 0, no_enviados: 0, detalle: null },
      ],
      total: 3, page: 1, limit: 50,
    });
    const user = userEvent.setup();
    abrir({ programacion: guardado() });
    await user.click(await screen.findByRole("tab", { name: "Historial" }));

    const filas = await screen.findAllByRole("row");
    expect(within(filas[1]).getByText("Enviado")).toBeInTheDocument();
    expect(within(filas[1]).getByText("214 filas · 96 KB")).toBeInTheDocument();
    expect(within(filas[1]).getByText("3 de 3")).toBeInTheDocument();
    expect(within(filas[2]).getByText("Falló")).toBeInTheDocument();
    expect(within(filas[2]).getByText("La consulta tardó demasiado.")).toBeInTheDocument();
    expect(within(filas[2]).getByText("Envío manual")).toBeInTheDocument();
    expect(within(filas[3]).getByText("Omitido")).toBeInTheDocument();
    expect(within(filas[3]).getByText("—")).toBeInTheDocument();
    // The history is not a form: nothing to save from it.
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });
});

describe("somebody who may only look", () => {
  it("sees the schedule and no way to change, send or remove it", async () => {
    abrir({ programacion: guardado(), puedeEditar: false, puedeEliminar: false });

    expect(await screen.findByText("Beto Mamani")).toBeInTheDocument();
    expect(screen.getByText("cliente@fuera.com")).toBeInTheDocument();
    for (const nombre of ["Guardar cambios", "Enviar ahora", "Eliminar envío"]) {
      expect(screen.queryByRole("button", { name: nombre })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Correos externos", { selector: "textarea" })).not.toBeInTheDocument();
    // The list of accounts is behind the write permission: it is not asked for.
    expect(api.listarDestinatariosPosibles).not.toHaveBeenCalled();
  });

  it("lets administration remove it without being able to change it", async () => {
    abrir({ programacion: guardado(), puedeEditar: false, puedeEliminar: true });
    expect(await screen.findByRole("button", { name: "Eliminar envío" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar ahora" })).not.toBeInTheDocument();
  });
});

describe("the search box inside the form", () => {
  it("does not save the form when Intro is pressed in it", async () => {
    const user = userEvent.setup();
    abrir({ informeInicial: 3 });
    await user.click(await screen.findByRole("checkbox", { name: /Beto Mamani/ }));
    await user.type(screen.getByPlaceholderText("Buscar por nombre…"), "beto{Enter}");
    expect(api.crearProgramacion).not.toHaveBeenCalled();
  });
});

describe("under React's strict mode, which is how the application runs in development", () => {
  it("still fills its lists and its history", async () => {
    api.listarEjecuciones.mockResolvedValue({
      data: [{ id: 1, id_programacion: 5, programada_para: "2026-10-05T11:00:00.000Z", manual: false, estado: "enviado", iniciada_at: "", terminada_at: "", filas: 3, bytes: 2048, enviados: 1, no_enviados: 0, detalle: null }],
      total: 1, page: 1, limit: 50,
    });
    const user = userEvent.setup();
    render(
      <StrictMode>
        <EnvioDialog open programacion={guardado()} puedeEditar puedeEliminar onClose={onClose} onChanged={onChanged} />
      </StrictMode>,
    );
    expect(await screen.findByText("Beto Mamani")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Beto Mamani/ })).toBeChecked();
    await user.click(screen.getByRole("tab", { name: "Historial" }));
    expect(await screen.findByText("Enviado")).toBeInTheDocument();
  });
});
