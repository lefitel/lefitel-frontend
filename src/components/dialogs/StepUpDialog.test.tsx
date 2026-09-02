// La ventana del step-up: qué pide según lo que falte, a qué puerta canjea el
// código, y qué pasa cuando alguien se equivoca o cancela.
//
// Se ejercita a través del puente real (`registrarResolvedorStepUp`), que es
// como la alcanza el interceptor en producción: montar el componente, pedirle
// una resolución, y comprobar qué aparece en pantalla y con qué se resuelve la
// promesa.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepUpDialog } from "./StepUpDialog";
import { SesionContext, type contextProps } from "@/context/SesionContext";
import { usuarioExample } from "@/data/example";
import { sinPermisos } from "@/lib/permissions";
import type { EstadoSesion } from "@/interfaces/interfaces";
import * as interceptor from "@/api/stepUpInterceptor";
import type { PeticionStepUp, ResultadoStepUp } from "@/api/stepUpInterceptor";

const probarStepUp = vi.fn();
const verifySecondFactor = vi.fn();
vi.mock("@/api/Mfa.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/Mfa.api")>()),
  probarStepUp: (...a: unknown[]) => probarStepUp(...a),
}));
vi.mock("@/api/Login.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/Login.api")>()),
  verifySecondFactor: (...a: unknown[]) => verifySecondFactor(...a),
}));

/** El resolvedor que el componente registró al montarse. */
let pedir: (p: PeticionStepUp) => Promise<ResultadoStepUp | null>;

function montar(estado: EstadoSesion = "completa") {
  const valor = {
    sesion: { autenticado: true, usuario: usuarioExample, permisos: sinPermisos(), estado },
    setSesion: vi.fn(),
    loading: false,
    logout: vi.fn(),
  } as unknown as contextProps;

  const registrar = vi
    .spyOn(interceptor, "registrarResolvedorStepUp")
    .mockImplementation((fn) => {
      if (fn) pedir = fn;
    });

  render(
    <SesionContext.Provider value={valor}>
      <StepUpDialog />
    </SesionContext.Provider>,
  );
  return registrar;
}

