// The seam nothing was watching, on either side.
//
// `editUserName` and `editUserPass` are the two functions that carry a person's
// current password to the server. Since the API started demanding it, they are
// the only reason renaming yourself and changing your own password work at all
// — and there was no test file for this module. The screens above have plenty of
// tests, but they mock this module wholesale and assert on the argument the mock
// received, which says nothing about what the module then puts on the wire.
//
// The audit measured the gap: adding `const { oldPass: _drop, ...sinPass } =
// data;` to `editUserName` and sending `sinPass` left **316 of 316 green here
// and 811 of 811 green in the API**, while in production nobody could rename
// themselves or change their password from either screen — 400 "Debe
// proporcionar su contraseña actual." every time. It fails closed and loudly, so
// it breaks the ERP rather than opening a hole, but nothing anywhere would have
// caught it before somebody tried it by hand.
//
// So every test below asserts **what was sent**, not that a call happened. That
// distinction is the whole point of the file: `expect(put).toHaveBeenCalled()`
// is exactly as green with the password as without it, and so is
// `expect(cuerpo).toHaveProperty("oldPass")` — a property whose value is
// `undefined` satisfies that and then vanishes in `JSON.stringify` on the way
// out. The assertions here read the value, and for the cases where absence is
// what is correct they read the serialised body, because that is what the server
// receives.
//
// A note on the shape of `createUsuario` in this module: it builds an explicit
// payload, naming the eight fields it wants. That is the better style, and it is
// also precisely how the defect above gets introduced by accident — somebody
// tidying `editUserName` the same way has no reason to suspect that `oldPass`,
// which is not a column of the record, has to be on the list. These tests are
// what makes that tidy-up fail instead of ship.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios, { AxiosError } from "axios";
import { asignarRol, editUserName, editUserPass, resetMfaUsuario, desbloquearUsuario, deleteUsuario } from "./Usuario.api";
import type { UsuarioInterface } from "../interfaces/interfaces";

afterEach(() => {
  vi.restoreAllMocks();
});

const YO = 7;
const OTRA_PERSONA = 99;

/**
 * A record as the screens hold it, hash included.
 *
 * `pass` deliberately carries a bcrypt hash rather than being left empty. A
 * fixture with no password lets `expect(enviado.oldPass).toBe(fixture.pass)`
 * pass against a function that sends nothing at all — both sides `undefined` —
 * and that is not hypothetical: it is the mistake made earlier in this same plan,
 * in this same repository, by a test that reported "password correct" because it
 * compared against `undefined`.
 */
const cuenta = (id: number): UsuarioInterface => ({
  id,
  name: "Isaias",
  lastname: "Salas",
  birthday: new Date("1990-01-01"),
  image: "",
  phone: "700",
  user: "isaias",
  pass: "$2a$12$un-hash-cualquiera",
  id_rol: 3,
});

/** The body of the single PUT that was made. */
const cuerpoEnviado = (put: ReturnType<typeof vi.spyOn>) =>
  put.mock.calls[0][1] as Record<string, unknown>;

/**
 * Un rechazo con la forma exacta que produce axios de verdad.
 *
 * 🔴 **`AxiosError` y no un `Error` con un `response` pegado encima**, que es
 * lo que ponía aquí antes. La diferencia dejó de ser cosmética cuando estos
 * envoltorios pasaron a sacar su frase por `mensajeDeError`: esa función
 * pregunta `axios.isAxiosError(error)` antes de mirar el cuerpo, así que un
 * impostor de pato se lleva el respaldo genérico y el test dice que el
 * servidor no habló cuando en producción sí habla. Un fixture que no puede
 * salir del código que imita no está midiendo ese código.
 *
 * El recorrido completo —con el normalizador y el interceptor de la ventana
 * montados de verdad— lo cubre `statusPropagation.test.ts`; esto es la mitad
 * unitaria.
 */
const rechazoDelServidor = (status: number, message: string) =>
  new AxiosError(
    String(status),
    String(status),
    undefined,
    {},
    { status, data: { message }, statusText: "", headers: {}, config: {} } as never,
  );

