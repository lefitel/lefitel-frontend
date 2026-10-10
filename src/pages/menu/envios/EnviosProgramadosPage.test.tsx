import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { SesionInterface } from "../../../interfaces/interfaces";
import type { Programacion } from "../../../api/Programacion.api";
import { setPermisos, olvidarPermisos, sinPermisos } from "../../../lib/permissions";
import EnviosProgramadosPage from "./EnviosProgramadosPage";

const listarProgramaciones = vi.hoisted(() => vi.fn());
const actualizarProgramacion = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../../../api/Programacion.api", () => ({ listarProgramaciones, actualizarProgramacion }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, warning: vi.fn(), info: vi.fn() } }));
vi.mock("../../../components/dialogs/upsert/EnvioDialog", () => ({
  Estado: ({ estado }: { estado: string }) => <span>{`estado:${estado}`}</span>,
  default: (p: {
    open: boolean; programacion: Programacion | null; informeInicial?: number | null;
    puedeEditar: boolean; puedeEliminar: boolean; onClose: () => void; onChanged: () => void;
  }) => p.open ? (
    <div role="dialog" aria-label="formulario de envío">
      <p>{p.programacion ? `envío ${p.programacion.id}` : `envío nuevo, informe ${p.informeInicial ?? "ninguno"}`}</p>
      <p>{`editar:${p.puedeEditar} eliminar:${p.puedeEliminar}`}</p>
      <button type="button" onClick={p.onClose}>cerrar formulario</button>
      <button type="button" onClick={p.onChanged}>cambió algo</button>
    </div>
  ) : null,
}));

const ROL = 1;
const YO = 7;
const sesion = { usuario: { id: YO, id_rol: ROL }, autenticado: true } as unknown as SesionInterface;

const envio = (over: Partial<Programacion> = {}): Programacion => ({
  id: 5,
  id_reporte: 3,
  informe: { name: "Eventos de la semana", archivado: false },
  id_usuario: YO,
  dueno: { name: "Isaias", lastname: "Salas" },
  frecuencia: "semanal",
  dia_semana: 1,
  dia_mes: null,
  hora: 7,
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
  ultima: { estado: "enviado", programada_para: "2026-10-05T11:00:00.000Z", enviados: 2, detalle: null },
  ...over,
});

const AJENO = envio({
  id: 9,
  id_usuario: 8,
  dueno: { name: "Luis", lastname: "Rojas" },
  informe: { name: "Resumen mensual", archivado: false },
  frecuencia: "mensual", dia_semana: null, dia_mes: 1, hora: 8,
  activa: false, motivo_pausa: "fallos", proxima_ejecucion: null,
  ultima: { estado: "fallido", programada_para: "2026-10-01T12:00:00.000Z", enviados: 0, detalle: "x" },
});

function Direccion() {
  const { pathname, search } = useLocation();
  return <p data-testid="direccion">{pathname + search}</p>;
}

const permisos = (...pares: ["generador" | "seguridad", "ver" | "programar" | "editar"][]) => {
  const p = sinPermisos();
  for (const [modulo, accion] of pares) (p[modulo] as Record<string, boolean>)[accion] = true;
  setPermisos(ROL, p);
};

const abrir = (ruta = "/app/envios") =>
  render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <MemoryRouter initialEntries={[ruta]}>
        <EnviosProgramadosPage />
        <Direccion />
      </MemoryRouter>
    </SesionContext.Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  permisos(["generador", "ver"], ["generador", "programar"]);
  listarProgramaciones.mockResolvedValue({ data: [envio(), AJENO], total: 2, page: 1, limit: "all" });
  actualizarProgramacion.mockResolvedValue(envio());
});
afterEach(() => olvidarPermisos());

describe("what the table says", () => {
  it("reads each schedule the way a person would say it", async () => {
    abrir();
    const fila = (await screen.findByText("Eventos de la semana")).closest("tr") as HTMLElement;

    expect(within(fila).getByText("Lunes, 07:00")).toBeInTheDocument();
    expect(within(fila).getByText(/^Próximo:/)).toBeInTheDocument();
    expect(within(fila).getByText("1 usuario")).toBeInTheDocument();
    expect(within(fila).getByText("1 externo")).toBeInTheDocument();
    expect(within(fila).getByText("estado:enviado")).toBeInTheDocument();
  });

  it("says why a paused one is paused, in place of a next run", async () => {
    abrir();
    const fila = (await screen.findByText("Resumen mensual")).closest("tr") as HTMLElement;
    expect(within(fila).getByText("Día 1, 08:00")).toBeInTheDocument();
    expect(within(fila).getByText("En pausa: falló 3 veces seguidas")).toBeInTheDocument();
  });

  it("names the owner of somebody else's schedule and not of your own", async () => {
    abrir();
    expect(await screen.findByText(/de Luis Rojas/)).toBeInTheDocument();
    expect(screen.queryByText(/de Isaias Salas/)).not.toBeInTheDocument();
  });

  it("does not count an unsubscribed address among the recipients", async () => {
    listarProgramaciones.mockResolvedValue({
      data: [envio({ destinatarios: { usuarios: [], correos: [
        { email: "a@fuera.com", deBaja: false, rechazado: false },
        { email: "baja@fuera.com", deBaja: true, rechazado: false },
      ] } })],
      total: 1, page: 1, limit: "all",
    });
    abrir();
    expect(await screen.findByText("1 externo")).toBeInTheDocument();
  });

  it("counts what is listed and how much of it is running", async () => {
    abrir();
    expect(await screen.findByText("2 envíos · 1 activo")).toBeInTheDocument();
  });

  it("says so when the list could not be read", async () => {
    listarProgramaciones.mockRejectedValue(new Error("x"));
    abrir();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudieron cargar los envíos programados"));
  });
});

