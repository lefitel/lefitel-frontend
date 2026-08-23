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
// same file's `attributes` list projects (`:173`).

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { comprobarToken } from "./Login.api";
import { sinPermisos } from "../lib/permissions";

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
    expect(res.expires_at).toBe("2026-08-30T00:00:00.000Z");
  });

  it("folds a 401 (no session) into an anonymous result, not an exception", async () => {
    const error = Object.assign(new Error("401"), { response: { status: 401 } });
    vi.spyOn(axios, "get").mockRejectedValue(error);

    const res = await comprobarToken();

    expect(res).toEqual({ status: 401, usuario: null, expires_at: null });
  });

  it("reports 500 — not 401 — for a failure that carries no status, so a dead network is not mistaken for 'no session'", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network down"));

    const res = await comprobarToken();

    expect(res.status).toBe(500);
    expect(res.usuario).toBeNull();
    expect(res.expires_at).toBeNull();
  });
});