describe("editUserName", () => {
  it("sends the new name and no password of any kind, on the wire the server actually reads", async () => {
    /**
     * 🔴 The mirror of what this test used to hold, and the point of the arc.
     *
     * A rename carried `oldPass` until the server's own check moved up to the
     * step-up gate. The gate reads a different field, `stepup_password`, and
     * `stepUpInterceptor.ts` puts it there on the retry — so a password
     * collected by the rename form would be a second prompt for one secret in
     * one request, ignored by the server and typed by the person anyway.
     *
     * **Asserted on the serialised body**, which is what the server receives,
     * and on `Object.keys` of the object, which is what catches the shape this
     * change could regress into: a parameter left on the signature and never
     * passed puts `oldPass: undefined` on the object, and *that* satisfies both
     * `not.toHaveProperty` after `JSON.stringify` and a `toEqual` without the
     * key. See this file's header — the same class of mistake cost a
     * production defect once already.
     */
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(YO), user: "isalas" });

    expect(put).toHaveBeenCalledTimes(1);
    const cuerpo = cuerpoEnviado(put);
    expect(Object.keys(cuerpo)).not.toContain("oldPass");
    expect(JSON.parse(JSON.stringify(cuerpo))).not.toHaveProperty("oldPass");
    // And the new name went with it, so this is not green because nothing was
    // sent at all.
    expect(cuerpo.user).toBe("isalas");
  });

  it("does not accept a password parameter at all — checked by the compiler, not at runtime", async () => {
    /**
     * 🔴 **The only witness that can go red for this change, and it is a type
     * one.** `editUserName` forwards whatever object it is given, so no runtime
     * assertion in this file can tell "the wrapper stopped adding a password"
     * from "the wrapper never added one" — it never did; the callers did. What
     * actually stops a caller now is the signature.
     *
     * `@ts-expect-error` is how that gets held: `npm run typecheck` covers this
     * file (`tsconfig.test.json`), and an unused `@ts-expect-error` is itself an
     * error. So if `oldPass` is ever put back on the parameter type, this line
     * stops being an error, the directive goes unused, and the typecheck fails.
     * The test body below is incidental — the assertion is the directive.
     */
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    // @ts-expect-error `oldPass` is not part of a rename any more — the gate asks.
    await editUserName({ ...cuenta(YO), user: "isalas", oldPass: "la-mia" });

    expect(put).toHaveBeenCalledTimes(1);
  });

  it("addresses the rename endpoint for the account being renamed", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(YO), user: "isalas" });

    // Anchored: `usuario/7` (the generic update, whose whitelist refuses `user`
    // outright) and `usuario/userpass/7` are both wrong here, and both would
    // satisfy a looser match.
    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/username\/7$/);
  });

  it("renames somebody else through the same endpoint, with nothing extra on it", async () => {
    // An administrator renaming another account was the case that needed the
    // `oldPass` exemption; with no password on the request at all there is no
    // exemption left to get wrong, and the two calls are now literally the same
    // shape. Kept because the *address* still has to change with the target.
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(OTRA_PERSONA), user: "otro-nombre" });

    expect(Object.keys(cuerpoEnviado(put))).not.toContain("oldPass");
    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/username\/99$/);
  });

  it("reports the server's own refusal instead of a success", async () => {
    // Four different things to be told, and the screens show `message`
    // verbatim. A 429 in particular must not read as "your password is wrong":
    // the person has to know to wait.
    for (const respuesta of [
      { status: 400, message: "Debe proporcionar su contraseña actual." },
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 409, message: "Ese nombre de usuario ya está en uso." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "put").mockRejectedValue(
        rechazoDelServidor(respuesta.status, respuesta.message)
      );

      expect(await editUserName({ ...cuenta(YO) }), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    // No `response`, so no sentence from the server. A screen with an empty
    // toast is how "it just did nothing" happens.
    vi.spyOn(axios, "put").mockRejectedValue(new Error("network down"));

    expect(await editUserName({ ...cuenta(YO) })).toEqual({
      status: 500,
      message: "Error desconocido",
    });
  });

  it("reports a success with no message at all", async () => {
    // `message` absent and not an empty string: the screens fall back to their
    // own wording on a falsy one, so an empty string here would show an error
    // sentence for a rename that worked.
    vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    expect(await editUserName({ ...cuenta(YO) })).toEqual({ status: 200 });
  });
});