const PIDE_PASSWORD: PeticionStepUp = {
  motivo: "contraseña-requerida",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

const PIDE_FACTOR: PeticionStepUp = {
  motivo: "sin-factor-reciente",
  exigeContrasena: false,
  mensaje: null,
  signal: new AbortController().signal,
};

beforeEach(() => {
  probarStepUp.mockReset().mockResolvedValue({ status: 200, message: "Identidad confirmada." });
  verifySecondFactor.mockReset().mockResolvedValue({ status: 200, message: "ok" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("qué pide", () => {
  it("no pinta nada mientras nadie pida nada", () => {
    montar();
    expect(screen.queryByText("Confirma que eres tú")).not.toBeInTheDocument();
  });

  it("sólo la contraseña cuando eso es lo que falta", async () => {
    montar();
    void pedir(PIDE_PASSWORD);

    await screen.findByText("Confirma que eres tú");
    expect(screen.getByLabelText("Tu contraseña")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de tu aplicación")).not.toBeInTheDocument();
  });

  it("sólo el código cuando la ruta no quiere la contraseña", async () => {
    montar();
    void pedir(PIDE_FACTOR);

    await screen.findByLabelText("Código de tu aplicación");
    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
  });

  // 🔴 La decisión de Isaias, y el motivo de que el servidor avise por
  // adelantado: una sola ventana, no dos seguidas.
  it("las DOS cosas a la vez cuando el servidor avisa de que hará falta la contraseña", async () => {
    montar();
    void pedir({ ...PIDE_FACTOR, exigeContrasena: true });

    await screen.findByLabelText("Código de tu aplicación");
    // Sin este aviso el servidor nombra una carencia por respuesta, y la
    // ceremonia serían dos ventanas encadenadas justo en las operaciones más
    // delicadas: restablecer el factor de otra persona, desbloquear su cuenta.
    expect(screen.getByLabelText("Tu contraseña")).toBeInTheDocument();
  });
});

describe("a qué puerta canjea el código", () => {
  // 🔴 Elegir mal no da un error útil: carga un intento fallido contra el
  // bloqueo de la cuenta, con el código correcto tecleado.
  it("una sesión completa va a /auth/stepup", async () => {
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(probarStepUp).toHaveBeenCalledWith("123456"));
    expect(verifySecondFactor).not.toHaveBeenCalled();
  });

  it("una sesión a medias va a /auth/mfa/verify, que es la que la levanta", async () => {
    montar("onboarding");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(verifySecondFactor).toHaveBeenCalledWith("123456"));
    expect(probarStepUp).not.toHaveBeenCalled();
  });
});

describe("cómo termina", () => {
  it("resuelve con la contraseña para que el interceptor la reenvíe", async () => {
    montar();
    const promesa = pedir(PIDE_PASSWORD);

    await userEvent.type(await screen.findByLabelText("Tu contraseña"), "la-mia");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await expect(promesa).resolves.toEqual({ password: "la-mia" });
  });

  it("cancelar resuelve con null, que no es un error del servidor", async () => {
    montar();
    const promesa = pedir(PIDE_PASSWORD);

    await screen.findByText("Confirma que eres tú");
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await expect(promesa).resolves.toBeNull();
  });

  it("un código erróneo deja la ventana abierta con el error a la vista", async () => {
    // Si se cerrara, la persona perdería lo tecleado y no sabría por qué falló:
    // `AlertDialogAction` cierra el diálogo por defecto, y aquí no puede.
    probarStepUp.mockResolvedValue({
      status: 400,
      message: "Código incorrecto o ya utilizado.",
      intentosRestantes: 2,
    });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText("Código incorrecto o ya utilizado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de tu aplicación")).toBeInTheDocument();
  });
});

describe("el aviso antes del bloqueo", () => {
  // 🔴 Cinco fallos bloquean la cuenta entera del ERP —1, 2, 4, 8, hasta 15
  // minutos— y el mensaje de error es idéntico al de un código simplemente mal
  // escrito. Basta con que el reloj del móvil vaya desfasado.
  it("dice cuántos intentos quedan", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 3 });

    expect(await screen.findByText(/quedan 3 intentos/i)).toBeInTheDocument();
  });

  it("habla en singular cuando queda uno", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 1 });

    expect(await screen.findByText(/queda 1 intento/i)).toBeInTheDocument();
  });

  // 🔴 Son DOS contadores distintos con el mismo nombre, y confundirlos pone
  // una frase falsa en pantalla.
  it("con la contraseña dice que hay que esperar, y que la cuenta NO está bloqueada", async () => {
    // El cupo de la contraseña es un límite de ritmo: cinco fallos dan un 429
    // y quince minutos de espera. `verifyOwnPassword` **no** toca el contador
    // de bloqueo, a propósito. Decirle a alguien que su cuenta se ha bloqueado
    // le manda a pedir a un administrador algo que no arreglaría nada.
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 0 });

    expect(await screen.findByText(/no está bloqueada/i)).toBeInTheDocument();
    expect(screen.queryByText(/bloqueada temporalmente/i)).not.toBeInTheDocument();
  });

  it("con el código sí dice que la cuenta se bloqueó, porque es verdad", async () => {
    probarStepUp.mockResolvedValue({ status: 400, message: "no", intentosRestantes: 0 });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/bloqueada temporalmente/i)).toBeInTheDocument();
  });

  it("y avisa de lo que toca en cada caso mientras aún quedan intentos", async () => {
    montar();
    void pedir({ ...PIDE_PASSWORD, intentosRestantes: 2 });

    expect(await screen.findByText(/antes de tener que esperar unos minutos/i)).toBeInTheDocument();
    expect(screen.queryByText(/antes de que la cuenta se bloquee/i)).not.toBeInTheDocument();
  });

  it("se actualiza con lo que dice el canje, no sólo con lo que traía el rechazo", async () => {
    probarStepUp.mockResolvedValue({ status: 400, message: "no", intentosRestantes: 1 });
    montar("completa");
    void pedir(PIDE_FACTOR);

    await userEvent.type(await screen.findByLabelText("Código de tu aplicación"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/queda 1 intento/i)).toBeInTheDocument();
  });
});
