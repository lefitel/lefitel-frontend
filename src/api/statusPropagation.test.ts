// The failure that reaches a screen, and the two separate things that keep it
// intact.
//
// **What this exists for.** Thirty-seven functions in this folder used to end
// `.then(r => r.status).catch(() => 400)`. A 403 the administrator can act on, a
// 500 that means try again, and a dead network all arrived as the number 400 —
// the information was destroyed one layer below the screen, so a screen could
// only ever have one sentence. The normalizer in `http.ts` is what replaces it,
// and it is a single line of registration whose two properties protect
// different things and are easy to confuse:
//
//   - **Its position** is defence, and measured as such rather than assumed.
//     Axios runs response handlers in registration order, so the step-up
//     interceptor sees a rejection first — but putting the normalizer ahead of
//     it would not blind it either, because the normalizer adds a field and
//     re-rejects the same object. What the order buys is the day somebody
//     changes what it rejects with: then, and only then, position is the one
//     thing standing between step-up and a rejection it cannot read.
//   - **Rejecting with the original error** protects everything downstream:
//     `SesionProvider`, which registers at mount and is therefore always last,
//     and around thirty readers in this folder and in the screens that reach
//     for `error.response`. A plain `{status, message}` would leave every one
//     of them with `undefined`, and the loudest consequence is that **a revoked
//     session stops logging anyone out**.
//
// Neither could be seen by any test before this file. `stepUpInterceptor.test.ts`
// and `SesionProvider.test.tsx` both spy on `axios.interceptors.response.use`
// and capture the handler instead of registering it, so no suite ever built a
// real chain.
//
// Everything here drives that real chain through a fake adapter. Nothing
// reaches a server.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { ID_INTERCEPTOR_STEP_UP, ID_NORMALIZADOR } from "./http";
import { normalizado } from "./fallo";
import { mensajeDeError, mensajeDeErrorAsync } from "./descarga";
import { registrarResolvedorStepUp, cancelarStepUpEnCurso } from "./stepUpInterceptor";
import { CODIGO_STEP_UP, STEP_UP_PASSWORD_FIELD } from "./stepUp";
import { opcionesDenegadas } from "./opciones.api";
import { url } from "./url";

const RUTA = `${url}/api/probeta`;

/** A response the way an adapter has to produce one. */
const respuesta = (config: InternalAxiosRequestConfig, status: number, data: unknown) => ({
  data, status, statusText: "", headers: new AxiosHeaders(), config,
});

/**
 * A fake server.
 *
 * `settle` — the validateStatus check that turns a 4xx into a rejection — lives
 * inside axios's own adapters, not in the pipeline, so a custom adapter has to
 * do it. Getting that wrong makes every test here pass for the wrong reason: a
 * 403 would resolve and never touch an error handler at all.
 */
function servidor(programa: (config: InternalAxiosRequestConfig, intento: number) => { status: number; data?: unknown } | "sin-respuesta") {
  let intento = 0;
  const anterior = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    const salida = programa(config, intento++);
    if (salida === "sin-respuesta") {
      throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {});
    }
    const r = respuesta(config, salida.status, salida.data ?? {});
    if (salida.status >= 200 && salida.status < 300) return r;
    throw new AxiosError(`Request failed with status code ${salida.status}`, String(salida.status), config, {}, r);
  };
  return { intentos: () => intento, restaurar: () => { axios.defaults.adapter = anterior; } };
}

let restaurarAdaptador: (() => void) | null = null;
const ejectar: number[] = [];

afterEach(() => {
  restaurarAdaptador?.();
  restaurarAdaptador = null;
  while (ejectar.length) axios.interceptors.response.eject(ejectar.pop() as number);
  registrarResolvedorStepUp(null);
  cancelarStepUpEnCurso();
});

function montar(programa: Parameters<typeof servidor>[0]) {
  const s = servidor(programa);
  restaurarAdaptador = s.restaurar;
  return s;
}

