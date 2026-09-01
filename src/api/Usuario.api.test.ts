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
import axios from "axios";
import { editUserName, editUserPass, resetMfaUsuario, desbloquearUsuario } from "./Usuario.api";
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

describe("editUserName", () => {
  it("puts the current password on the rename, as a value and not as an empty key", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(YO), user: "isalas", oldPass: "la-mia" });

    expect(put).toHaveBeenCalledTimes(1);
    const cuerpo = cuerpoEnviado(put);
    // The assertion the whole file exists for. Reading the value and not
    // `toHaveProperty`: a key holding `undefined` satisfies the latter and then
    // disappears in serialisation, which is the exact failure being guarded
    // against.
    expect(cuerpo.oldPass).toBe("la-mia");
    // And it survives the trip to JSON, which is what the server reads.
    expect(JSON.parse(JSON.stringify(cuerpo)).oldPass).toBe("la-mia");
    // The password sent is the one supplied, never the record's own `pass`
    // field — a hash, which the server would compare and refuse.
    expect(cuerpo.oldPass).not.toBe(cuenta(YO).pass);
    // And the new name went with it.
    expect(cuerpo.user).toBe("isalas");
  });

  it("addresses the rename endpoint for the account being renamed", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(YO), user: "isalas", oldPass: "la-mia" });

    // Anchored: `usuario/7` (the generic update, whose whitelist refuses `user`
    // outright) and `usuario/userpass/7` are both wrong here, and both would
    // satisfy a looser match.
    expect(put.mock.calls[0][0]).toMatch(/\/usuario\/username\/7$/);
  });

  it("sends no password when an administrator renames somebody else", async () => {
    // The other half of the server's rule, and it has to keep working: there is
    // no password the caller could be expected to know, so `requiresOwnPassword`
    // is false and none is demanded. A key sent as `undefined` is the correct
    // shape — but only because it does not survive serialisation, which is why
    // that is what gets asserted.
    const put = vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    await editUserName({ ...cuenta(OTRA_PERSONA), user: "otro-nombre", oldPass: undefined });

    const enviadoDeVerdad = JSON.parse(JSON.stringify(cuerpoEnviado(put)));
    expect(enviadoDeVerdad).not.toHaveProperty("oldPass");
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
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
      );

      expect(await editUserName({ ...cuenta(YO), oldPass: "la-mia" }), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    // No `response`, so no sentence from the server. A screen with an empty
    // toast is how "it just did nothing" happens.
    vi.spyOn(axios, "put").mockRejectedValue(new Error("network down"));

    expect(await editUserName({ ...cuenta(YO), oldPass: "la-mia" })).toEqual({
      status: 500,
      message: "Error desconocido",
    });
  });

  it("reports a success with no message at all", async () => {
    // `message` absent and not an empty string: the screens fall back to their
    // own wording on a falsy one, so an empty string here would show an error
    // sentence for a rename that worked.
    vi.spyOn(axios, "put").mockResolvedValue({ status: 200, data: {} });

    expect(await editUserName({ ...cuenta(YO), oldPass: "la-mia" })).toEqual({ status: 200 });
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
      { status: 401, message: "La contraseña actual suministrada no es correcta." },
      { status: 429, message: "Demasiados intentos. Espere unos minutos antes de volver a confirmar." },
    ]) {
      vi.restoreAllMocks();
      vi.spyOn(axios, "put").mockRejectedValue(
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
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
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
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
        Object.assign(new Error(String(respuesta.status)), {
          response: { status: respuesta.status, data: { message: respuesta.message } },
        })
      );

      expect(await desbloquearUsuario(7), String(respuesta.status)).toEqual(respuesta);
    }
  });

  it("reports 500 and something to show when nothing answered at all", async () => {
    vi.spyOn(axios, "patch").mockRejectedValue(new Error("network down"));

    expect(await desbloquearUsuario(7)).toEqual({ status: 500, message: "Error desconocido" });
  });

  it("reports a success with no message at all", async () => {
    vi.spyOn(axios, "patch").mockResolvedValue({ status: 200, data: {} });

    expect(await desbloquearUsuario(7)).toEqual({ status: 200 });
  });
});