describe("pausing from the table", () => {
  it("sends the whole schedule back with only `activa` flipped, and reads the list again", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("switch", { name: "Pausar el envío de Eventos de la semana" }));

    await waitFor(() => expect(actualizarProgramacion).toHaveBeenCalledTimes(1));
    const [id, pedida] = actualizarProgramacion.mock.calls[0];
    expect(id).toBe(5);
    expect(pedida).toMatchObject({
      id_reporte: 3, frecuencia: "semanal", dia_semana: 1, hora: 7, activa: false,
      destinatarios: { usuarios: [20], correos: ["cliente@fuera.com"] },
    });
    await waitFor(() => expect(listarProgramaciones).toHaveBeenCalledTimes(2));
    expect(toastSuccess).toHaveBeenCalledWith("Envío en pausa");
  });

  it("does not open the row when the switch is what was clicked", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("switch", { name: "Pausar el envío de Eventos de la semana" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves somebody else's switch disabled, administration included", async () => {
    permisos(["generador", "ver"], ["generador", "programar"], ["seguridad", "editar"]);
    abrir();
    expect(await screen.findByRole("switch", { name: "Reactivar el envío de Resumen mensual" })).toBeDisabled();
  });

  it("says nothing more when the identity confirmation was cancelled", async () => {
    // The interceptor has already put its own sentence on screen; the
    // normalised error arrives with an empty message for exactly that reason.
    actualizarProgramacion.mockRejectedValue(Object.assign(new Error(""), { normalizado: true, mensaje: "" }));
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("switch", { name: "Pausar el envío de Eventos de la semana" }));
    await waitFor(() => expect(actualizarProgramacion).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("who may do what, as the form is told", () => {
  const formulario = () => screen.getByRole("dialog", { name: "formulario de envío" });

  it("lets the owner change and remove their own", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByText("Eventos de la semana"));
    expect(within(formulario()).getByText("envío 5")).toBeInTheDocument();
    expect(within(formulario()).getByText("editar:true eliminar:true")).toBeInTheDocument();
  });

  it("lets nobody change somebody else's, and lets only administration remove it", async () => {
    const user = userEvent.setup();
    const { unmount } = abrir();
    await user.click(await screen.findByText("Resumen mensual"));
    expect(within(formulario()).getByText("editar:false eliminar:false")).toBeInTheDocument();
    unmount();

    permisos(["generador", "ver"], ["generador", "programar"], ["seguridad", "editar"]);
    abrir();
    await user.click(await screen.findByText("Resumen mensual"));
    expect(within(formulario()).getByText("editar:false eliminar:true")).toBeInTheDocument();
  });

  it("offers no way to create one, and opens everything read-only, without the permission", async () => {
    permisos(["generador", "ver"]);
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Eventos de la semana");

    expect(screen.queryByRole("button", { name: "Nuevo envío" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pausar el envío de Eventos de la semana" })).toBeDisabled();
    await user.click(screen.getByText("Eventos de la semana"));
    expect(within(formulario()).getByText("editar:false eliminar:false")).toBeInTheDocument();
  });

  it("opens an empty form from the button, and reads the list again when something changed", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole("button", { name: "Nuevo envío" }));
    expect(within(formulario()).getByText("envío nuevo, informe ninguno")).toBeInTheDocument();
    expect(within(formulario()).getByText("editar:true eliminar:false")).toBeInTheDocument();

    await user.click(within(formulario()).getByRole("button", { name: "cambió algo" }));
    await waitFor(() => expect(listarProgramaciones).toHaveBeenCalledTimes(2));
  });
});

describe("arriving from the generator with a report in hand", () => {
  it("opens the form on that report and takes it out of the address", async () => {
    abrir("/app/envios?informe=12");
    expect(await screen.findByText("envío nuevo, informe 12")).toBeInTheDocument();
    expect(screen.getByTestId("direccion")).toHaveTextContent("/app/envios");
    expect(screen.getByTestId("direccion")).not.toHaveTextContent("informe");
  });

  it("opens nothing for somebody who may not schedule", async () => {
    permisos(["generador", "ver"]);
    abrir("/app/envios?informe=12");
    await screen.findByText("Eventos de la semana");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
