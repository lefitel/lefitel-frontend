// What the session provider owes the screen, and what it owes the server.
//
// Three mechanisms live in one file here, and each one of them has already
// been wrong once in a way no test noticed:
//
//   - the countdown to expiry, which used to decode a JWT this app no longer
//     holds, and whose whole difficulty is that the session *slides*: a
//     deadline read once and never revised announces "five minutes left" to
//     somebody with days left, and then logs them out mid-sentence;
//   - the role change, which used to be noticed by decoding a re-signed token
//     out of `x-new-token` — a header the server stopped sending, so the
//     mechanism was still in the code and had quietly stopped running. It now
//     reads `x-osefi-role`;
//   - the 401, which ends the session, and which arrives on `logout()`'s own
//     request too. Reacting to that one by logging out again is a loop that
//     sustains itself.
//
// Both halves of the interceptor are captured below — the success handler and
// the error handler. Capturing only the first is exactly how the loop above
// got in: the error branch never ran in a single test in this file.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, fireEvent, act } from "@testing-library/react";
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

/** The wire name, spelled out here rather than imported: it is a contract with
 * the other repository, and a test that imported the same constant the code
 * uses would pass just as happily if both were renamed to nonsense. */
const ROLE_HEADER = "x-osefi-role";

const MINUTO = 60 * 1000;

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
      usuario: { id: 7, id_rol } as never,
      permisos,
      autenticado: true,
    });
  }, [id_rol, permisos, setSesion]);
  return null;
};

/**
 * A button that puts a session in place on demand, the way the login screen
 * does. `<Establecer>` does the same thing on mount, which is what most tests
 * want; this one is for the tests that need a *second* login after a logout,
 * in the same page.
 */
