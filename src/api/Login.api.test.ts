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
import { comprobarToken, loginUsuario } from "./Login.api";
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
  it("drops the JWT the old login door still returns", async () => {
    // `POST /api/login` still signs a seven-day JWT and sends it back nested
    // inside `usuario`. Nothing in this application sends an `Authorization`
    // header any more — the cookie that same response sets is the credential
    // — so a token kept here would be a week-long credential sitting in
    // memory with no reader at all.
    //
    // This needs an assertion because the compiler cannot see it. Putting
    // `token` back on the session object would be an excess property and fail
    // the typecheck; letting it ride *inside* `usuario` would not, because
    // `response.data` is `any` and `UsuarioInterface` never mentions a token.
    // That is the version of this mistake nothing else would notice.
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
