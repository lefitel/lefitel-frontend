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
import { render, waitFor, fireEvent } from "@testing-library/react";
import { toast } from "sonner";
import axios from "axios";
import { useContext, useEffect } from "react";
import { SesionProvider } from "./SesionProvider";
import { SesionContext, type contextProps } from "./SesionContext";
import { can, olvidarPermisos, sinPermisos, type Permisos } from "../lib/permissions";
import { url, urlApi } from "../api/url";

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
      autenticado: true,
    });
  }, [id_rol, permisos, setSesion]);
  return null;
};

/** A button wired to the context's `logout`, the way the real sidebar calls it. */
const Salir = () => {
  const { logout } = useContext(SesionContext);
  return <button onClick={() => logout()}>salir</button>;
};

let onResponse: ((response: unknown) => unknown) | null = null;
// The error half of the same interceptor. Capturing only `onResponse`, as
// this file did before, means the auto-logout-on-401 branch never runs in
// any test here — which is exactly how a self-triggered logout loop through
// this same branch went unnoticed.
let onError: ((error: unknown) => Promise<unknown>) | null = null;

/** The last context value handed down, for tests that need to read `loading`
 * or `sesion` directly instead of only through `can()`. */
let latest: contextProps | null = null;
/**
 * Mirrors the context into `latest` on every render.
 *
 * The write happens in an effect and not during render itself — reassigning
 * a module-level variable while rendering is a side effect `eslint-plugin-
 * react-hooks`'s purity rule refuses to allow, and correctly so: this exists
 * only for tests to peek at, never read by anything the component tree
 * itself renders from.
 */
const Sonda = () => {
  const value = useContext(SesionContext);
  useEffect(() => {
    latest = value;
  }, [value]);
  return null;
};