describe("editUserPass", () => {
  it("sends the new password and the current one as two distinct values", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserPass({ ...cuenta(YO), pass: "la-nueva-de-doce", oldPass: "la-vieja-de-doce" });

    expect(put).toHaveBeenCalledTimes(1);
    const cuerpo = cuerpoEnviado(put);
    // Both, and not the same one twice: swapping them would have the server
    // compare the new password as if it were the current one, refuse it, and
    // charge for the attempt.
    expect(cuerpo.pass).toBe("la-nueva-de-doce");
    expect(cuerpo.oldPass).toBe("la-vieja-de-doce");
    expect(JSON.parse(JSON.stringify(cuerpo)).oldPass).toBe("la-vieja-de-doce");
    // Neither of them is the hash the record was carrying.
    expect(cuerpo.pass).not.toBe(cuenta(YO).pass);
    expect(cuerpo.oldPass).not.toBe(cuenta(YO).pass);
  });

  it("addresses the password endpoint for the account being changed", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserPass({ ...cuenta(YO), pass: "la-nueva-de-doce", oldPass: "la-vieja-de-doce" });

    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/userpass\/7$/);
  });

  it("sends no current password when an administrator resets somebody else's", async () => {
    // The exemption the server grants, and the reason it exists: somebody who
    // cannot get in is precisely the person whose password is being reset, so
    // there is none either party could supply.
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserPass({ ...cuenta(OTRA_PERSONA), pass: "la-nueva-de-doce", oldPass: undefined });

    const enviadoDeVerdad = JSON.parse(JSON.stringify(cuerpoEnviado(put)));
    expect(enviadoDeVerdad.pass).toBe("la-nueva-de-doce");
    expect(enviadoDeVerdad).not.toHaveProperty("oldPass");
    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/userpass\/99$/);
  });

  it("reports the server's own refusal instead of a success", async () => {
    for (const respuesta of [
      { status: 400, message: "Debe proporcionar su contraseña actual." },
      { status: 400, message: "La contraseña debe tener al menos 12 caracteres." },
      // 400 since the server stopped answering this one with a 401: every 401
      // ends the session in `SesionProvider`, and a typo is not a dead session.
      { status: 400, message: "La contraseña actual suministrada no es correcta." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "put").mockRejectedValue(
        rechazoDelServidor(respuesta.status, respuesta.message)
      );

      expect(await editUserPass({ ...cuenta(YO), oldPass: "la-mia" }), respuesta.message).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "put").mockRejectedValue(new Error("network down"));

    expect(await editUserPass({ ...cuenta(YO), oldPass: "la-mia" })).toEqual({
      status: 500,
      message: "Error desconocido",
    });
  });

  it("reports a success with no message at all", async () => {
    vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    expect(await editUserPass({ ...cuenta(YO), oldPass: "la-mia" })).toEqual({ status: 200 });
  });
});

/**
 * The rescue routes from `docs/specs/2026-08-21-autenticacion-mfa-design.md`
 * §8, in the same shape as `editUserName`/`editUserPass` above: `{ status,
 * message? }`, so `UsuarioDetallePage.tsx` has one convention to branch on
 * instead of two. Same reason for testing at this level too — a screen test
 * that mocks this module wholesale would never notice a wrong method, a wrong
 * path, or a swallowed status.
 */
/**
 * `asignarRol` — the function this module did not have.
 *
 * `id_rol` came off `PUT /api/usuario/:id`'s allowlist and became a
 * sub-resource of its own on the server, and nothing here was taught the new
 * address: `editUsuario` went on sending the role inside the profile save, the
 * server discarded it and answered 200, and the screen said "Usuario
 * actualizado" over a role that had not moved.
 *
 * These are the wire assertions, and they run wherever the suite runs. The
 * other half — that no gated route is left with nobody calling it, which is the
 * shape the defect actually had — is `rutasProtegidas.test.ts`, and it needs
 * the `api` repository beside this one.
 */
