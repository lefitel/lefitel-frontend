import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import {
  setupTotp,
  confirmTotp,
  deleteTotp,
  generateRecoveryCodes,
  getRecoveryCodesRemaining,
  probarStepUp,
  pedirCodigoPorCorreo,
  describeStepUpError,
  CODIGO_STEP_UP,
} from "./Mfa.api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setupTotp", () => {
  it("posts to POST /api/auth/totp/setup with stepup_password, never pass or oldPass", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { secreto: "JBSWY3DPEHPK3PXP", otpauth: "otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP" },
    });

    await setupTotp("la-mia");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/totp\/setup$/);
    expect(post.mock.calls[0][1]).toEqual({ stepup_password: "la-mia" });
  });

  it("returns the secret and the otpauth URI on 200", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { secreto: "JBSWY3DPEHPK3PXP", otpauth: "otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP" },
    });

    const res = await setupTotp("la-mia");

    expect(res).toEqual({
      status: 200,
      message: null,
      otpauth: "otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP",
      secreto: "JBSWY3DPEHPK3PXP",
    });
  });

  it("keeps the real status and body on failure — a 409 must not fold into 500 the way loginUsuario folds it", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("409"), {
        response: { status: 409, data: { message: "Ya tienes un factor de autenticación configurado." } },
      }),
    );

    const res = await setupTotp("la-mia");

    expect(res).toEqual({
      status: 409,
      message: "Ya tienes un factor de autenticación configurado.",
      code: undefined,
      motivo: undefined,
      otpauth: null,
      secreto: null,
    });
  });

  it("surfaces code and motivo from a step-up refusal", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("403"), {
        response: {
          status: 403,
          data: {
            message: "Introduce tu contraseña actual para completar esta operación.",
            code: CODIGO_STEP_UP,
            motivo: "contraseña-requerida",
          },
        },
      }),
    );

    const res = await setupTotp("");

    expect(res.status).toBe(403);
    expect(res.code).toBe(CODIGO_STEP_UP);
    expect(res.motivo).toBe("contraseña-requerida");
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    expect(await setupTotp("la-mia")).toEqual({
      status: 500,
      message: "No se pudo conectar con el servidor.",
      code: undefined,
      motivo: undefined,
      otpauth: null,
      secreto: null,
    });
  });
});

describe("confirmTotp", () => {
  it("posts the code and stepup_password to POST /api/auth/totp/confirm", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Segundo factor configurado correctamente." },
    });

    await confirmTotp("123456", "la-mia");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/totp\/confirm$/);
    expect(post.mock.calls[0][1]).toEqual({ codigo: "123456", stepup_password: "la-mia" });
  });

  it("keeps a wrong-code 400 distinguishable from a step-up refusal", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("400"), {
        response: { status: 400, data: { message: "El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo." } },
      }),
    );

    const res = await confirmTotp("000000", "la-mia");

    expect(res.status).toBe(400);
    expect(res.code).toBeUndefined();
    expect(res.message).toMatch(/código no es válido/);
  });

  it("returns the ten fresh recovery codes when confirming this factor is what minted them (2026-09-02)", async () => {
    // `totp.controller.ts`'s `confirmTotp` now issues the account's first ten
    // recovery codes in this same response when nothing was outstanding —
    // see that function's own comment for the decision. `codigos` is how
    // this client learns whether that happened.
    const codigos = Array.from({ length: 10 }, (_, i) => `CODIGO${i}`);
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Segundo factor configurado correctamente.", codigos },
    });

    const res = await confirmTotp("123456", "la-mia");

    expect(res.status).toBe(200);
    expect(res.codigos).toEqual(codigos);
    expect(res.codigos).toHaveLength(10);
  });

  it("answers codigos: null when the account already had an outstanding sheet — nothing was minted", async () => {
    // The server's own "only the first factor" rule: it sends `codigos: null`
    // rather than omitting the field, precisely so this is distinguishable
    // from "the field does not exist yet" without guessing.
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Segundo factor configurado correctamente.", codigos: null },
    });

    const res = await confirmTotp("123456", "la-mia");

    expect(res.status).toBe(200);
    expect(res.codigos).toBeNull();
  });

  it("never carries codigos on a failure", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("403"), {
        response: { status: 403, data: { message: "x", code: CODIGO_STEP_UP, motivo: "sin-factor-reciente" } },
      }),
    );

    const res = await confirmTotp("123456", "la-mia");

    expect(res.codigos).toBeNull();
  });
});

