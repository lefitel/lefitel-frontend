// Ronda de correcciones de la Tarea 5, hallazgo 4 de la revisión.
//
// `comprobarToken` is the one place that translates `GET /api/auth/me`'s real
// response into the shape `SesionProvider.tsx` reads, and nothing protected
// that mapping: there is no test file for this module, and
// `SesionProvider.test.tsx` mocks the whole thing away. Had this task left
// the old `usuario: response.data` mapping in place (correct for the old
// `GET /api/login`, which returned the user's fields at the top level; wrong
// for `/auth/me`, which nests them under `usuario`), all 249 tests in the
// suite would have stayed green — and every event created after a page
// reload would have saved with `id_usuario: 0`, because `sesion.usuario.id`
// would be `undefined`.
//
// The response shape asserted below is not guessed: it is
// `api/src/controllers/auth.controller.ts:180-184`'s `res.status(200).json({
// usuario, permisos, expires_at })`, where `usuario` is the six fields the
// same file's `attributes` list projects (`:173`). The `expires_at` of that
// body is deliberately not mapped — the deadline is read off the
// `x-osefi-session-expires` header of every authenticated response instead, so
// that there is one source for it and not two. The tests below feed it in
// anyway, because the server does: what they pin is that it comes back out
// nowhere.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { comprobarToken, loginUsuario, sendVerificationEmail, verifyEmailToken } from "./Login.api";
import { sinPermisos } from "../lib/permissions";
import type { UsuarioInterface } from "../interfaces/interfaces";

afterEach(() => {
  vi.restoreAllMocks();
});

const usuarioDelServidor = { id: 7, id_rol: 3, user: "ada", name: "Ada", lastname: "Lovelace", image: "" };
const permisosDelServidor = sinPermisos();

describe("comprobarToken", () => {
  it("asks GET /api/auth/me, not the old GET /api/login", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: { usuario: usuarioDelServidor, permisos: permisosDelServidor, expires_at: null },
    });

    await comprobarToken();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][0]).toMatch(/auth\/me$/);
  });

  it("maps a 200 field by field — usuario nested under `usuario`, not at the top level", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: { usuario: usuarioDelServidor, permisos: permisosDelServidor, expires_at: "2026-08-30T00:00:00.000Z" },
    });

    const res = await comprobarToken();

    expect(res.status).toBe(200);
    // Not `res.usuario === usuarioDelServidor` as a single reference check —
    // that would pass just as well whether this reads `response.data` whole
    // (the old, wrong shape) or `response.data.usuario` (the real one),
    // since either way `res.usuario` would be *some* object. Reading the
    // field the wrong mapping would leave `undefined` is what actually pins
    // which shape this is reading.
    expect(res.usuario?.id).toBe(7);
    expect(res.usuario?.id_rol).toBe(3);
    expect(res.usuario).toEqual(usuarioDelServidor);
    expect(res.permisos).toEqual(permisosDelServidor);
    // Sent by the server, dropped here on purpose. Asserted by absence rather
    // than ignored, so putting the second source of the deadline back is a
    // change that has to argue with a test.
    expect(res).not.toHaveProperty("expires_at");
  });

  it("folds a 401 (no session) into an anonymous result, not an exception", async () => {
    const error = Object.assign(new Error("401"), { response: { status: 401 } });
    vi.spyOn(axios, "get").mockRejectedValue(error);

    const res = await comprobarToken();

    expect(res).toEqual({ status: 401, usuario: null });
  });

  it("reports 500 — not 401 — for a failure that carries no status, so a dead network is not mistaken for 'no session'", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network down"));

    const res = await comprobarToken();

    expect(res.status).toBe(500);
    expect(res.usuario).toBeNull();
  });
});