describe("asignarRol", () => {
  it("puts the role on its own sub-resource, and sends the role and nothing else", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 204, data: "" });

    await asignarRol(YO, 5);

    expect(put).toHaveBeenCalledTimes(1);
    // The address, not merely "a PUT happened": sending this to
    // `/api/usuario/7` is exactly the defect, and it answers 200.
    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/7\/rol$/);
    // And the body is the role alone. The record this comes from carries a
    // password hash and a recovery address; a route that writes one number has
    // no business receiving them, and `id_rol` arriving beside forty other
    // fields is how it ended up on the wrong route in the first place.
    expect(cuerpoEnviado(put)).toEqual({ id_rol: 5 });
  });

  it("addresses the right account and not a neighbouring one", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 204, data: "" });

    await asignarRol(OTRA_PERSONA, 5);

    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/99\/rol$/);
    expect(put.mock.calls[0][0]).not.toMatch(/\/usuario\/7\//);
  });

  it("reports the server's own refusal instead of a success", async () => {
    // The three this route answers with a sentence worth reading. The first is
    // the one a client must never provoke — the refusal on the caller's own row
    // is unconditional — and it is here because reaching it is a bug in the
    // screen, not in the person, and swallowing it would hide that.
    for (const respuesta of [
      { status: 403, message: "No puede cambiar su propio rol. Pídaselo a otro administrador." },
      { status: 409, message: "No se puede asignar un rol archivado." },
      { status: 404, message: "Rol no encontrado" },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "put").mockRejectedValue(
        rechazoDelServidor(respuesta.status, respuesta.message)
      );

      expect(await asignarRol(YO, 5), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "put").mockRejectedValue(new Error("network down"));

    expect(await asignarRol(YO, 5)).toEqual({ status: 500, message: "Error desconocido" });
  });

  it("reports the 204 the server really sends, with no message at all", async () => {
    // 204 and not 200: this route writes one number and has nothing to send
    // back. A caller comparing against 200 would read every success as a
    // failure, which is why the number is asserted rather than "not an error".
    vi.spyOn(axios, "put").mockResolvedValue({ status: 204, data: "" });

    expect(await asignarRol(YO, 5)).toEqual({ status: 204 });
  });
});

describe("resetMfaUsuario", () => {
  it("posts to the mfa/reset route for the account named", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: {} });

    await resetMfaUsuario(7);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/usuario\/7\/mfa\/reset$/);
  });

  it("addresses the right account and not a neighbouring one", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: {} });

    await resetMfaUsuario(99);

    expect(post.mock.calls[0][0]).toMatch(/\/usuario\/99\/mfa\/reset$/);
    expect(post.mock.calls[0][0]).not.toMatch(/\/usuario\/7\//);
  });

  it("reports the server's own refusal instead of a success", async () => {
    for (const respuesta of [
      { status: 403, message: "No puedes restablecer tu propio segundo factor." },
      { status: 404, message: "Usuario no encontrado." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "post").mockRejectedValue(
        rechazoDelServidor(respuesta.status, respuesta.message)
      );

      expect(await resetMfaUsuario(7), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    expect(await resetMfaUsuario(7)).toEqual({ status: 500, message: "Error desconocido" });
  });

  it("reports a success with no message at all", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: {} });

    expect(await resetMfaUsuario(7)).toEqual({ status: 200 });
  });
});

