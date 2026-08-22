// What happens to the screen when somebody's role changes while they are using it.
//
// The server has always read the role from the database on every request and put
// the fresh one into the token it hands back. The client adopted the new token
// and kept the permissions it was given at login, so the change was invisible
// until the page was reloaded: somebody promoted kept seeing the smaller
// application, and somebody demoted kept seeing buttons whose only outcome was
// a 403. The server was refusing correctly the whole time — the screen was the
// part that lied.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import axios from "axios";
import { useContext, useEffect } from "react";
import { SesionProvider } from "./SesionProvider";
import { SesionContext } from "./SesionContext";
import { can, olvidarPermisos, sinPermisos, type Permisos } from "../lib/permissions";
import { url } from "../api/url";

const comprobarToken = vi.fn();
vi.mock("../api/Login.api", () => ({
  comprobarToken: (...args: unknown[]) => comprobarToken(...args),
}));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

/** A token whose body says what we need it to say. Never verified client-side. */
const tokenFor = (id_rol: number) => {
  const body = btoa(JSON.stringify({ id: 7, id_rol, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecera.${body}.firma`;
};

const permisosCon = (modulo: keyof Permisos, accion: "ver" | "crear"): Permisos => {
  const out = sinPermisos();
  out[modulo][accion] = true;
  return out;
};

/** Puts a session in place, the way the login screen does: through the context. */
const Establecer = ({ id_rol, permisos }: { id_rol: number; permisos: Permisos }) => {
  const { setSesion } = useContext(SesionContext);
  useEffect(() => {
    setSesion({
      token: tokenFor(id_rol),
      usuario: { id: 7, id_rol } as never,
      permisos,
    });
  }, [id_rol, permisos, setSesion]);
  return null;
};

let onResponse: ((response: unknown) => unknown) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  olvidarPermisos();
  localStorage.clear();
  onResponse = null;
  // The interceptor is registered once, on the global axios. Capturing it is
  // how this test reaches the code without a server to answer.
  vi.spyOn(axios.interceptors.response, "use").mockImplementation(((ok: never) => {
    onResponse = ok as unknown as (response: unknown) => unknown;
    return 1;
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A response from our own API carrying a renewed token. */
const respuestaConToken = (token: string) => ({
  headers: { "x-new-token": token },
  config: { url: `${url}/api/evento` },
});

describe("a role that changes mid-session", () => {
  it("fetches the new permissions and redraws with them", async () => {
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { id: 7, id_rol: 1 },
      permisos: permisosCon("generador", "crear"),
    });

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );

    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    expect(can(1, "generador", "crear")).toBe(false);

    // The server hands back a token for role 1: this person was promoted.
    onResponse!(respuestaConToken(tokenFor(1)));

    await waitFor(() => expect(can(1, "generador", "crear")).toBe(true));
    expect(comprobarToken).toHaveBeenCalledTimes(1);
  });

  it("does not ask again while the role is the same", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    // The token is renewed on *every* response. Refreshing permissions each
    // time would double every request the application makes.
    for (let i = 0; i < 5; i += 1) onResponse!(respuestaConToken(tokenFor(3)));

    await waitFor(() => expect(localStorage.getItem("token")).toBe(tokenFor(3)));
    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("ignores a token offered by anything that is not our API", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    // The interceptor sees every request the application makes, including the
    // image fetches against paths out of the database. A host named by one of
    // those values must not be able to hand us a session.
    onResponse!({
      headers: { "x-new-token": tokenFor(1) },
      config: { url: "https://atacante.example/x.jpg" },
    });

    expect(comprobarToken).not.toHaveBeenCalled();
    expect(can(1, "generador", "crear")).toBe(false);
  });
});
