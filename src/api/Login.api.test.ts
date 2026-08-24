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
import { comprobarToken, confirmarPassword, loginUsuario } from "./Login.api";
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

/**
 * The wrapper that replaced "call the login and read a status code".
 *
 * Its whole job is that nothing but an explicit `true` from the server gets
 * through, so the tests are the list of ways the answer can arrive wrong:
 * `false`, a truthy string, a body with no such field, a 429, a 401, and a
 * network that never answered. All of them are one result — not confirmed —
 * and the caller has no status code to compare against, which is the thing the
 * old check got accidentally right and would eventually have got wrong.
 */
describe("confirmarPassword", () => {
  it("asks POST /api/auth/confirm-password, sending only the password", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { correcta: true } });

    await confirmarPassword("la-mia");

    expect(post).toHaveBeenCalledTimes(1);
    // Anchored at the end so `/auth/login` cannot satisfy it: calling the login
    // here is the defect this endpoint exists to remove.
    expect(post.mock.calls[0][0]).toMatch(/auth\/confirm-password$/);
    expect(post.mock.calls[0][0]).not.toMatch(/login/);
    // The body is the password and nothing else — no username, no id. Which
    // account it is about comes off the session cookie on the server, and a
    // field here would be a field somebody could change.
    expect(post.mock.calls[0][1]).toEqual({ pass: "la-mia" });
  });

  it("confirms only on an explicit true", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { correcta: true } });

    expect(await confirmarPassword("la-mia")).toEqual({ correcta: true, message: null });
  });

  it("does not confirm on a false, and carries the server's sentence", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { correcta: false, message: "Esa no es su contraseña actual." },
    });

    const res = await confirmarPassword("no-es-la-mia");

    expect(res.correcta).toBe(false);
    expect(res.message).toBe("Esa no es su contraseña actual.");
  });

  it("does not confirm on anything that is merely truthy", async () => {
    // `response.data` is `any`. A body answering the string "false" — which is
    // truthy — is what a `!!` here would confirm, and it is not a hypothetical
    // shape: it is what a proxy or a serialiser that stringifies booleans
    // sends.
    for (const correcta of ["false", "true", 1, {}, [], "sí"]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { correcta } });

      expect((await confirmarPassword("x")).correcta, JSON.stringify(correcta)).toBe(false);
    }
  });

  it("does not confirm a 200 whose body has no such field", async () => {
    // The answer an older API version, a proxy with an opinion, or a rewritten
    // endpoint would give. Absence is not consent.
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200, data: {} });

    expect((await confirmarPassword("x")).correcta).toBe(false);
  });

  it("does not confirm when the attempts ran out, and says what happened", async () => {
    // A 429 from the endpoint's own budget. This must never read as an answer
    // about the password in either direction: the person needs to be told to
    // wait, not that they typed it wrong.
    const error = Object.assign(new Error("429"), {
      response: { status: 429, data: { message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." } },
    });
    vi.spyOn(axios, "post").mockRejectedValue(error);

    const res = await confirmarPassword("x");

    expect(res.correcta).toBe(false);
    expect(res.message).toMatch(/Espere/);
  });

  it("does not confirm when the session has ended", async () => {
    const error = Object.assign(new Error("401"), {
      response: { status: 401, data: { message: "Su cuenta ya no está activa." } },
    });
    vi.spyOn(axios, "post").mockRejectedValue(error);

    expect(await confirmarPassword("x")).toEqual({
      correcta: false,
      message: "Su cuenta ya no está activa.",
    });
  });

  it("does not confirm when nothing answered at all, and still has something to show", async () => {
    // No `response`, so no message from the server. A screen with an empty
    // toast is how "it just did nothing" happens.
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const res = await confirmarPassword("x");

    expect(res.correcta).toBe(false);
    expect(res.message).toBe("No se pudo verificar su contraseña. Inténtelo de nuevo.");
  });
});
