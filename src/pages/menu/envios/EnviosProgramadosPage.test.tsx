import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { SesionInterface } from "../../../interfaces/interfaces";
import type { EjecucionDelHistorial, EntregaDeEjecucion, Programacion } from "../../../api/Programacion.api";
import { setPermisos, olvidarPermisos, sinPermisos } from "../../../lib/permissions";
import EnviosProgramadosPage from "./EnviosProgramadosPage";

const listarProgramaciones = vi.hoisted(() => vi.fn());
const actualizarProgramacion = vi.hoisted(() => vi.fn());
const listarHistorial = vi.hoisted(() => vi.fn());
const listarDestinatariosDeEjecucion = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../../../api/Programacion.api", () => ({ listarProgramaciones, actualizarProgramacion, listarHistorial, listarDestinatariosDeEjecucion }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess, warning: vi.fn(), info: vi.fn() } }));
// The result pill is one component for the table, the dialog and the history;
// its words are the dialog's tests' business. Here it only says which result
// each row was given.
vi.mock("../../../components/EstadoDeEjecucion", () => ({
  Estado: ({ estado }: { estado: string }) => <span>{`estado:${estado}`}</span>,
}));
vi.mock("../../../components/dialogs/upsert/EnvioDialog", () => ({
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
  listarHistorial.mockResolvedValue({ data: [], total: 0, page: 1, limit: 15 });
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
      id_reporte: 3, frecuencia: "semanal", dia_semana: 1, hora: 7, minuto: 0, activa: false,
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

describe("under React's strict mode, which is how the application runs in development", () => {
  it("still shows the list: the screen is mounted, unmounted and mounted again before anything arrives", async () => {
    // Strict mode runs every effect's cleanup once and then the effect again.
    // A "still mounted" flag that the cleanup lowers and nothing raises back
    // leaves the page believing it is gone, so the answer is thrown away and
    // the skeleton stays for ever. Seen in a browser on 10 October 2026, with
    // every test here green.
    render(
      <StrictMode>
        <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
          <MemoryRouter initialEntries={["/app/envios"]}>
            <EnviosProgramadosPage />
          </MemoryRouter>
        </SesionContext.Provider>
      </StrictMode>,
    );
    expect(await screen.findByText("Eventos de la semana")).toBeInTheDocument();
  });
});

// ─── The history of every schedule ───────────────────────────────────────────

const corrida = (
  over: Partial<EjecucionDelHistorial> = {},
  programacion: Partial<EjecucionDelHistorial["programacion"]> = {},
): EjecucionDelHistorial => ({
  id: 100,
  id_programacion: 5,
  programada_para: "2026-10-12T11:00:00.000Z",
  manual: false,
  estado: "enviado",
  iniciada_at: "2026-10-12T11:00:01.000Z",
  terminada_at: "2026-10-12T11:00:09.000Z",
  filas: 214,
  bytes: 98304,
  enviados: 2,
  no_enviados: 0,
  detalle: null,
  // Most of the runs below stand for old ones; the tests of the recipients ask for the others.
  con_destinatarios: false,
  programacion: {
    id: 5,
    formato: "excel",
    eliminada: false,
    informe: { id: 3, name: "Eventos de la semana" },
    dueno: { id: YO, name: "Isaias", lastname: "Salas" },
    ...programacion,
  },
  ...over,
});

const sobre = (data: EjecucionDelHistorial[], total = data.length, page = 1) => ({ data, total, page, limit: 15 });

/** A promise the test settles when it decides, to choose the order answers arrive in. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

const pestana = async (user: ReturnType<typeof userEvent.setup>, nombre: "Envíos" | "Historial") =>
  user.click(await screen.findByRole("tab", { name: nombre }));

/** What the last request to the history asked for. */
const ultimaConsulta = (): Record<string, unknown> => listarHistorial.mock.calls.at(-1)![0];

async function abrirElHistorial(user: ReturnType<typeof userEvent.setup>) {
  abrir();
  await screen.findByText("Eventos de la semana");
  await pestana(user, "Historial");
}

async function elegir(user: ReturnType<typeof userEvent.setup>, control: string, opcion: string) {
  await user.click(screen.getByRole("combobox", { name: control }));
  await user.click(await screen.findByRole("option", { name: opcion }));
}

describe("the Historial tab", () => {
  it("does not ask for the history until the tab is opened, and asks once for the first page", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Eventos de la semana");
    expect(listarHistorial).not.toHaveBeenCalled();

    await pestana(user, "Historial");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(1));
    expect(listarHistorial).toHaveBeenCalledWith({ page: 1, limit: 15 });

    // Leaving and coming back is not a reason to ask again: the refresh button is.
    await pestana(user, "Envíos");
    await pestana(user, "Historial");
    await screen.findByText("Todavía no se ha enviado nada.");
    expect(listarHistorial).toHaveBeenCalledTimes(1);
  });

  it("leaves the Envíos tab as it was", async () => {
    const user = userEvent.setup();
    abrir();
    expect(await screen.findByText("Eventos de la semana")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Envíos" })).toHaveAttribute("aria-selected", "true");

    await pestana(user, "Historial");
    expect(screen.queryByText("Eventos de la semana")).not.toBeInTheDocument();
    await pestana(user, "Envíos");
    expect(await screen.findByText("Eventos de la semana")).toBeInTheDocument();
    expect(listarProgramaciones).toHaveBeenCalledTimes(1);
  });

  it("shows a run of each kind: a manual one, a deleted schedule, a missing report, a skipped one", async () => {
    listarHistorial.mockResolvedValue(sobre([
      corrida({ id: 1 }),
      corrida({ id: 2, manual: true, estado: "fallido", filas: null, bytes: null, enviados: 0, no_enviados: 3, detalle: "La consulta tardó demasiado." }),
      corrida({ id: 3 }, { id: 8, eliminada: true, formato: "pdf", informe: { id: 4, name: "Informe viejo" } }),
      corrida({ id: 4 }, { informe: null }),
      corrida({ id: 5, estado: "omitido", filas: null, bytes: null, enviados: 0, no_enviados: 0 }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Informe viejo");
    const filas = screen.getAllByRole("row").slice(1);

    // A run that went out: the date, the result, the size of what was sent, who got it.
    expect(within(filas[0]).getByText(/^0?12\/10,? 07:00$/)).toBeInTheDocument();
    expect(within(filas[0]).getByText("Eventos de la semana")).toBeInTheDocument();
    expect(within(filas[0]).getByText("Excel")).toBeInTheDocument();
    expect(within(filas[0]).getByText("estado:enviado")).toBeInTheDocument();
    expect(within(filas[0]).getByText("214 filas · 96 KB")).toBeInTheDocument();
    expect(within(filas[0]).getByText("2 de 2")).toBeInTheDocument();
    expect(within(filas[0]).queryByText("Envío manual")).not.toBeInTheDocument();

    // Manual, and failed: the server's sentence and who it did not reach.
    expect(within(filas[1]).getByText("Envío manual")).toBeInTheDocument();
    expect(within(filas[1]).getByText("estado:fallido")).toBeInTheDocument();
    expect(within(filas[1]).getByText("La consulta tardó demasiado.")).toBeInTheDocument();
    expect(within(filas[1]).getByText("0 de 3")).toBeInTheDocument();

    // A schedule that was removed keeps its runs, said so under the report.
    expect(within(filas[2]).getByText("Informe viejo")).toBeInTheDocument();
    expect(within(filas[2]).getByText(/^PDF · Envío eliminado$/)).toBeInTheDocument();

    // A report that is gone.
    expect(within(filas[3]).getByText("Informe eliminado")).toBeInTheDocument();

    // A run that was skipped tried nobody.
    expect(within(filas[4]).getByText("estado:omitido")).toBeInTheDocument();
    expect(within(filas[4]).getByText("—")).toBeInTheDocument();
  });

  it("names the owner for administration, when the schedule is somebody else's, and for nobody else", async () => {
    permisos(["generador", "ver"], ["generador", "programar"], ["seguridad", "editar"]);
    listarHistorial.mockResolvedValue(sobre([
      corrida({ id: 1 }),
      corrida({ id: 2 }, { id: 9, dueno: { id: 8, name: "Luis", lastname: "Rojas" } }),
      corrida({ id: 3 }, { id: 9, dueno: null }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText(/de Luis Rojas/);

    expect(screen.getAllByText(/de Luis Rojas/)).toHaveLength(1);
    expect(screen.queryByText(/de Isaias Salas/)).not.toBeInTheDocument();
  });

  it("does not name an owner to somebody who is not administration", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 2 }, { dueno: { id: 8, name: "Luis", lastname: "Rojas" } })]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Eventos de la semana");
    expect(screen.queryByText(/Luis/)).not.toBeInTheDocument();
  });

  it("says there is nothing yet, and says something else when a filter is what emptied it", async () => {
    const user = userEvent.setup();
    await abrirElHistorial(user);
    expect(await screen.findByText("Todavía no se ha enviado nada.")).toBeInTheDocument();

    await elegir(user, "Resultado", "Falló");
    expect(await screen.findByText("Ningún envío con ese filtro.")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no se ha enviado nada.")).not.toBeInTheDocument();
  });

  it("offers every result under the pill's own words, and the schedules the screen already has", async () => {
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await user.click(screen.getByRole("combobox", { name: "Resultado" }));
    const resultados = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(resultados).toEqual(["Todos", "Enviado", "Sin resultados", "Demasiado grande", "Falló", "Omitido", "Enviando…"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Envío" }));
    const envios = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(envios).toEqual([
      "Todos",
      "Eventos de la semana · Lunes, 07:00",
      "Resumen mensual · Día 1, 08:00",
    ]);
  });

  it("sends the result that was chosen, and sends none for «Todos»", async () => {
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(1));

    await elegir(user, "Resultado", "Falló");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, estado: "fallido" });

    await elegir(user, "Resultado", "Todos");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15 });
    // The page hands the client function `estado: undefined`; dropping the key is that function's job (its own test pins it).
    expect(ultimaConsulta().estado).toBeUndefined();
  });

  it("sends the schedule that was chosen, and the two filters together", async () => {
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(1));

    await elegir(user, "Envío", "Resumen mensual · Día 1, 08:00");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, id_programacion: 9 });

    await elegir(user, "Resultado", "Omitido");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, id_programacion: 9, estado: "omitido" });

    await elegir(user, "Envío", "Todos");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(4));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, estado: "omitido" });
  });

  it("asks for the next page by number, and goes back to the first when a filter changes", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida()], 40));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Mostrando 1–15 de 40");

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
    expect(ultimaConsulta()).toEqual({ page: 2, limit: 15 });
    await screen.findByText("Página 2 de 3");

    await elegir(user, "Resultado", "Falló");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, estado: "fallido" });
    // The table is told too, not only the request: it would otherwise go on
    // saying "Página 2" over page one's rows.
    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
  });

  it("keeps the page when the refresh button is pressed", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida()], 40));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Mostrando 1–15 de 40");
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
    expect(ultimaConsulta()).toEqual({ page: 2, limit: 15 });
  });

  describe("an answer that arrives late", () => {
    it("is thrown away when the filter has changed since: the older request finishes last", async () => {
      const inicial = diferida<ReturnType<typeof sobre>>();
      const fallo = diferida<ReturnType<typeof sobre>>();
      const enviado = diferida<ReturnType<typeof sobre>>();
      listarHistorial
        .mockReturnValueOnce(inicial.promesa)
        .mockReturnValueOnce(fallo.promesa)
        .mockReturnValueOnce(enviado.promesa);
      const user = userEvent.setup();
      await abrirElHistorial(user);
      inicial.resolver(sobre([]));
      await screen.findByText("Todavía no se ha enviado nada.");

      await elegir(user, "Resultado", "Falló");
      await elegir(user, "Resultado", "Enviado");
      await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));

      // The newest answers first, and the older one after it.
      enviado.resolver(sobre([corrida({ id: 2, estado: "enviado" }, { informe: { id: 3, name: "Respuesta de Enviado" } })]));
      await screen.findByText("Respuesta de Enviado");
      fallo.resolver(sobre([corrida({ id: 1, estado: "fallido" }, { informe: { id: 3, name: "Respuesta de Falló" } })]));
      await act(async () => { await fallo.promesa; });

      expect(screen.getByText("Respuesta de Enviado")).toBeInTheDocument();
      expect(screen.queryByText("Respuesta de Falló")).not.toBeInTheDocument();
    });

    it("is thrown away when it is for another page", async () => {
      const primera = diferida<ReturnType<typeof sobre>>();
      const segunda = diferida<ReturnType<typeof sobre>>();
      listarHistorial
        .mockResolvedValueOnce(sobre([corrida({ id: 1 }, { informe: { id: 3, name: "Página uno" } })], 40))
        .mockReturnValueOnce(primera.promesa)
        .mockReturnValueOnce(segunda.promesa);
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await screen.findByText("Página uno");

      await user.click(screen.getByRole("button", { name: "Página siguiente" }));
      await user.click(screen.getByRole("button", { name: "Página siguiente" }));
      await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
      expect(ultimaConsulta()).toEqual({ page: 3, limit: 15 });

      segunda.resolver(sobre([corrida({ id: 3 }, { informe: { id: 3, name: "Página tres" } })], 40, 3));
      await screen.findByText("Página tres");
      primera.resolver(sobre([corrida({ id: 2 }, { informe: { id: 3, name: "Página dos" } })], 40, 2));
      await act(async () => { await primera.promesa; });

      expect(screen.getByText("Página tres")).toBeInTheDocument();
      expect(screen.queryByText("Página dos")).not.toBeInTheDocument();
    });

    it("does not let a failure of an older request spoil a newer answer", async () => {
      const viejo = diferida<ReturnType<typeof sobre>>();
      listarHistorial
        .mockResolvedValueOnce(sobre([]))
        .mockReturnValueOnce(viejo.promesa)
        .mockResolvedValueOnce(sobre([corrida({ id: 2 }, { informe: { id: 3, name: "La respuesta buena" } })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await screen.findByText("Todavía no se ha enviado nada.");

      await elegir(user, "Resultado", "Falló");
      await elegir(user, "Resultado", "Enviado");
      await screen.findByText("La respuesta buena");
      viejo.rechazar(new Error("x"));
      await act(async () => { await viejo.promesa.catch(() => undefined); });

      expect(screen.getByText("La respuesta buena")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe("opening a run", () => {
    it("opens the dialog of its schedule", async () => {
      listarHistorial.mockResolvedValue(sobre([corrida({ id: 1, id_programacion: 9 }, { id: 9, informe: { id: 4, name: "Resumen mensual" } })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await user.click(await screen.findByText("estado:enviado"));

      const dialogo = screen.getByRole("dialog", { name: "formulario de envío" });
      expect(within(dialogo).getByText("envío 9")).toBeInTheDocument();
      // The same permissions as from the first tab: it is not the owner's.
      expect(within(dialogo).getByText("editar:false eliminar:false")).toBeInTheDocument();
    });

    it("does not open anything for a schedule that was deleted", async () => {
      listarHistorial.mockResolvedValue(sobre([corrida({ id: 1 }, { eliminada: true })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await user.click(await screen.findByText("estado:enviado"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("estado:enviado").closest("tr")).not.toHaveClass("cursor-pointer");
    });

    it("does not open anything for a schedule the screen does not have", async () => {
      listarHistorial.mockResolvedValue(sobre([corrida({ id: 1, id_programacion: 77 }, { id: 77 })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await user.click(await screen.findByText("estado:enviado"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("reads the history again when something was changed from the dialog, and the list too", async () => {
      listarHistorial.mockResolvedValue(sobre([corrida({ id: 1 })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await user.click(await screen.findByText("estado:enviado"));
      await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(1));

      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "cambió algo" }));

      await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
      expect(ultimaConsulta()).toEqual({ page: 1, limit: 15 });
      await waitFor(() => expect(listarProgramaciones).toHaveBeenCalledTimes(2));
    });

    it("does not ask for the history after a change if the tab was never opened", async () => {
      const user = userEvent.setup();
      abrir();
      await user.click(await screen.findByText("Eventos de la semana"));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "cambió algo" }));
      await waitFor(() => expect(listarProgramaciones).toHaveBeenCalledTimes(2));
      expect(listarHistorial).not.toHaveBeenCalled();
    });
  });

  describe("when it cannot be read", () => {
    it("says so with a retry, and the retry loads it", async () => {
      listarHistorial.mockRejectedValueOnce(new Error("x"));
      const user = userEvent.setup();
      await abrirElHistorial(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el historial de envíos");
      expect(toastError).toHaveBeenCalledWith("No se pudo cargar el historial de envíos");

      listarHistorial.mockResolvedValueOnce(sobre([corrida({ id: 1 })]));
      await user.click(screen.getByRole("button", { name: "Reintentar" }));

      expect(await screen.findByText("estado:enviado")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(listarHistorial).toHaveBeenCalledTimes(2);
    });

    it("still offers the filters without the list of schedules, with «Todos» only", async () => {
      listarProgramaciones.mockRejectedValue(new Error("x"));
      const user = userEvent.setup();
      abrir();
      await pestana(user, "Historial");
      await screen.findByText("Todavía no se ha enviado nada.");
      await user.click(screen.getByRole("combobox", { name: "Envío" }));
      expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Todos"]);
    });
  });
});

describe("the Historial tab, coming back to it and its controls", () => {
  const tamano = async (user: ReturnType<typeof userEvent.setup>, n: string) => {
    await user.click(screen.getByRole("combobox", { name: "Mostrar" }));
    await user.click(await screen.findByRole("option", { name: n }));
  };

  it("comes back to the page it was left on, over that page's rows, without asking again", async () => {
    listarHistorial
      .mockResolvedValueOnce(sobre([corrida({ id: 1 }, { informe: { id: 3, name: "Fila de la página uno" } })], 40))
      .mockResolvedValueOnce(sobre([corrida({ id: 2 }, { informe: { id: 3, name: "Fila de la página dos" } })], 40, 2));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Fila de la página uno");
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await screen.findByText("Fila de la página dos");
    expect(listarHistorial).toHaveBeenCalledTimes(2);

    await pestana(user, "Envíos");
    await pestana(user, "Historial");

    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("Fila de la página dos")).toBeInTheDocument();
    expect(listarHistorial).toHaveBeenCalledTimes(2);
  });

  it("asks for the page size that was chosen, and keeps it through a filter change and a refresh", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida()], 80));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Mostrando 1–15 de 80");

    await tamano(user, "25");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 25 });

    await elegir(user, "Resultado", "Falló");
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(3));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 25, estado: "fallido" });
    expect(await screen.findByText("Mostrando 1–25 de 80")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(4));
    expect(ultimaConsulta()).toEqual({ page: 1, limit: 25, estado: "fallido" });
  });

  describe("a schedule chosen in the «Envío» filter that is no longer among the loaded ones", () => {
    const elegirYVolverALista = async (user: ReturnType<typeof userEvent.setup>, lista: () => void) => {
      await abrirElHistorial(user);
      await elegir(user, "Envío", "Resumen mensual · Día 1, 08:00");
      await waitFor(() => expect(listarHistorial).toHaveBeenCalledTimes(2));
      await pestana(user, "Envíos");
      lista();
      await user.click(await screen.findByRole("button", { name: "Refrescar" }));
      await waitFor(() => expect(listarProgramaciones).toHaveBeenCalledTimes(2));
      await pestana(user, "Historial");
    };

    it("is called «Envío eliminado» when the list is loaded and it is not in it", async () => {
      const user = userEvent.setup();
      await elegirYVolverALista(user, () =>
        listarProgramaciones.mockResolvedValue({ data: [envio()], total: 1, page: 1, limit: "all" }));

      expect(await screen.findByRole("combobox", { name: "Envío" })).toHaveTextContent("Envío eliminado");
      await user.click(screen.getByRole("combobox", { name: "Envío" }));
      expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
        "Todos", "Eventos de la semana · Lunes, 07:00", "Envío eliminado",
      ]);
    });

    it("is called by its number, and not declared deleted, while the list could not be loaded", async () => {
      const user = userEvent.setup();
      await elegirYVolverALista(user, () => listarProgramaciones.mockRejectedValue(new Error("x")));

      expect(await screen.findByRole("combobox", { name: "Envío" })).toHaveTextContent("Envío #9");
      expect(screen.getByRole("combobox", { name: "Envío" })).not.toHaveTextContent("eliminado");
    });
  });

  describe("after a request failed", () => {
    it("keeps the filters in reach, and changing one asks again", async () => {
      listarHistorial.mockRejectedValueOnce(new Error("x"));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el historial de envíos");

      listarHistorial.mockResolvedValueOnce(sobre([corrida({ id: 1 })]));
      await elegir(user, "Resultado", "Enviado");

      expect(await screen.findByText("estado:enviado")).toBeInTheDocument();
      expect(ultimaConsulta()).toEqual({ page: 1, limit: 15, estado: "enviado" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not show the rows of the filter before as if they were the answer to the new one", async () => {
      listarHistorial.mockResolvedValueOnce(sobre([corrida({ id: 1 }, { informe: { id: 3, name: "Fila vieja" } })]));
      const user = userEvent.setup();
      await abrirElHistorial(user);
      await screen.findByText("Fila vieja");

      listarHistorial.mockRejectedValueOnce(new Error("x"));
      await elegir(user, "Resultado", "Falló");

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText("Fila vieja")).not.toBeInTheDocument();
    });
  });
});

// ─── Who each run was sent to ────────────────────────────────────────────────

const entrega = (over: Partial<EntregaDeEjecucion> = {}): EntregaDeEjecucion => ({
  id: 1, tipo: "usuario", nombre: "Beto Mamani", resultado: "entregado", ...over,
});
const sobreDeEntregas = (data: EntregaDeEjecucion[]) => ({ data, total: data.length, page: 1, limit: 50 });
const BOTON = { name: "Ver destinatarios de este envío" };

describe("the recipients of a run, in the Entregados column", () => {
  beforeEach(() => {
    listarDestinatariosDeEjecucion.mockResolvedValue(sobreDeEntregas([]));
  });

  it("is a button only for a run that has recipients recorded, and says so plainly for one that has not", async () => {
    listarHistorial.mockResolvedValue(sobre([
      corrida({ id: 1, con_destinatarios: true }),
      corrida({ id: 2, con_destinatarios: false }),
      corrida({ id: 3, con_destinatarios: true, estado: "omitido", enviados: 0, no_enviados: 0 }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findAllByText("estado:enviado");
    const filas = screen.getAllByRole("row").slice(1);

    expect(within(filas[0]).getByRole("button", BOTON)).toHaveTextContent("2 de 2");
    // An old run: the figure stays text, and the reason there is no list is said under it.
    expect(within(filas[1]).queryByRole("button", BOTON)).not.toBeInTheDocument();
    expect(within(filas[1]).getByText("2 de 2")).toBeInTheDocument();
    expect(within(filas[1]).getByText("No se registró a quién")).toBeInTheDocument();
    // A skipped run tried nobody: a dash, whatever was recorded.
    expect(within(filas[2]).queryByRole("button", BOTON)).not.toBeInTheDocument();
    expect(within(filas[2]).getByText("—")).toBeInTheDocument();
    expect(within(filas[2]).queryByText("No se registró a quién")).not.toBeInTheDocument();
  });

  it("does not say nobody was recorded for a run that tried nobody: one that failed before sending, or is still building", async () => {
    listarHistorial.mockResolvedValue(sobre([
      corrida({ id: 1, estado: "fallido", enviados: 0, no_enviados: 0, con_destinatarios: false }),
      corrida({ id: 2, estado: "en_curso", enviados: 0, no_enviados: 0, con_destinatarios: false }),
      // The sentence is still true of an old run that did try somebody.
      corrida({ id: 3, estado: "fallido", enviados: 0, no_enviados: 3, con_destinatarios: false }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("estado:en_curso");
    const filas = screen.getAllByRole("row").slice(1);

    expect(within(filas[0]).getByText("0 de 0")).toBeInTheDocument();
    expect(within(filas[0]).queryByText("No se registró a quién")).not.toBeInTheDocument();
    expect(within(filas[1]).getByText("0 de 0")).toBeInTheDocument();
    expect(within(filas[1]).queryByText("No se registró a quién")).not.toBeInTheDocument();
    expect(within(filas[2]).getByText("No se registró a quién")).toBeInTheDocument();
  });

  it("asks once when it is opened, and lists every kind of result as a word", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 41, con_destinatarios: true })]));
    listarDestinatariosDeEjecucion.mockResolvedValue(sobreDeEntregas([
      entrega({ id: 1, nombre: "Ana Pérez", resultado: "entregado" }),
      entrega({ id: 2, nombre: "Beto Mamani", resultado: "rechazado" }),
      entrega({ id: 3, nombre: "Carla Rojas", resultado: "no_enviado" }),
      entrega({ id: 4, nombre: "Diego Vaca", resultado: "sin_cupo" }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    expect(listarDestinatariosDeEjecucion).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", BOTON));
    const lista = await screen.findByRole("dialog", { name: "Destinatarios de este envío" });

    expect(listarDestinatariosDeEjecucion).toHaveBeenCalledTimes(1);
    expect(listarDestinatariosDeEjecucion).toHaveBeenCalledWith(41);
    const lineas = within(lista).getAllByRole("listitem").map((l) => l.textContent);
    expect(lineas).toEqual(["Ana PérezEntregado", "Beto MamaniRechazado", "Carla RojasNo enviado", "Diego VacaSin cupo"]);

    // Closing and opening again is not another request.
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", BOTON));
    await screen.findByRole("dialog", { name: "Destinatarios de este envío" });
    expect(listarDestinatariosDeEjecucion).toHaveBeenCalledTimes(1);
  });

  it("shows an outside address as itself, marked, and an account by its name and nothing else", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 41, con_destinatarios: true })]));
    listarDestinatariosDeEjecucion.mockResolvedValue(sobreDeEntregas([
      entrega({ id: 1, nombre: "Beto Mamani" }),
      entrega({ id: 2, tipo: "externo", nombre: "cliente@fuera.com" }),
    ]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await user.click(await screen.findByRole("button", BOTON));
    const lista = await screen.findByRole("dialog", { name: "Destinatarios de este envío" });
    const [cuenta, externo] = within(lista).getAllByRole("listitem");

    expect(within(cuenta).getByText("Beto Mamani")).toBeInTheDocument();
    expect(cuenta.textContent).not.toMatch(/@|externo/);
    expect(within(externo).getByText("cliente@fuera.com")).toBeInTheDocument();
    expect(within(externo).getByText("externo")).toBeInTheDocument();
  });

  it("does not also open the schedule: the click belongs to the button, not to the row", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 41, con_destinatarios: true })]));
    listarDestinatariosDeEjecucion.mockResolvedValue(sobreDeEntregas([entrega()]));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await user.click(await screen.findByRole("button", BOTON));
    const lista = await screen.findByRole("dialog", { name: "Destinatarios de este envío" });
    // Nor does clicking inside the list, which React delivers through the portal to the row.
    await user.click(within(lista).getByText("Beto Mamani"));

    expect(screen.queryByRole("dialog", { name: "formulario de envío" })).not.toBeInTheDocument();
  });

  it("asks again every time a run still going is opened, since it is still writing", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 41, estado: "en_curso", con_destinatarios: true })]));
    listarDestinatariosDeEjecucion.mockResolvedValue(sobreDeEntregas([entrega()]));
    const user = userEvent.setup();
    await abrirElHistorial(user);

    await user.click(await screen.findByRole("button", BOTON));
    await screen.findByText("Beto Mamani");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", BOTON));
    await waitFor(() => expect(listarDestinatariosDeEjecucion).toHaveBeenCalledTimes(2));
  });

  it("does not keep a list loaded while the run was going once the run is over: it shows who the finished run reached", async () => {
    listarHistorial
      .mockResolvedValueOnce(sobre([corrida({ id: 41, estado: "en_curso", enviados: 2, no_enviados: 0, con_destinatarios: true })]))
      .mockResolvedValueOnce(sobre([corrida({ id: 41, estado: "enviado", enviados: 5, no_enviados: 0, con_destinatarios: true })]));
    const nombres = ["Ana", "Beto", "Carla", "Diego", "Elena"];
    listarDestinatariosDeEjecucion
      .mockResolvedValueOnce(sobreDeEntregas(nombres.slice(0, 2).map((nombre, i) => entrega({ id: i + 1, nombre }))))
      .mockResolvedValueOnce(sobreDeEntregas(nombres.map((nombre, i) => entrega({ id: i + 1, nombre }))));
    const user = userEvent.setup();
    await abrirElHistorial(user);

    await user.click(await screen.findByRole("button", BOTON));
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    await user.keyboard("{Escape}");

    // The run finishes; the history is read again and the row stays where it was.
    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    await waitFor(() => expect(screen.getByRole("button", BOTON)).toHaveTextContent("5 de 5"));
    await user.click(screen.getByRole("button", BOTON));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(5));
    expect(listarDestinatariosDeEjecucion).toHaveBeenCalledTimes(2);
  });

  it("says while it loads, and when it fails offers a retry that loads", async () => {
    listarHistorial.mockResolvedValue(sobre([corrida({ id: 41, con_destinatarios: true })]));
    const espera = diferida<ReturnType<typeof sobreDeEntregas>>();
    listarDestinatariosDeEjecucion.mockReturnValueOnce(espera.promesa);
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await user.click(await screen.findByRole("button", BOTON));
    const lista = await screen.findByRole("dialog", { name: "Destinatarios de este envío" });
    expect(within(lista).getByText("Cargando…")).toBeInTheDocument();

    await act(async () => { espera.rechazar(new Error("x")); await espera.promesa.catch(() => undefined); });
    expect(await within(lista).findByText("No se pudieron cargar los destinatarios.")).toBeInTheDocument();

    listarDestinatariosDeEjecucion.mockResolvedValueOnce(sobreDeEntregas([entrega({ nombre: "Ana Pérez" })]));
    await user.click(within(lista).getByRole("button", { name: "Reintentar" }));

    expect(await within(lista).findByText("Ana Pérez")).toBeInTheDocument();
    expect(listarDestinatariosDeEjecucion).toHaveBeenCalledTimes(2);
  });

  it("does not show a late answer for one run in the list of another", async () => {
    listarHistorial.mockResolvedValue(sobre([
      corrida({ id: 41, con_destinatarios: true }, { informe: { id: 3, name: "Primer informe" } }),
      corrida({ id: 42, con_destinatarios: true }, { informe: { id: 3, name: "Segundo informe" } }),
    ]));
    const tarde = diferida<ReturnType<typeof sobreDeEntregas>>();
    listarDestinatariosDeEjecucion.mockImplementation((id: number) =>
      id === 41 ? tarde.promesa : Promise.resolve(sobreDeEntregas([entrega({ nombre: "Del segundo" })])));
    const user = userEvent.setup();
    await abrirElHistorial(user);
    await screen.findByText("Segundo informe");

    // The first run is opened and left waiting; the second is opened and answers.
    await user.click(within(screen.getAllByRole("row")[1]).getByRole("button", BOTON));
    await user.keyboard("{Escape}");
    await user.click(within(screen.getAllByRole("row")[2]).getByRole("button", BOTON));
    const lista = await screen.findByRole("dialog", { name: "Destinatarios de este envío" });
    expect(await within(lista).findByText("Del segundo")).toBeInTheDocument();

    tarde.resolver(sobreDeEntregas([entrega({ nombre: "Del primero" })]));
    await act(async () => { await tarde.promesa; });

    expect(within(lista).getByText("Del segundo")).toBeInTheDocument();
    expect(screen.queryByText("Del primero")).not.toBeInTheDocument();
  });
});