describe("desbloquearUsuario", () => {
  it("patches the desbloquear route for the account named", async () => {
    const patch = vi.spyOn(axios, "patch").mockResolvedValue({ status: 200, data: {} });

    await desbloquearUsuario(7);

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][0]).toMatch(/\/usuario\/7\/desbloquear$/);
  });

  it("addresses the right account and not a neighbouring one", async () => {
    const patch = vi.spyOn(axios, "patch").mockResolvedValue({ status: 200, data: {} });

    await desbloquearUsuario(99);

    expect(patch.mock.calls[0][0]).toMatch(/\/usuario\/99\/desbloquear$/);
    expect(patch.mock.calls[0][0]).not.toMatch(/\/usuario\/7\//);
  });

  it("reports the server's own refusal instead of a success", async () => {
    for (const respuesta of [
      { status: 403, message: "No tienes permiso para esta acción." },
      { status: 404, message: "Usuario no encontrado." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "patch").mockRejectedValue(
        rechazoDelServidor(respuesta.status, respuesta.message)
      );

      expect(await desbloquearUsuario(7), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "patch").mockRejectedValue(new Error("network down"));

    expect(await desbloquearUsuario(7)).toEqual({ status: 500, message: "Error desconocido" });
  });

  it("reports a success with no message at all", async () => {
    // 204 y cuerpo vacío: desde C4 `PATCH /usuario/:id/desbloquear` no devuelve
    // nada. Con un 200 aquí este fichero describía una respuesta que el
    // servidor ya no manda, y la pantalla que lee esto (`UsuarioDetallePage`)
    // acabaría contradiciéndolo sin que nada se pusiera rojo.
    vi.spyOn(axios, "patch").mockResolvedValue({ status: 204, data: "" });

    expect(await desbloquearUsuario(7)).toEqual({ status: 204 });
  });
});

/**
 * 🔴 El bucle infinito que estas cinco llamadas tenían, y la única prueba que
 * lo ve venir.
 *
 * `axios.post(url)` sin segundo argumento deja
 * `Content-Type: application/x-www-form-urlencoded` escrito en la
 * configuración de la petición. `api/src/app.ts` monta **sólo**
 * `express.json()`. Así que cuando el interceptor de step-up reenvía la
 * petición con la contraseña dentro, sale como formulario, Express no lo
 * parsea, `req.body` queda vacío y el servidor responde «falta la contraseña»
 * otra vez — con la contraseña correcta, para siempre, escribiendo una línea
 * de bitácora por vuelta.
 *
 * Y `axios.delete(url)` sin `data` no manda cuerpo ninguno, así que no hay
 * dónde poner la contraseña al reenviar.
 *
 * Ninguna de las dos cosas la ve un typecheck, ni un test que sólo mire la
 * URL. Éste ejercita el axios de verdad con un adaptador falso, así que lo que
 * comprueba es la cabecera y el cuerpo que **saldrían por el cable**.
 */
describe("las cinco llamadas que el interceptor de step-up tiene que poder reenviar", () => {
  /** Captura la configuración final: cabeceras resueltas y cuerpo ya serializado. */
  function capturar() {
    const visto: { ct?: unknown; data?: unknown }[] = [];
    const anterior = axios.defaults.adapter;
    axios.defaults.adapter = (config) => {
      visto.push({
        ct: config.headers?.["Content-Type"] ?? config.headers?.["content-type"],
        data: config.data,
      });
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    };
    return { visto, restaurar: () => { axios.defaults.adapter = anterior; } };
  }

  it("resetMfaUsuario sale como JSON, no como formulario", async () => {
    const { visto, restaurar } = capturar();
    try {
      await resetMfaUsuario(7);
    } finally {
      restaurar();
    }

    expect(visto).toHaveLength(1);
    expect(String(visto[0].ct)).toContain("application/json");
    expect(String(visto[0].ct)).not.toContain("x-www-form-urlencoded");
  });

  it("desbloquearUsuario sale como JSON, no como formulario", async () => {
    const { visto, restaurar } = capturar();
    try {
      await desbloquearUsuario(7);
    } finally {
      restaurar();
    }

    expect(String(visto[0].ct)).toContain("application/json");
    expect(String(visto[0].ct)).not.toContain("x-www-form-urlencoded");
  });

  it("deleteUsuario lleva un cuerpo donde quepa la contraseña", async () => {
    const { visto, restaurar } = capturar();
    try {
      await deleteUsuario(7);
    } finally {
      restaurar();
    }

    // Sin `{ data: {} }` esto es `undefined` y no hay nada que ampliar.
    expect(visto[0].data).toBeDefined();
    expect(String(visto[0].ct)).toContain("application/json");
  });
});