/** An interceptor registered now, which is where `SesionProvider`'s really is. */
function despues() {
  const vistos: unknown[] = [];
  const exitos: unknown[] = [];
  ejectar.push(axios.interceptors.response.use(
    (r) => { exitos.push(r); return r; },
    (e) => { vistos.push(e); return Promise.reject(e); },
  ));
  return { vistos, exitos };
}

describe("dónde se registra el traductor de fallos", () => {
  it("va detrás del interceptor del segundo factor, nunca delante", () => {
    // `axios.interceptors.response.use` returns an increasing handle, so this
    // is the order itself and not a proxy for it. One integer, and it cannot be
    // satisfied by accident — which matters, because getting it backwards
    // breaks the second-factor window silently and no rendered assertion would
    // notice.
    expect(ID_NORMALIZADOR).toBeGreaterThan(ID_INTERCEPTOR_STEP_UP);
  });

  it("el del segundo factor sigue viendo la respuesta entera", async () => {
    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }));
    // The resolver is the proof, and the first version of this test did not
    // use it: asserting only that the call rejects with a 403 passes with the
    // step-up interceptor deleted entirely, and in either registration order.
    // Being **asked for a password** is what can only happen if the
    // interceptor read `response.data.code` off an error that still had it.
    const pedido: unknown[] = [];
    registrarResolvedorStepUp(async (peticion) => { pedido.push(peticion); return null; });

    await expect(axios.get(RUTA)).rejects.toMatchObject({ response: { status: 403 } });

    expect(pedido, "el interceptor del segundo factor no llegó a leer data.code").toHaveLength(1);
  });

  it("no dice dos veces lo mismo cuando el aviso ya lo ha dado el interceptor", async () => {
    // The step-up refusal is the one response in the whole API carrying a
    // `code`, and the interceptor that reads it already raises its own toast —
    // with a "Configurarlo" button — before re-rejecting. Leaving the sentence
    // empty is what stops the forty new `catch` blocks from raising a second,
    // identical toast without the button.
    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "Configura tu segundo factor para continuar." } }));
    registrarResolvedorStepUp(async () => null);

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(normalizado(error)?.status).toBe(403);
    expect(normalizado(error)?.message).toBe("");
    expect(mensajeDeError(error, "No se pudo guardar")).toBe("No se pudo guardar");
  });
});

describe("con qué rechaza", () => {
  it("rechaza con el AxiosError original, enriquecido", async () => {
    montar(() => ({ status: 403, data: { message: "No tienes permiso para archivar" } }));

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    // The four together. `isAxiosError` is the one that fires the instant
    // somebody replaces the rejection with `{status, message}`.
    expect(axios.isAxiosError(error)).toBe(true);
    expect((error as AxiosError).config).toBeDefined();
    expect((error as AxiosError).response?.status).toBe(403);
    expect(normalizado(error)).toEqual({ status: 403, message: "No tienes permiso para archivar" });
  });

  it("deja al que se registra después leer el 401 y su petición", async () => {
    // The defect this is really about. `SesionProvider` registers its
    // interceptor when it mounts, so it is downstream of everything in
    // `http.ts` and no ordering choice can protect it: it reads
    // `error.response.status === 401` and `error.config.url` to decide whether
    // a revoked session should log the person out.
    const { vistos } = despues();
    montar(() => ({ status: 401, data: { message: "Sesión caducada" } }));

    await axios.get(RUTA).catch(() => undefined);

    expect(vistos).toHaveLength(1);
    expect((vistos[0] as AxiosError).response?.status).toBe(401);
    expect((vistos[0] as AxiosError).config?.url).toBe(RUTA);
  });

  it("una petición que nunca llegó vale 0 y lo dice con palabras", async () => {
    montar(() => "sin-respuesta");

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(normalizado(error)).toEqual({ status: 0, message: "Sin conexión con el servidor" });
  });

  it("deja la frase vacía cuando el servidor no dijo nada, para que hable la pantalla", async () => {
    // Deliberate. A 500 answers a neutral sentence and a 403 may answer none at
    // all; inventing one here would override the screen's own words, which are
    // the better ones because the screen knows what it was doing.
    montar(() => ({ status: 500, data: {} }));

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    expect(normalizado(error)?.status).toBe(500);
    expect(normalizado(error)?.message).toBe("");
    expect(mensajeDeError(error, "No se pudo archivar la ciudad")).toBe("No se pudo archivar la ciudad");
  });

  it("no toca una petición que alguien canceló", async () => {
    // The generator cancels its own exports and tells them apart with
    // `axios.isCancel`. Marking one would put "sin conexión con el servidor" on
    // screen over a download the person stopped on purpose.
    const control = new AbortController();
    montar(() => { control.abort(); return { status: 200 }; });

    const error = await axios.get(RUTA, { signal: control.signal }).catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
    expect(normalizado(error)).toBeUndefined();
  });
});