beforeEach(() => {
  vi.clearAllMocks();
  olvidarPermisos();
  localStorage.clear();
  onResponse = null;
  onError = null;
  latest = null;
  // The startup effect (`SesionProvider.tsx`'s own `useEffect`) now calls
  // this unconditionally, on every render in every test in this file, not
  // just the ones about to exercise it on purpose. Anonymous is the safe
  // default: a test that does not care gets the same "no session" answer
  // the removed `localStorage` guardian used to shortcut past, instead of
  // either crashing on an unmocked `vi.fn()` return value or silently
  // overwriting a session a test set up through `<Establecer>`.
  comprobarToken.mockResolvedValue({ status: 401, usuario: null, expires_at: null });
  // The interceptor is registered once, on the global axios. Capturing it is
  // how this test reaches the code without a server to answer.
  vi.spyOn(axios.interceptors.response, "use").mockImplementation(((ok: never, fail: never) => {
    onResponse = ok as unknown as (response: unknown) => unknown;
    onError = fail as unknown as (error: unknown) => Promise<unknown>;
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
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );

    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    expect(can(1, "generador", "crear")).toBe(false);
    // Drop the startup call the `beforeEach` default answered anonymously —
    // what this test counts below is only the role-change refetch.
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { id: 7, id_rol: 1 },
      permisos: permisosCon("generador", "crear"),
    });

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
    // Drop the startup call — this test is about the interceptor, not about
    // whether the provider asked once when it mounted.
    comprobarToken.mockClear();

    // The token is renewed on *every* response. Refreshing permissions each
    // time would double every request the application makes.
    for (let i = 0; i < 5; i += 1) onResponse!(respuestaConToken(tokenFor(3)));

    // `localStorage` no longer holds a copy of the token to poll for, so the
    // session itself (still live, still role 3) is what proves the five
    // responses were processed without tripping the refetch below.
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("ignores a token offered by anything that is not our API", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockClear();

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

describe("el arranque de sesión", () => {
  // El guardián que había en `localStorage` hacía que, sin una clave "token"
  // guardada, el arranque nunca preguntara al servidor. Este describe es la
  // cobertura que el Step 4 de la tarea pide y que antes no existía: sin
  // ella, nada en este fichero probaba el arranque en sí — todas las demás
  // pruebas inyectan la sesión a mano con `<Establecer>`, sin pasar por él.

  it("pregunta al servidor aunque no haya nada en localStorage", async () => {
    // `beforeEach` ya deja `localStorage` vacío y no escribe ninguna clave
    // de sesión — exactamente la bomba que describe el brief: sin guardián,
    // esto tiene que preguntar igual.
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    expect(comprobarToken).toHaveBeenCalledTimes(1);
    // Deja que la respuesta (ya resuelta, anónima) termine de asentarse
    // antes de que el test acabe, o `setLoading(false)` llega después del
    // teardown y React avisa de una actualización de estado fuera de `act()`.
    await waitFor(() => expect(latest?.loading).toBe(false));
  });

  it("loading sigue en true hasta que la respuesta llega", async () => {
    let resolver!: (value: { status: number; usuario: null; expires_at: null }) => void;
    comprobarToken.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    expect(latest?.loading).toBe(true);
    // Un tick de microtareas de más, sin que la promesa se resuelva: seguir
    // cargando, no una casualidad del primer render.
    await Promise.resolve();
    expect(latest?.loading).toBe(true);

    resolver({ status: 401, usuario: null, expires_at: null });
    await waitFor(() => expect(latest?.loading).toBe(false));
  });

  it("un 200 reconstruye la sesión", async () => {
    comprobarToken.mockResolvedValue({
      status: 200,
      usuario: { id: 7, id_rol: 3 },
      permisos: permisosCon("generador", "ver"),
      expires_at: null,
    });

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    expect(latest?.loading).toBe(false);
    expect(can(3, "generador", "ver")).toBe(true);
  });

  it("un 401 deja el estado anónimo, sin toasts de error", async () => {
    comprobarToken.mockResolvedValue({ status: 401, usuario: null, expires_at: null });

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));
    expect(latest?.sesion.autenticado).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  // Before this branch, dropping the token from localStorage ended the only
  // credential the browser held. Now the browser also holds an httpOnly
  // session cookie nothing in this file can see or clear directly — only the
  // server can revoke it and tell the browser to drop it. Without a call to
  // the server, "logging out" on a shared computer left that cookie alive,
  // sliding, for up to a week.
  it("tells the server the session is over", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));

    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("clears the local session right away, without waiting on the server call", async () => {
    // The scenario this exists for: a shared laptop in the field, someone
    // clicks "log out", and either the network or the session itself is
    // already gone. They must not be left looking authenticated on a screen
    // that already sent them back to the login form.
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));

    // Checked synchronously, with no `await`: the local cleanup must not sit
    // behind the network call at all, so a version that `await`s the server
    // before clearing has nothing to show here yet. `localStorage` no longer
    // holds anything session-related to check instead, so this reads the
    // same signal `olvidarPermisos()` exists to produce: nobody is left able
    // to do anything the old role could.
    expect(can(3, "generador", "ver")).toBe(false);
  });

  it("does not call the server when there is no session to close", async () => {
    // Nothing logged in this render at all (no <Establecer>) — the ordinary
    // case a cheap guard exists for, not the loop the next test is about.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Salir />
      </SesionProvider>,
    );

    fireEvent.click(getByText("salir"));

    expect(post).not.toHaveBeenCalled();
    // Let the provider's own startup check (mounted along with everything
    // else above, answered anonymously by the `beforeEach` default) settle
    // before the test ends, so its `setLoading(false)` does not land after
    // teardown and warn about a state update outside of `act()`.
    await waitFor(() => expect(latest?.loading).toBe(false));
  });

  it("does not call logout again when the 401 came from logout's own request", async () => {
    // The self-triggered loop this exists to break: a session that has
    // already died makes *any* request come back 401, the interceptor's
    // error handler reacts by calling logout(), logout() posts to its own
    // endpoint with that same dead credential, that request also 401s, and
    // the interceptor sees a 401 again. Without an exclusion, that last step
    // calls logout() a second time — which posts again, forever.
    //
    // A session is established below (not skipped, unlike the test above)
    // on purpose: with an active session, the cheap "nothing to close" guard
    // would not save this test on its own, so a second POST here can only
    // mean the interceptor called logout() again for the request that IS
    // its own logout call.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    post.mockClear();

    // Exactly what the interceptor sees once the logout call itself fails:
    // a 401 whose request was the logout endpoint.
    await onError!({
      response: { status: 401 },
      config: { url: `${urlApi}auth/logout` },
    }).catch(() => undefined);

    expect(post).not.toHaveBeenCalled();
  });
});