describe("loginUsuario", () => {
  it("asks POST /api/auth/login, not the old POST /api/login", async () => {
    // The twin of the `comprobarToken` assertion at the top of this file, and
    // it is about a URL for the same reason: the two addresses answer
    // identically today, so nothing else in this repository — not a type, not
    // another test, not the screen — can tell which one was asked for. The API
    // kept the old one alive on the new handler so that a cached bundle can
    // still log in; that only stops being a permanent fixture if this file
    // stops calling it, and this is the line that says so.
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { usuario: usuarioDelServidor, permisos: permisosDelServidor },
    });

    await loginUsuario({} as UsuarioInterface);

    expect(post).toHaveBeenCalledTimes(1);
    // Anchored at the end, so `.../login` cannot satisfy it.
    expect(post.mock.calls[0][0]).toMatch(/auth\/login$/);
    expect(post.mock.calls[0][0]).not.toMatch(/(^|\/)api\/login$/);
  });

  it("strips a token out of the body even though the server no longer sends one", async () => {
    // The server stopped signing: there is no `jwt.sign` left in the API, so
    // this response shape is synthetic. The assertion is still worth its line,
    // because what it pins is the strip itself — the last thing between a
    // credential appearing in a login body and it landing in React state,
    // where every screen reads it and `localStorage` is one careless line away.
    //
    // The compiler cannot see this. Putting `token` on the session object would
    // be an excess property and fail the typecheck; letting it ride *inside*
    // `usuario` would not, because `response.data` is `any` and
    // `UsuarioInterface` never mentions a token. That is the version of the
    // mistake nothing else would notice.
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: {
        usuario: { ...usuarioDelServidor, token: "jwt.recien.firmado" },
        permisos: permisosDelServidor,
      },
    });

    const res = await loginUsuario({} as UsuarioInterface);

    expect(res.usuario).not.toBeNull();
    expect(JSON.stringify(res.usuario)).not.toContain("jwt.recien.firmado");
    expect(res.usuario?.usuario).not.toHaveProperty("token");
    // And the fields the screen actually draws from survived the strip.
    expect(res.usuario?.usuario.id).toBe(7);
    expect(res.usuario?.usuario.user).toBe("ada");
    expect(res.usuario?.permisos).toEqual(permisosDelServidor);
    // Never true on its own: `LoginPage.tsx` is what turns a successful
    // request into a session.
    expect(res.usuario?.autenticado).toBe(false);
  });
});

describe("sendVerificationEmail", () => {
  it("posts to POST /api/auth/email/send with the address and the current password", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Si la dirección es válida, se envió un enlace de verificación." },
    });

    await sendVerificationEmail("nueva@osefi.net", "la-mia");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/email\/send$/);
    expect(post.mock.calls[0][1]).toEqual({ email: "nueva@osefi.net", pass: "la-mia" });
  });

  it("passes the uniform 200 through untouched, without guessing at what happened server-side", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Si la dirección es válida, se envió un enlace de verificación." },
    });

    const res = await sendVerificationEmail("nueva@osefi.net", "la-mia");

    expect(res).toEqual({
      status: 200,
      message: "Si la dirección es válida, se envió un enlace de verificación.",
    });
  });

  it("keeps the real status on failure rather than folding everything to 500, the way loginUsuario does", async () => {
    // The whole point of this file's comment on the function: PerfilPage.tsx
    // has to tell a 429 apart from a 401, and a 401 for a wrong password
    // apart from a 401 for an archived account. None of that is possible if
    // this wrapper hard-codes `status: 500` on every rejection.
    for (const respuesta of [
      { status: 400, message: "Debe indicar una dirección de correo válida." },
      { status: 400, message: "Debe proporcionar su contraseña actual." },
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 401, message: "Su cuenta ya no está activa." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "post").mockRejectedValue(
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
      );

      expect(await sendVerificationEmail("nueva@osefi.net", "la-mia"), JSON.stringify(respuesta)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    expect(await sendVerificationEmail("nueva@osefi.net", "la-mia")).toEqual({
      status: 500,
      message: "No se pudo conectar con el servidor.",
    });
  });
});

describe("verifyEmailToken", () => {
  it("posts to POST /api/auth/email/verify with only the token", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { message: "Correo verificado." },
    });

    await verifyEmailToken("un-token-opaco");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/auth\/email\/verify$/);
    expect(post.mock.calls[0][1]).toEqual({ token: "un-token-opaco" });
  });

  it("reports a 200 with the server's own confirmation", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { message: "Correo verificado." } });

    expect(await verifyEmailToken("un-token-opaco")).toEqual({ status: 200, message: "Correo verificado." });
  });

  it("keeps the real status on failure — a 429 must not read as the generic 500 a broken link would", async () => {
    for (const respuesta of [
      { status: 400, message: "Debe indicar el token." },
      { status: 400, message: "Este enlace ya no es válido. Solicite uno nuevo." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "post").mockRejectedValue(
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
      );

      expect(await verifyEmailToken("un-token-opaco"), JSON.stringify(respuesta)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    expect(await verifyEmailToken("un-token-opaco")).toEqual({
      status: 500,
      message: "No se pudo conectar con el servidor.",
    });
  });
});

// `confirmarPassword` had eight tests here and they went with it. The wrapper and
// the `POST /api/auth/confirm-password` behind it are retired: the password now
// travels on the write that needs it — `oldPass` on `editUserName` and
// `editUserPass`, covered in `Usuario.api.test.ts` — so there was nothing left
// for these to defend but an unreachable path. The reasoning is written out where
// the function used to be, in `Login.api.ts`.
