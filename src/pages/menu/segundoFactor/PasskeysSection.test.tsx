// Llaves de acceso — plan 4C, Tarea 11. Lo que la sección hace con la lista,
// con el alta (un solo campo, el nombre; ceremonia detrás de un mock) y
// con la baja — sobre todo con la baja de la última llave, que cierra la sesión
// de este mismo navegador. Desde el 2026-10-10 ninguna de las dos pide la
// contraseña: si hay que probar algo lo pide la ventana global del step-up.

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
const cancelarCeremonia = vi.fn();
vi.mock("../../../api/passkeyCeremony", () => ({
  registrarPasskey: (...a: unknown[]) => registrarPasskey(...a),
  soportaPasskeys: () => soporta,
  cancelarCeremonia: (...a: unknown[]) => cancelarCeremonia(...a),
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

function montar(usuario = usuarioExample) {
  const valor = {
    sesion: { autenticado: true, usuario, permisos: sinPermisos(), estado: "completa" },
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

describe("al irse", () => {
  // La cuarta pantalla de llave, y la única que puede dejar de verdad un
  // diálogo del sistema huérfano en producción: la sesión caduca a mitad del
  // registro, el 401 saca a la persona al login, y el diálogo se queda encima.
  it("cancela una ceremonia aún abierta al desmontar, y no antes", () => {
    cancelarCeremonia.mockClear();
    const { unmount } = montar();
    expect(cancelarCeremonia).not.toHaveBeenCalled();
    unmount();
    expect(cancelarCeremonia).toHaveBeenCalledTimes(1);
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
  const rellenarYCrear = async (nombre = "mi móvil") => {
    await userEvent.click(await screen.findByRole("button", { name: /añadir llave/i }));
    await userEvent.type(screen.getByLabelText(/nombre de la llave/i), nombre);
    await userEvent.click(screen.getByRole("button", { name: /crear la llave/i }));
  };

  // 🔴 El nombre es lo único que viaja: ni contraseña ni nada parecido. Si
  // la puerta pide probar la identidad, la ventana global se mete en medio de
  // la ceremonia (ver `registrarPasskey`); el formulario no pregunta nada.
  it("manda a la ceremonia solo el nombre, sin contraseña de ningún tipo", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /añadir llave/i }));
    // Ni el diálogo del alta tiene un campo de contraseña: el único es el nombre.
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/nombre de la llave/i), "mi móvil");
    await userEvent.click(screen.getByRole("button", { name: /crear la llave/i }));

    await waitFor(() => expect(registrarPasskey).toHaveBeenCalledTimes(1));
    // Los argumentos exactos: un segundo argumento, aunque fuera `undefined`,
    // haría fallar la comparación de la lista.
    expect(registrarPasskey.mock.calls[0]).toEqual(["mi móvil"]);
  });

  it("abre el diálogo con el nombre ya puesto desde el navegador, y editable", async () => {
    const agente = vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    );
    try {
      montar();
      await userEvent.click(await screen.findByRole("button", { name: /añadir llave/i }));

      const nombre = screen.getByLabelText(/nombre de la llave/i);
      expect(nombre).toHaveValue("Chrome en Windows");
      await userEvent.clear(nombre);
      await userEvent.type(nombre, "el del trabajo");
      await userEvent.click(screen.getByRole("button", { name: /crear la llave/i }));

      await waitFor(() => expect(registrarPasskey).toHaveBeenCalledWith("el del trabajo"));
    } finally {
      agente.mockRestore();
    }
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
    expect(screen.queryByRole("button", { name: /añadir llave/i })).not.toBeInTheDocument();
  });
});

describe("quitar", () => {
  const quitarMovil = async () => {
    await userEvent.click(await screen.findByRole("button", { name: /quitar la llave mi móvil/i }));
    await userEvent.click(await screen.findByRole("button", { name: /sí, quitar/i }));
  };

  // Plan 4E: con correo verificado, la última llave no deja la cuenta sin
  // factor ni cierra las sesiones, y la frase de siempre sería falsa.
  it("con correo verificado, avisa de que el correo sigue siendo el factor y de que las sesiones no se cierran", async () => {
    montar({ ...usuarioExample, email: "isaias@osefi.net", email_verified_at: "2026-09-01T00:00:00.000Z" });
    await userEvent.click(await screen.findByRole("button", { name: /quitar la llave mi móvil/i }));

    expect(await screen.findByText(/tu correo verificado sigue siendo tu segundo factor/i)).toBeInTheDocument();
    expect(screen.queryByText(/entrarás sólo con tu contraseña/i)).not.toBeInTheDocument();
  });

  it("sin correo verificado, avisa de que volverá a la contraseña sola y de que las sesiones se cierran", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /quitar la llave mi móvil/i }));

    expect(await screen.findByText(/entrarás sólo con tu contraseña/i)).toBeInTheDocument();
    expect(screen.getByText(/se cerrarán todas tus sesiones/i)).toBeInTheDocument();
  });

  it("«Quitar» abre la confirmación con el nombre de la llave, sin pedir contraseña antes", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /quitar la llave mi móvil/i }));

    expect(await screen.findByText("¿Quitar la llave «mi móvil»?")).toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(deleteCredential).not.toHaveBeenCalled();
  });

  it("manda solo el id de esa llave, sin contraseña", async () => {
    montar();
    await quitarMovil();

    await waitFor(() => expect(deleteCredential).toHaveBeenCalledTimes(1));
    expect(deleteCredential.mock.calls[0]).toEqual([7]);
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

  // La ventana global ya se ocupó de lo que se pudo: lo que llega aquí es una
  // negativa que nadie resolvió (cerró la ventana, por ejemplo), y como ya no
  // hay formulario debajo del que colgarla, va en un toast con la frase de la
  // puerta.
  it("una negativa del step-up al quitar sale en un toast con la frase de la puerta", async () => {
    deleteCredential.mockResolvedValue({
      status: 403,
      message: "x",
      code: "STEP_UP_REQUIRED",
      motivo: "contraseña-incorrecta",
      sesionCerrada: false,
    });
    montar();
    await quitarMovil();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/esa contraseña no es correcta/i)),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un fallo cualquiera del servidor al quitar sale en un toast con su mensaje", async () => {
    deleteCredential.mockResolvedValue({ status: 500, message: "Se rompió algo.", sesionCerrada: false });
    montar();
    await quitarMovil();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Se rompió algo."));
  });
});