const Entrar = ({ id_rol, permisos }: { id_rol: number; permisos: Permisos }) => {
  const { setSesion } = useContext(SesionContext);
  return (
    <button onClick={() => setSesion({ usuario: { id: 7, id_rol } as never, permisos, autenticado: true })}>
      entrar
    </button>
  );
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
/**
 * The spy that captures `onResponse`/`onError` above, kept by reference so a
 * test can read `.mock.invocationCallOrder` off it — the call-order test
 * compares it against `comprobarToken`'s to pin which of the two runs first.
 */
let responseUseSpy: ReturnType<typeof vi.spyOn> | null = null;

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
  onResponse = null;
  onError = null;
  latest = null;
  // The startup effect calls this on every render in every test in this file,
  // not just the ones about to exercise it on purpose. Anonymous is the safe
  // default: a test that does not care gets a plain "no session" answer
  // instead of either crashing on an unmocked `vi.fn()` return value or
  // silently overwriting a session a test set up through `<Establecer>`.
  comprobarToken.mockResolvedValue({ status: 401, usuario: null, expires_at: null });
  // The interceptor is registered once, on the global axios. Capturing it is
  // how this test reaches the code without a server to answer.
  responseUseSpy = vi.spyOn(axios.interceptors.response, "use").mockImplementation(((ok: never, fail: never) => {
    onResponse = ok as unknown as (response: unknown) => unknown;
    onError = fail as unknown as (error: unknown) => Promise<unknown>;
    return 1;
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A response from our own API.
 *
 * `id_rol` left out means no role header at all — an ordinary response, which
 * is what most of them are once the countdown is the only thing reading them.
 */
const respuestaNuestra = (id_rol?: number | string) => ({
  headers: id_rol === undefined ? {} : { [ROLE_HEADER]: String(id_rol) },
  config: { url: `${url}/api/evento` },
});

/** A response from a host we do not control, carrying whatever it likes. */
const respuestaAjena = (id_rol?: number | string) => ({
  headers: id_rol === undefined ? {} : { [ROLE_HEADER]: String(id_rol) },
  config: { url: "https://atacante.example/x.jpg" },
});

/** What the server would put in `expires_at` for a session dying in `ms`. */
const venceEn = (ms: number) => new Date(Date.now() + ms).toISOString();

const sesionViva = (id_rol: number, permisos: Permisos, expires_at: string | null) => ({
  status: 200,
  usuario: { id: 7, id_rol },
  permisos,
  expires_at,
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
    // Two calls, both of them the provider's own housekeeping: the startup
    // question, and the deadline lookup a session that arrived through the
    // login screen needs. Waited for rather than assumed, so the count below
    // cannot pick up a straggler.
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear"), null));

    // The server says this request was answered for role 1: this person was
    // promoted while the page was open.
    act(() => {
      onResponse!(respuestaNuestra(1));
    });

    await waitFor(() => expect(can(1, "generador", "crear")).toBe(true));
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith("Sus permisos cambiaron. La pantalla se actualizó.");
  });

  it("does not ask again while the role is the same", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));
    comprobarToken.mockClear();

    // The header rides on *every* response. Refreshing permissions each time
    // would double every request the application makes.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        onResponse!(respuestaNuestra(3));
      });
    }

    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("ignores a role offered by anything that is not our API", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));
    comprobarToken.mockClear();

    // The interceptor sees every request the application makes, including the
    // image fetches against paths out of the database. A host named by one of
    // those values controls its own headers and its own CORS, so it can send
    // this one — and must buy nothing with it.
    act(() => {
      onResponse!(respuestaAjena(1));
    });

    expect(comprobarToken).not.toHaveBeenCalled();
    expect(can(1, "generador", "crear")).toBe(false);
  });

  it("ignores a role header that is blank or not a number", async () => {
    // `Number("")` is 0, and 0 is a perfectly ordinary-looking role id: a
    // header that arrived empty would read as a change away from every real
    // role, refetching permissions on every single response for as long as
    // whatever produced the empty header kept producing it.
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));
    comprobarToken.mockClear();

    act(() => {
      onResponse!(respuestaNuestra(""));
      onResponse!(respuestaNuestra("   "));
      onResponse!(respuestaNuestra("coordinador"));
      onResponse!(respuestaNuestra("1.5"));
    });

    expect(comprobarToken).not.toHaveBeenCalled();
  });

  it("still refreshes permissions when the session came from startup, not from a fresh login", async () => {
    // Every other test in this describe seeds the session through
    // <Establecer>, which is the login screen's path. A session restored from
    // `/auth/me` on a reload is the other one, and it is the one where the
    // guards inside this mechanism have been wrong before.
    comprobarToken.mockResolvedValueOnce(sesionViva(3, permisosCon("generador", "ver"), null));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockResolvedValueOnce(sesionViva(1, permisosCon("generador", "crear"), null));

    act(() => {
      onResponse!(respuestaNuestra(1));
    });

    await waitFor(() => expect(can(1, "generador", "crear")).toBe(true));
    expect(toast.info).toHaveBeenCalledWith("Sus permisos cambiaron. La pantalla se actualizó.");
  });

  it("does not put the permissions back when the refresh lands after a logout", async () => {
    // The window: the role header arrives, the refetch goes out, and the
    // person clicks "log out" before it comes back. Applying the answer then
    // would restore permissions `logout()` had just forgotten — on a screen
    // showing the login form — and announce that it had updated something.
    vi.spyOn(axios, "post").mockResolvedValue({});
    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));

    let resolver!: (value: unknown) => void;
    comprobarToken.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    act(() => {
      onResponse!(respuestaNuestra(1));
    });

    fireEvent.click(getByText("salir"));
    expect(can(3, "generador", "ver")).toBe(false);

    await act(async () => {
      resolver(sesionViva(1, permisosCon("generador", "crear"), null));
    });

    expect(can(1, "generador", "crear")).toBe(false);
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe("el arranque de sesión", () => {
  it("pregunta al servidor, siempre, porque la cookie no se puede leer", async () => {
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
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), null));

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

describe("el orden de los efectos: interceptor antes que el arranque", () => {
  // `axios` congela la cadena de interceptores de respuesta de forma
  // síncrona, dentro de la propia llamada a `request()` — lee lo que haya en
  // `axios.interceptors.response` en ese instante, no lo que se registre
  // después (verificado leyendo `axios/lib/core/Axios.js`, no adivinado).
  // Los efectos de un componente se montan en el orden en que están
  // escritos, así que la petición de arranque solo pasa realmente por el
  // interceptor si el efecto que lo registra está declarado ANTES del que
  // dispara el `axios.get`. Este test fija ese orden — no el comportamiento
  // resultante, que ya cubren los tests de arriba y de "logout" — para que
  // nadie pueda reordenar los dos `useEffect` sin que algo se ponga rojo.
  it("registers the response interceptor before asking the server at startup", () => {
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    expect(responseUseSpy).not.toBeNull();
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    const interceptorOrder = responseUseSpy!.mock.invocationCallOrder[0];
    const startupOrder = comprobarToken.mock.invocationCallOrder[0];
    expect(interceptorOrder).toBeLessThan(startupOrder);
  });
});

describe("logout", () => {
  // The browser holds an httpOnly session cookie nothing in this file can see
  // or clear directly — only the server can revoke it and tell the browser to
  // drop it. Without a call to the server, "logging out" on a shared computer
  // left that cookie alive, sliding, for up to a week.
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

  it("tells the server the session is over even when the session was restored at startup", async () => {
    // El hallazgo más grave de la ronda de correcciones de la tarea 5: una
    // sesión recuperada por `/auth/me` al arrancar nunca tenía `token`, y
    // `hasSessionRef` se derivaba de `Boolean(sesion.token)`. Con eso, el
    // `if` de `logout()` que decide si avisar al servidor se quedaba en
    // `false` para siempre en una sesión recuperada al recargar: la pantalla
    // iba al login pero la fila de sesión seguía viva y la cookie seguía en
    // el navegador. El campo `token` ya no existe, así que ese error concreto
    // ya no se puede volver a escribir — pero este camino, el único donde
    // existía, sigue necesitando su prueba: es el que no pasa por
    // `<Establecer>`.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), null));
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

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
        <Sonda />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));

    // Checked synchronously, with no `await`: the local cleanup must not sit
    // behind the network call at all, so a version that `await`s the server
    // before clearing has nothing to show here yet. This reads the signal
    // `olvidarPermisos()` exists to produce — nobody is left able to do
    // anything the old role could.
    expect(can(3, "generador", "ver")).toBe(false);
    expect(latest?.sesion.autenticado).toBe(false);
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

  it("ends the session on a 401 from any other request", async () => {
    // The other half of the same handler, and the reason the exclusion above
    // has to be an exclusion and not a blanket "ignore 401s": a 401 anywhere
    // else is the server saying the session is over, and it is the only
    // signal that says so truthfully.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    await act(async () => {
      await onError!({
        response: { status: 401 },
        config: { url: `${url}/api/evento` },
      }).catch(() => undefined);
    });

    expect(latest?.sesion.autenticado).toBe(false);
    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("leaves the session alone on a 403", async () => {
    // A 403 is an ordinary answer to an ordinary request: somebody opened a
    // report that is not theirs. Logging them out for it throws away whatever
    // they were writing elsewhere on the screen.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    await act(async () => {
      await onError!({
        response: { status: 403 },
        config: { url: `${url}/api/reporte` },
      }).catch(() => undefined);
    });

    expect(latest?.sesion.autenticado).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("la cuenta atrás, que se desliza con la sesión", () => {
  // La sesión no vence a una hora fija: cada petición que el servidor
  // contesta empuja el vencimiento otra ventana entera hacia delante. Una
  // cuenta atrás leída una vez y nunca revisada avisa «te quedan cinco
  // minutos» a alguien que tiene días, y después lo echa. Estos tests fijan
  // que la cuenta atrás se mueve con lo que de verdad la mueve: las
  // respuestas de nuestra API.
  beforeEach(() => {
    // `shouldAdvanceTime` deja que el tiempo real siga corriendo por debajo,
    // así `waitFor` y las promesas siguen funcionando mientras `Date.now()` y
    // los temporizadores son nuestros para moverlos a mano.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const avanzar = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  it("avisa cinco minutos antes del vencimiento que dio el servidor, y cierra la sesión al llegar", async () => {
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(14 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();

    await avanzar(2 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(4 * MINUTO);
    expect(toast.error).toHaveBeenCalledWith("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
    expect(latest?.sesion.autenticado).toBe(false);
    // Y se lo dice al servidor: la fila de sesión y la cookie no se cierran
    // solas por el hecho de que un temporizador del navegador se dispare.
    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("no avisa a la hora vieja cuando la sesión se ha ido renovando", async () => {
    // El test que decide el diseño. Con una cuenta atrás congelada en el
    // `expires_at` del arranque, el aviso salta en el minuto 15 aunque la
    // persona haya seguido trabajando: en el servidor esa sesión vence en el
    // minuto 30, no en el 20. Un aviso que salta cuando no toca enseña a la
    // gente a ignorarlo.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(10 * MINUTO);
    // Una petición cualquiera de la aplicación, contestada por el servidor:
    // eso, y solo eso, es lo que empuja el vencimiento de la fila.
    act(() => {
      onResponse!(respuestaNuestra());
    });

    await avanzar(6 * MINUTO); // minuto 16: la hora vieja del aviso ya pasó
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(10 * MINUTO); // minuto 26: cinco antes del vencimiento nuevo
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("una respuesta de otro host no renueva nada", async () => {
    // El reverso del test anterior. Un host cualquiera contestando a una
    // descarga de imagen no ha tocado nuestra sesión, así que no puede
    // empujar su vencimiento — ni retrasar el aviso que protege el trabajo
    // sin guardar.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(10 * MINUTO);
    act(() => {
      onResponse!(respuestaAjena());
    });

    await avanzar(6 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("una respuesta con error tampoco renueva nada", async () => {
    // El manejador de error no llama a la renovación, y es a propósito: un
    // 401 es justo la respuesta que prueba que la sesión NO está viva. Se
    // usa un 500 aquí para separar las dos cosas — que no renueve, sin que
    // además cierre la sesión.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(10 * MINUTO);
    await act(async () => {
      await onError!({
        response: { status: 500 },
        config: { url: `${url}/api/evento` },
      }).catch(() => undefined);
    });

    await avanzar(6 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una sesión que acaba de entrar pregunta su vencimiento al servidor", async () => {
    // `POST /api/login` contesta con el usuario y los permisos, y ningún
    // vencimiento. Sin esta pregunta, la cuenta atrás existiría solo para
    // quien recarga la página — y la forma normal de entrar al ERP es el
    // formulario de acceso. Eso es exactamente cómo murió `x-new-token`: un
    // mecanismo presente en el código que no llegaba a ejecutarse nunca.
    comprobarToken
      .mockResolvedValueOnce({ status: 401, usuario: null, expires_at: null })
      .mockResolvedValueOnce(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));

    await avanzar(16 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("no vuelve a preguntar cuando el arranque ya trajo el vencimiento", async () => {
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    await avanzar(0);

    expect(comprobarToken).toHaveBeenCalledTimes(1);
  });

  it("un vencimiento nulo no arma nada, y no se pregunta dos veces", async () => {
    // Quien todavía entra con el token antiguo no tiene fila de sesión
    // detrás, así que `/auth/me` contesta `expires_at: null`. «Preguntado, y
    // no hay nada que contar» es una respuesta, no una respuesta que falta:
    // sin distinguirlas, esto preguntaría otra vez en cada carga de página.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), null));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(60 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
    expect(comprobarToken).toHaveBeenCalledTimes(1);
  });

  it("un vencimiento ya pasado no echa a nadie por su cuenta", async () => {
    // Una sesión que el servidor ya considera muerta se cierra cuando el
    // servidor lo dice, con un 401. Armar un temporizador para un plazo
    // negativo lo dispararía de inmediato y echaría a alguien a quien el
    // servidor no ha refusado todavía — por ejemplo, con el reloj del equipo
    // mal puesto.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(-1 * MINUTO)));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(10 * MINUTO);
    // Neither timer: a negative delay handed to `setTimeout` fires on the
    // next tick, so a missing "only if it is still in the future" guard shows
    // up here as an instant warning, an instant logout, or both.
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una fecha de vencimiento ilegible no arma nada", async () => {
    // El servidor manda una cadena, y una cadena puede llegar mal. `NaN` como
    // plazo de un `setTimeout` se comporta como cero: el temporizador salta en
    // el tick siguiente. Nadie debería quedarse fuera porque una fecha viniera
    // torcida.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), "mañana por la tarde"));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(10 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una sesión más corta que el aviso vence sin avisar, en vez de avisar de golpe", async () => {
    // Cinco minutos de aviso sobre una sesión que dura tres no son un aviso:
    // el plazo sale negativo y `setTimeout` lo dispara en el tick siguiente,
    // así que la alarma sonaría al cargar la página. Lo que sí tiene que
    // seguir funcionando es el vencimiento en su hora.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(3 * MINUTO)));
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await avanzar(1 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(3 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
    expect(latest?.sesion.autenticado).toBe(false);
    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("una sesión nueva, después de cerrar la anterior, vuelve a preguntar su vencimiento", async () => {
    // Todo lo que se aprendió de la sesión anterior se olvida al cerrarla: la
    // ventana, y también el hecho de haber preguntado. Si lo segundo se
    // quedara puesto, quien vuelve a entrar sin recargar la página se queda
    // sin cuenta atrás durante toda la sesión nueva — y en un equipo
    // compartido, entrar y salir varias veces sin recargar es lo normal.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));
    vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    fireEvent.click(getByText("salir"));
    expect(latest?.sesion.autenticado).toBe(false);

    fireEvent.click(getByText("entrar"));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(2));

    await avanzar(16 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("cerrar sesión desarma la cuenta atrás", async () => {
    // Sin esto, el aviso y el cierre por vencimiento siguen programados
    // sobre una sesión que ya no existe: alguien que cerró sesión y dejó la
    // pestaña abierta vería «tu sesión vence en 5 minutos» delante del
    // formulario de acceso.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver"), venceEn(20 * MINUTO)));
    vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    fireEvent.click(getByText("salir"));

    await avanzar(25 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