describe("deleteTotp", () => {
  it("sends stepup_password as the DELETE body, not a query string", async () => {
    const del = vi.spyOn(axios, "delete").mockResolvedValue({
      status: 200,
      data: { message: "Factor de autenticación eliminado." },
    });

    await deleteTotp("la-mia");

    expect(del).toHaveBeenCalledTimes(1);
    expect(del.mock.calls[0][0]).toMatch(/auth\/totp$/);
    // A DELETE's body travels on the config object's `data`, never appended
    // to the URL — a secret or a password in the query string is exactly
    // what `httpLogger` would then write into a log line unredacted.
    expect(del.mock.calls[0][0]).not.toContain("stepup_password");
    expect(del.mock.calls[0][1]).toEqual({ data: { stepup_password: "la-mia" } });
  });

  it("reads a 404 (nothing to delete) as an ordinary answer, not folded away", async () => {
    vi.spyOn(axios, "delete").mockRejectedValue(
      Object.assign(new Error("404"), {
        response: { status: 404, data: { message: "No tienes ningún factor de autenticación registrado." } },
      }),
    );

    const res = await deleteTotp("la-mia");

    expect(res).toEqual({
      status: 404,
      message: "No tienes ningún factor de autenticación registrado.",
      code: undefined,
      motivo: undefined,
    });
  });
});

describe("generateRecoveryCodes", () => {
  it("posts stepup_password to POST /api/auth/recovery-codes and returns the ten codes", async () => {
    const codigos = Array.from({ length: 10 }, (_, i) => `CODIGO${i}`);
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Códigos generados.", codigos },
    });

    const res = await generateRecoveryCodes("la-mia");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/recovery-codes$/);
    expect(post.mock.calls[0][1]).toEqual({ stepup_password: "la-mia" });
    expect(res.codigos).toEqual(codigos);
    expect(res.codigos).toHaveLength(10);
  });

  it("never carries codigos on a failure", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("403"), {
        response: { status: 403, data: { message: "x", code: CODIGO_STEP_UP, motivo: "sin-factor-reciente" } },
      }),
    );

    const res = await generateRecoveryCodes("la-mia");

    expect(res.codigos).toBeNull();
    expect(res.motivo).toBe("sin-factor-reciente");
  });
});

describe("getRecoveryCodesRemaining", () => {
  it("gets GET /api/auth/recovery-codes and never sends a body", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ status: 200, data: { restantes: 7 } });

    const res = await getRecoveryCodesRemaining();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toMatch(/auth\/recovery-codes$/);
    expect(res).toEqual({ status: 200, restantes: 7 });
  });

  it("folds a failure to restantes: null, never to 0 — 0 and 'unknown' are not the same fact", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network down"));

    expect(await getRecoveryCodesRemaining()).toEqual({ status: 500, restantes: null });
  });
});

describe("describeStepUpError", () => {
  const MOTIVOS = ["estado-incompleto", "sin-factor-reciente", "contraseña-incorrecta", "contraseña-requerida"] as const;

  it("gives all four motivos a non-empty sentence", () => {
    for (const motivo of MOTIVOS) {
      expect(describeStepUpError(motivo, null)).toBeTruthy();
    }
  });

  it("tells 'sin-factor-reciente' apart from 'contraseña-incorrecta', even though the server answers both with the same sentence", () => {
    // api/src/middleware/requireStepUp.ts answers both refusals with the same
    // `MENSAJE` constant server-side. This is the test that would fail if a
    // future edit went back to reading `response.message` for either of them.
    const mensajeServidorParaAmbos = "Esta operación necesita que confirmes tu identidad. Vuelve a autenticarte y repite la acción.";

    const sinFactor = describeStepUpError("sin-factor-reciente", mensajeServidorParaAmbos);
    const passIncorrecta = describeStepUpError("contraseña-incorrecta", mensajeServidorParaAmbos);

    expect(sinFactor).not.toBe(passIncorrecta);
    expect(sinFactor).not.toBe(mensajeServidorParaAmbos);
    expect(passIncorrecta).not.toBe(mensajeServidorParaAmbos);
  });

  it("every one of the four motivos maps to a different sentence", () => {
    const mensajes = MOTIVOS.map((m) => describeStepUpError(m, null));
    expect(new Set(mensajes).size).toBe(MOTIVOS.length);
  });

  it("falls back to the server's own message for an unrecognised or absent motivo", () => {
    expect(describeStepUpError(undefined, "algo pasó")).toBe("algo pasó");
    expect(describeStepUpError("un-motivo-futuro", "algo pasó")).toBe("algo pasó");
    expect(describeStepUpError(undefined, null)).toBe("Ocurrió un error en el servidor.");
  });
});

