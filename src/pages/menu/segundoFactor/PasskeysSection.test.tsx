// Llaves de acceso — plan 4C, Tarea 11. Lo que la sección hace con la lista,
// con el alta (contraseña en las dos peticiones, ceremonia detrás de un mock) y
// con la baja — sobre todo con la baja de la última llave, que cierra la sesión
// de este mismo navegador.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import PasskeysSection from "./PasskeysSection";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import { sinPermisos } from "../../../lib/permissions";

const listCredentials = vi.fn();
const deleteCredential = vi.fn();
vi.mock("../../../api/Webauthn.api", () => ({
  listCredentials: (...a: unknown[]) => listCredentials(...a),
  deleteCredential: (...a: unknown[]) => deleteCredential(...a),
}));

// `jsdom` no tiene WebAuthn: la ceremonia entera va detrás de un mock, y el
// soporte se fuerza a `true` salvo en la prueba que lo apaga a propósito.
const registrarPasskey = vi.fn();
let soporta = true;
vi.mock("../../../api/passkeyCeremony", () => ({
  registrarPasskey: (...a: unknown[]) => registrarPasskey(...a),
  soportaPasskeys: () => soporta,
}));

const comprobarToken = vi.fn();
vi.mock("../../../api/Login.api", () => ({
  comprobarToken: (...a: unknown[]) => comprobarToken(...a),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const setSesion = vi.fn();
const logout = vi.fn();

function montar() {
  const valor = {
    sesion: { autenticado: true, usuario: usuarioExample, permisos: sinPermisos(), estado: "completa" },
    setSesion,
    loading: false,
    logout,
  } as unknown as contextProps;
  return render(
    <SesionContext.Provider value={valor}>
      <PasskeysSection />
    </SesionContext.Provider>,
  );
}

const MOVIL = {
  id: 7,
  nombre: "mi móvil",
  created_at: "2026-08-01T10:00:00.000Z",
  last_used_at: null,
  transports: "internal",
};
const PORTATIL = {
  id: 8,
  nombre: "el portátil",
  created_at: "2026-08-15T10:00:00.000Z",
  last_used_at: "2026-09-01T09:30:00.000Z",
  transports: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  soporta = true;
  listCredentials.mockResolvedValue({ status: 200, credenciales: [MOVIL, PORTATIL] });
  deleteCredential.mockResolvedValue({ status: 200, message: "Llave eliminada.", sesionCerrada: false });
  registrarPasskey.mockResolvedValue({ ok: true, codigos: null });
  comprobarToken.mockResolvedValue({
    status: 200,
    usuario: usuarioExample,
    permisos: sinPermisos(),
    estado: "completa",
  });
});

describe("la lista", () => {
  it("enseña cada llave con su nombre y sus fechas", async () => {
    montar();

    expect(await screen.findByText("mi móvil")).toBeInTheDocument();
    expect(screen.getByText("el portátil")).toBeInTheDocument();
    // Las fechas son lo único que separa dos llaves con el mismo nombre.
    expect(screen.getByText(/último uso: nunca/i)).toBeInTheDocument();
    expect(screen.getByText(/último uso: 1 sept/i)).toBeInTheDocument();
  });

  it("dice que no hay ninguna cuando no hay ninguna, y no lo confunde con un fallo", async () => {
    listCredentials.mockResolvedValue({ status: 200, credenciales: [] });
    montar();

    expect(await screen.findByText(/no tienes ninguna llave/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument();
  });

  it("no lee una petición que no volvió como «no tienes llaves»", async () => {
    listCredentials.mockResolvedValue({ status: 500, credenciales: null });
    montar();

    expect(await screen.findByText(/no se pudo cargar/i)).toBeInTheDocument();
    expect(screen.queryByText(/no tienes ninguna llave/i)).not.toBeInTheDocument();
  });
});

describe("registrar", () => {
  const rellenarYCrear = async (nombre = "mi móvil", password = "la-mia") => {
    await userEvent.click(await screen.findByRole("button", { name: /registrar una llave/i }));
    await userEvent.type(screen.getByLabelText(/nombre de la llave/i), nombre);
    await userEvent.type(screen.getByLabelText(/contraseña actual/i), password);
    await userEvent.click(screen.getByRole("button", { name: /crear la llave/i }));
  };

  // 🔴 La contraseña viaja con el nombre en una sola llamada, que la mete en
  // las dos peticiones: dejar que la ventana global la pidiera serían tres
  // avisos para un gesto, y el reto caduca a los dos minutos.
  it("manda el nombre y la contraseña a la ceremonia", async () => {
    montar();
    await rellenarYCrear();

    expect(registrarPasskey).toHaveBeenCalledWith("mi móvil", "la-mia");
  });

  it("al terminar, vuelve a pedir la lista y vuelve a leer la sesión", async () => {
    montar();
    await screen.findByText("mi móvil");
    listCredentials.mockClear();
    await rellenarYCrear();

    await waitFor(() => expect(listCredentials).toHaveBeenCalled());
    // El servidor acaba de promover la sesión; sin esto la pantalla sigue
    // creyendo `onboarding` y «Inicio» devuelve aquí (hallazgo E-3/F12).
    expect(comprobarToken).toHaveBeenCalled();
    expect(setSesion).toHaveBeenCalledWith(expect.objectContaining({ estado: "completa" }));
  });

  it("enseña los diez códigos cuando esta llave es el primer factor", async () => {
    registrarPasskey.mockResolvedValue({ ok: true, codigos: ["ABCDEFGH", "IJKLMNOP"] });
    montar();
    await rellenarYCrear();

    // Formateados en grupos de cuatro, como los enseña el diálogo.
    expect(await screen.findByText("ABCD-EFGH")).toBeInTheDocument();
  });

  // Cerró el diálogo del sistema. No es un error: el formulario se queda
  // como estaba, para repetir sin volver a teclear.
  it("si cancela el diálogo del sistema, no dice nada y conserva lo tecleado", async () => {
    registrarPasskey.mockResolvedValue({ ok: false, cancelado: true });
    montar();
    await rellenarYCrear();

    expect(screen.getByLabelText(/nombre de la llave/i)).toHaveValue("mi móvil");
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument();
  });

  it("dice con su propia frase cuando el dispositivo ya tenía una llave de esta cuenta", async () => {
    registrarPasskey.mockResolvedValue({
      ok: false,
      cancelado: false,
      status: 0,
      message: "Este dispositivo ya tiene una llave registrada para tu cuenta.",
      yaRegistrada: true,
    });
    montar();
    await rellenarYCrear();

    expect(await screen.findByText(/ya tiene una llave registrada/i)).toBeInTheDocument();
  });

  it("no ofrece registrar en un navegador que no puede, y sigue enseñando la lista", async () => {
    soporta = false;
    montar();

    expect(await screen.findByText("mi móvil")).toBeInTheDocument();
    expect(screen.getByText(/este navegador no puede crear llaves/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registrar una llave/i })).not.toBeInTheDocument();
  });
});

describe("quitar", () => {
  const quitarMovil = async (password = "la-mia") => {
    await userEvent.click(await screen.findByRole("button", { name: /quitar la llave mi móvil/i }));
    await userEvent.type(screen.getByLabelText(/contraseña actual/i), password);
    await userEvent.click(screen.getByRole("button", { name: /^quitar llave$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /sí, quitar/i }));
  };

  it("manda el id de esa llave y la contraseña", async () => {
    montar();
    await quitarMovil();

    await waitFor(() => expect(deleteCredential).toHaveBeenCalledWith(7, "la-mia"));
  });

  it("con otra llave restante, avisa y vuelve a pedir la lista", async () => {
    montar();
    await screen.findByText("mi móvil");
    listCredentials.mockClear();
    await quitarMovil();

    await waitFor(() => expect(listCredentials).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  // 🔴 Era la última: el servidor cerró todas las sesiones, ésta incluida. La
  // siguiente petición es el 401 que saca al login, así que pedir la lista
  // ahora pondría un segundo aviso contradictorio encima del primero — y el
  // mensaje va en un toast largo, que es lo único que sobrevive a esa
  // navegación.
  it("con la última, enseña el aviso en un toast largo y NO vuelve a pedir la lista", async () => {
    deleteCredential.mockResolvedValue({
      status: 200,
      message: "Llave eliminada. Era tu último factor: se han cerrado todas tus sesiones.",
      sesionCerrada: true,
    });
    montar();
    await screen.findByText("mi móvil");
    listCredentials.mockClear();
    await quitarMovil();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("se han cerrado todas tus sesiones"),
        expect.objectContaining({ duration: expect.any(Number) }),
      ),
    );
    expect(listCredentials).not.toHaveBeenCalled();
    // 🔴 Y se va al login ahora: nada más saca a la persona de una pantalla
    // entera con una sesión muerta — no hay sondeo, y el temporizador de
    // caducidad apunta a la fecha original.
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("con otra llave restante, no cierra nada", async () => {
    montar();
    await quitarMovil();

    await waitFor(() => expect(deleteCredential).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
  });

  it("distingue por `code` el 500 que dice que las sesiones no se cerraron", async () => {
    deleteCredential.mockResolvedValue({
      status: 500,
      message: "La llave se eliminó, pero no se pudieron cerrar tus sesiones.",
      code: "REVOCACION_FALLIDA",
      sesionCerrada: false,
    });
    montar();
    await quitarMovil();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("no se pudieron cerrar"),
        expect.anything(),
      ),
    );
  });

  it("una llave que ya no existe es noticia, no un error rojo", async () => {
    deleteCredential.mockResolvedValue({ status: 404, message: "Esa llave no existe.", sesionCerrada: false });
    montar();
    await quitarMovil();

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("una contraseña equivocada deja el error junto al campo, con la frase de la puerta", async () => {
    deleteCredential.mockResolvedValue({
      status: 403,
      message: "x",
      code: "STEP_UP_REQUIRED",
      motivo: "contraseña-incorrecta",
      sesionCerrada: false,
    });
    montar();
    await quitarMovil("no-es");

    expect(await screen.findByText(/esa contraseña no es correcta/i)).toBeInTheDocument();
  });
});
