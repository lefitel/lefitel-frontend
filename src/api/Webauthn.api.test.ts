// Las dos llamadas anónimas del login sin contraseña — plan 4C, fase 2 — y lo
// que hacen con la respuesta. Las de la fase 1 se afirman desde
// `passkeyCeremony.test.ts` y desde las pantallas; éstas tienen una forma de
// vuelta que es la de `loginUsuario`, y una diferencia deliberada con ella
// (el estado real), y las dos cosas merecen quedar fijadas.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import {
  MENSAJE_CANJE_SIN_RESPUESTA,
  passwordlessOptions,
  passwordlessVerify,
  TIMEOUT_CANJE_MS,
} from "./Webauthn.api";
import { urlApi } from "./url";

const ASERCION = { id: "cred", rawId: "cred", type: "public-key", response: {} } as never;
const USUARIO = { id: 7, id_rol: 2, user: "ada", name: "Ada", lastname: "L", image: null };

afterEach(() => vi.restoreAllMocks());

describe("passwordlessOptions", () => {
  it("pide el reto a la ruta anónima, con un cuerpo vacío y un tiempo máximo", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { challenge: "reto" } });

    const r = await passwordlessOptions();

    expect(post).toHaveBeenCalledWith(
      `${urlApi}auth/webauthn/passwordless/options`,
      {},
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(r).toEqual({ status: 200, message: null, opciones: { challenge: "reto" } });
  });

  it("devuelve la frase del servidor y su estado cuando lo rechaza", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({
      response: { status: 429, data: { message: "Demasiados intentos con la llave desde esta red." } },
    });

    const r = await passwordlessOptions();

    expect(r).toMatchObject({ status: 429, message: "Demasiados intentos con la llave desde esta red.", opciones: null });
  });
});

describe("passwordlessVerify", () => {
  it("canjea la aserción en la ruta anónima, con un tope de un minuto y no de veinte segundos", async () => {
    // El servidor abre la sesión y pone la cookie antes de contestar, así que
    // el tope de las ceremonias con sesión dejaría a la persona dentro leyendo
    // «no se pudo conectar»; pero sin tope, un enlace colgado deja las dos
    // puertas del login deshabilitadas durante minutos.
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { usuario: USUARIO, permisos: { poste: { ver: true } }, message: "Login exitoso" },
    });

    await passwordlessVerify(ASERCION);

    expect(post).toHaveBeenCalledWith(
      `${urlApi}auth/webauthn/passwordless/verify`,
      { respuesta: ASERCION },
      { timeout: TIMEOUT_CANJE_MS },
    );
    expect(TIMEOUT_CANJE_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("dice lo que puede haber pasado cuando el canje se corta por tiempo", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));

    const r = await passwordlessVerify(ASERCION);

    expect(r).toEqual({ status: 500, message: MENSAJE_CANJE_SIN_RESPUESTA, usuario: null });
  });

  it("no inventa una persona cuando el 200 no la trae", async () => {
    // Un proxy que contesta 200 con otro cuerpo: la pantalla no debe abrir una
    // sesión con `usuario: {}` que la mande a «sin acceso» sin explicación.
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { permisos: {}, message: "ok" } });

    const r = await passwordlessVerify(ASERCION);

    expect(r).toEqual({ status: 200, message: "ok", usuario: null });
  });

  it("devuelve la misma forma que loginUsuario: la persona bajo `usuario`, la matriz al lado, autenticado en falso", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { usuario: USUARIO, permisos: { poste: { ver: true } }, message: "Login exitoso" },
    });

    const r = await passwordlessVerify(ASERCION);

    expect(r).toEqual({
      status: 200,
      message: "Login exitoso",
      usuario: { usuario: USUARIO, permisos: { poste: { ver: true } }, autenticado: false },
    });
  });

  it("quita un `token` que viniera dentro de la persona, como hace loginUsuario", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { usuario: { ...USUARIO, token: "jwt-que-no-debe-existir" }, permisos: {}, message: "ok" },
    });

    const r = await passwordlessVerify(ASERCION);

    expect(r.usuario?.usuario).not.toHaveProperty("token");
    expect(r.usuario?.usuario).toEqual(USUARIO);
  });

  it("conserva el estado real y la frase del servidor en un rechazo, sin plegarlos a 500", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({
      response: { status: 503, data: { message: "No se pudo iniciar la sesión en este momento." } },
    });

    const r = await passwordlessVerify(ASERCION);

    expect(r).toEqual({ status: 503, message: "No se pudo iniciar la sesión en este momento.", usuario: null });
  });

  it("dice «no se pudo conectar» y 500 cuando no hubo respuesta ninguna", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const r = await passwordlessVerify(ASERCION);

    expect(r).toEqual({ status: 500, message: "No se pudo conectar con el servidor.", usuario: null });
  });
});