describe("probarStepUp", () => {
  it("posts only the code to POST /api/auth/stepup when no class is named — the server decides by shape", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { message: "Identidad confirmada." } });

    await probarStepUp("123456");

    expect(post.mock.calls[0][0]).toMatch(/auth\/stepup$/);
    // `toStrictEqual`: a `metodo: undefined` riding along would pass `toEqual`.
    expect(post.mock.calls[0][1]).toStrictEqual({ codigo: "123456" });
  });

  // Plan 4E. Six digits from the email are indistinguishable from six digits
  // from the app: without `metodo`, the server proves them against the app,
  // answers "wrong" and charges the lockout.
  it("names the class when the dialog says so", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { message: "ok" } });

    await probarStepUp("123456", "correo");

    expect(post.mock.calls[0][1]).toStrictEqual({ codigo: "123456", metodo: "correo" });
  });

  it("surfaces intentosRestantes on a 400", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("400"), {
        response: { status: 400, data: { message: "Código incorrecto o ya utilizado.", intentosRestantes: 1 } },
      }),
    );

    expect(await probarStepUp("000000", "correo")).toEqual({
      status: 400,
      message: "Código incorrecto o ya utilizado.",
      intentosRestantes: 1,
    });
  });
});

describe("pedirCodigoPorCorreo (plan 4E)", () => {
  it("posts an empty JSON body to POST /api/auth/mfa/email-code — the account and the address are the session's", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Te enviamos un código.", enviado_a: "i***@osefi.net", reintento_en_s: 60 },
    });

    await pedirCodigoPorCorreo();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/mfa\/email-code$/);
    // `{}` and not nothing: without a body axios leaves a form-urlencoded
    // Content-Type behind and `express.json()` never parses it.
    expect(post.mock.calls[0][1]).toStrictEqual({});
    expect(post.mock.calls[0][2]).toMatchObject({ timeout: expect.any(Number) });
  });

  it("maps the 200: the masked address and the cooldown the server chose", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Te enviamos un código.", enviado_a: "i***@osefi.net", reintento_en_s: 60 },
    });

    expect(await pedirCodigoPorCorreo()).toEqual({
      status: 200,
      message: "Te enviamos un código.",
      enviado_a: "i***@osefi.net",
      reintento_en_s: 60,
    });
  });

  it("keeps a 429 as a 429, with the server's own seconds to wait — the countdown must use these, not a guess", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("429"), {
        response: { status: 429, data: { message: "Espera antes de pedir otro código.", reintento_en_s: 540 } },
      }),
    );

    expect(await pedirCodigoPorCorreo()).toEqual({
      status: 429,
      message: "Espera antes de pedir otro código.",
      enviado_a: null,
      reintento_en_s: 540,
    });
  });

  it("keeps a 503 (no provider could send) and a 400 (no verified address) apart from a network failure", async () => {
    for (const respuesta of [
      { status: 503, message: "No se pudo enviar el código. Prueba otro método o inténtalo más tarde." },
      { status: 400, message: "Tu cuenta no tiene un correo verificado." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "post").mockRejectedValue(
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        }),
      );
      expect(await pedirCodigoPorCorreo(), JSON.stringify(respuesta)).toEqual({
        ...respuesta,
        enviado_a: null,
        reintento_en_s: null,
      });
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    expect(await pedirCodigoPorCorreo()).toEqual({
      status: 500,
      message: "No se pudo enviar el código.",
      enviado_a: null,
      reintento_en_s: null,
    });
  });
});