describe("lo que sigue funcionando gracias a eso", () => {
  it("`opcionesDenegadas` sigue distinguiendo un permiso de un segundo factor", async () => {
    // C2's four-state loading pattern in eight screens, and the only thing that
    // separates "denegado" from "fallo". It reads `error.response.data.code`,
    // so a plain-object rejection would silently take all eight back to "fallo".
    montar(() => ({ status: 403, data: {} }));
    const sinCodigo = await axios.get(RUTA).catch((e: unknown) => e);
    restaurarAdaptador?.();

    montar(() => ({ status: 403, data: { code: CODIGO_STEP_UP } }));
    registrarResolvedorStepUp(async () => null);
    const conCodigo = await axios.get(RUTA).catch((e: unknown) => e);

    expect(opcionesDenegadas(sinCodigo)).toBe(true);
    expect(opcionesDenegadas(conCodigo)).toBe(false);
  });

  it("`mensajeDeError` prefiere la frase del traductor", async () => {
    montar(() => "sin-respuesta");

    const error = await axios.get(RUTA).catch((e: unknown) => e);

    // Without the `normalized` branch this is the case that stays mute: a dead
    // server has no `response`, so the older reader found nothing and every
    // caller printed its own generic sentence.
    expect(mensajeDeError(error, "Error al generar el reporte")).toBe("Sin conexión con el servidor");
  });

  it("una descarga sigue leyendo su mensaje del Blob y no del traductor", async () => {
    // `mensajeDeErrorAsync` has to keep winning for a download: the body is a
    // `Blob`, so the normalizer finds no `data.message` and leaves the sentence
    // empty — the server's real 413 or 429 is inside the blob and nowhere else.
    montar(() => ({ status: 413, data: new Blob([JSON.stringify({ message: "El fichero supera el máximo" })]) }));

    const error = await axios.get(RUTA, { responseType: "blob" }).catch((e: unknown) => e);

    expect(await mensajeDeErrorAsync(error, "No se pudo descargar")).toBe("El fichero supera el máximo");
  });
});

describe("el reintento del segundo factor", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("llega al llamante como un éxito, y el manejador de éxito no cuenta nada", async () => {
    // Measured, and then frozen: the step-up interceptor retries from inside
    // its own error branch with `await axios(config)`, and that inner call
    // walks the whole chain again — so every success handler registered after
    // it runs **twice** for one retried request. The normalizer's success
    // handler is therefore the identity and must stay that way; anything that
    // counts, logs or measures there is double.
    const { exitos } = despues();
    const s = montar((_config, intento) =>
      intento === 0
        ? { status: 403, data: { code: CODIGO_STEP_UP, motivo: "contraseña-requerida", message: "x" } }
        : { status: 200, data: { ok: true } });
    registrarResolvedorStepUp(async () => ({ password: "la-de-verdad" }));

    const r = await axios.post(RUTA, {});

    expect(r.status).toBe(200);
    expect(s.intentos()).toBe(2);
    expect(exitos).toHaveLength(2);
    // And the password really travelled, so this is a retry and not the first
    // request answering 200 by luck.
    expect(String((r.config.data ?? ""))).toContain(STEP_UP_PASSWORD_FIELD);
  });
});
