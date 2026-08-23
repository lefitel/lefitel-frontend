// @vitest-environment-options { "url": "http://www.osefi.test/" }
//
// What the session provider owes the screen, and what it owes the server.
//
// Three mechanisms live in one file here, and each one of them has already
// been wrong once in a way no test noticed:
//
//   - the countdown to expiry, which used to decode a JWT this app no longer
//     holds, then inferred a window from `GET /auth/me` and slid it locally by
//     mirroring the server's rule. It now reads the deadline the server states
//     on `x-osefi-session-expires`, on every authenticated response, errors
//     included. Both earlier designs announced "five minutes left" to somebody
//     with days left and then logged them out mid-sentence;
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
// got in: the error branch never ran in a single test in this file. The error
// half now carries a second job as well, since an error response slides the
// session just as much as a successful one does.
//
// The page is served from `www.osefi.test` here, not from the API's own origin.
// jsdom's default is `http://localhost:3000`, which is also what
// `VITE_DEV_API_URL` says, so with the default every bare path resolved to our
// own API by pure coincidence of the test environment and the origin guard
// could not be told apart from no guard at all. Two different origins is also
// what production looks like — www.osefi.net and api.osefi.net.

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
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

/** The wire names, spelled out here rather than imported: they are contracts
 * with the other repository, and a test that imported the same constant the
 * code uses would pass just as happily if both were renamed to nonsense. */
const ROLE_HEADER = "x-osefi-role";
const SESSION_EXPIRES_HEADER = "x-osefi-session-expires";

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;

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
  comprobarToken.mockResolvedValue({ status: 401, usuario: null });
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

/** What the server would put in the header for a session dying in `ms`. */
const venceEn = (ms: number) => new Date(Date.now() + ms).toISOString();

const cabeceras = (id_rol?: number | string, vence?: string) => ({
  ...(id_rol === undefined ? {} : { [ROLE_HEADER]: String(id_rol) }),
  ...(vence === undefined ? {} : { [SESSION_EXPIRES_HEADER]: vence }),
});

/**
 * A response from our own API.
 *
 * Either header left out means the header did not arrive at all — which is an
 * ordinary response in both cases, and for the deadline it is the case the
 * absence contract is about: a proxy that strips what it does not recognise
 * produces exactly this.
 */
const respuestaNuestra = (id_rol?: number | string, vence?: string) => ({
  headers: cabeceras(id_rol, vence),
  config: { url: `${url}/api/evento` },
});

/** A response from a host we do not control, carrying whatever it likes. */
const respuestaAjena = (id_rol?: number | string, vence?: string) => ({
  headers: cabeceras(id_rol, vence),
  config: { url: "https://atacante.example/x.jpg" },
});

/**
 * What the error handler sees when our API answers with something other than
 * a 2xx. The headers ride on these too: `authenticate` runs before any
 * controller, so a 422 from a missing field carries the same slid deadline a
 * successful read would have.
 */
const errorNuestro = (status: number, vence?: string) => ({
  response: { status, headers: cabeceras(undefined, vence) },
  config: { url: `${url}/api/evento` },
});

const sesionViva = (id_rol: number, permisos: Permisos) => ({
  status: 200,
  usuario: { id: 7, id_rol },
  permisos,
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
    // One call, the provider's own startup question, and no second one: the
    // deadline used to be fetched with an extra `/auth/me` right after a login
    // and now rides on the header of every response, so a second call here
    // would mean that request came back.
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));

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
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
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
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
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
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
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
    comprobarToken.mockResolvedValueOnce(sesionViva(3, permisosCon("generador", "ver")));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockResolvedValueOnce(sesionViva(1, permisosCon("generador", "crear")));

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
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));

    let resolver!: (value: unknown) => void;
    comprobarToken.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    act(() => {
      onResponse!(respuestaNuestra(1));
    });

    fireEvent.click(getByText("salir"));
    expect(can(3, "generador", "ver")).toBe(false);

    await act(async () => {
      resolver(sesionViva(1, permisosCon("generador", "crear")));
    });

    expect(can(1, "generador", "crear")).toBe(false);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("tries again on the next response when the refresh failed", async () => {
    // The audit's finding: the role the screen was drawn for used to be moved
    // forward *before* asking, so one dropped request satisfied the comparison
    // for good. A demoted technician then spent the rest of the shift looking
    // at the buttons of the role they no longer had, every click answering 403,
    // and nothing ever asked again. Wifi in the field drops; this has to
    // survive one.
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
    comprobarToken.mockClear();
    comprobarToken.mockRejectedValueOnce(new Error("wifi caído"));

    await act(async () => {
      onResponse!(respuestaNuestra(1));
    });

    // The refresh failed, so the screen is honestly unchanged — the session
    // must not end over it, and the old permissions are what was last fetched.
    expect(comprobarToken).toHaveBeenCalledTimes(1);
    expect(can(1, "generador", "crear")).toBe(false);
    expect(can(3, "generador", "ver")).toBe(true);

    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));
    await act(async () => {
      onResponse!(respuestaNuestra(1));
    });

    await waitFor(() => expect(can(1, "generador", "crear")).toBe(true));
    expect(comprobarToken).toHaveBeenCalledTimes(2);
  });

  it("asks once while a refresh is already on its way back", async () => {
    // The other side of the fix above. The header rides on every response, so
    // the three or four that land while one refresh is in flight would each
    // start another — and the reason the old code did not was the very line
    // that broke the retry. The flag replacing it has to hold this on its own.
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
    comprobarToken.mockClear();
    comprobarToken.mockReturnValue(new Promise(() => {}));

    act(() => {
      onResponse!(respuestaNuestra(1));
      onResponse!(respuestaNuestra(1));
      onResponse!(respuestaNuestra(1));
    });

    expect(comprobarToken).toHaveBeenCalledTimes(1);
  });

  it("avisa una sola vez, aunque otra respuesta llegue justo cuando el cerrojo se suelta", async () => {
    // La ventana que quedaba entre las dos mitades del arreglo anterior. El
    // `finally` que suelta el cerrojo corre en la cadena de microtareas de la
    // propia promesa; el commit del `setSesion` que mueve el rol de referencia
    // llega después. En ese hueco el cerrojo ya dice «no hay refresco en
    // vuelo» y el rol de referencia sigue siendo el viejo, así que cualquier
    // respuesta que aterrice ahí —y la cabecera va en todas— vuelve a cumplir
    // la comparación y arranca un segundo `/auth/me` con su segundo «Sus
    // permisos cambiaron». Un cambio de rol, dos avisos idénticos: se declaró
    // como no observable y lo es para quien está delante de la pantalla.
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    await waitFor(() => expect(comprobarToken).toHaveBeenCalledTimes(1));
    comprobarToken.mockClear();

    // El segundo refresco, si llega a salir, también contesta una sesión buena:
    // así el segundo aviso sale de verdad en vez de quedarse en el camino.
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));
    let resolver!: (value: unknown) => void;
    comprobarToken.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));

    act(() => {
      onResponse!(respuestaNuestra(1));
    });
    expect(comprobarToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver(sesionViva(1, permisosCon("generador", "crear")));
      // Las microtareas del `.then` y del `.finally`, sin salir de `act()`:
      // dentro de `act()` React encola el trabajo y no lo aplica hasta el
      // final, así que esto es exactamente la ventana del hallazgo — cerrojo
      // ya soltado, commit todavía sin llegar. No hace falta acertar el número
      // de ticks: de sobra basta.
      for (let i = 0; i < 6; i += 1) await Promise.resolve();
      onResponse!(respuestaNuestra(1));
    });

    expect(comprobarToken).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(can(1, "generador", "crear")).toBe(true);
  });
});

describe("el guardián de origen", () => {
  // El interceptor es global: ve la respuesta de cualquier host al que la
  // aplicación pida algo, y las exportaciones de informes piden imágenes a
  // rutas guardadas en la base de datos. Un host ajeno controla sus propias
  // cabeceras, así que sin este guardián podría fabricar un cambio de rol y
  // empujar el vencimiento de una sesión que no ha tocado.
  it("juzga una URL relativa por el baseURL de la petición, no por el de la página", async () => {
    // `axios` resuelve una URL relativa contra el `baseURL` de la petición, y
    // este guardián tiene que resolverla igual. Resolverla siempre contra
    // `window.location` era una trampa en dos direcciones: el día que alguien
    // ponga un `baseURL` (hoy no hay ningún `axios.create` en el repo), todas
    // las URLs pasan a ser rutas sueltas, todas resuelven al origen del
    // frontend, y la detección de rol y la cuenta atrás se van en silencio —
    // y una respuesta que `axios` mandó a otro host se colaría como nuestra.
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));

    act(() => {
      onResponse!({
        headers: cabeceras(1),
        config: { baseURL: "https://atacante.example/", url: "/api/evento" },
      });
    });

    expect(comprobarToken).not.toHaveBeenCalled();
    expect(can(1, "generador", "crear")).toBe(false);
  });

  it("acepta una URL relativa cuando el baseURL sí es el de nuestra API", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));

    act(() => {
      onResponse!({
        headers: cabeceras(1),
        config: { baseURL: `${url}/`, url: "/api/evento" },
      });
    });

    await waitFor(() => expect(can(1, "generador", "crear")).toBe(true));
  });

  it("descarta una petición sin URL en vez de dejarla pasar", async () => {
    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    comprobarToken.mockClear();
    comprobarToken.mockResolvedValue(sesionViva(1, permisosCon("generador", "crear")));

    act(() => {
      onResponse!({ headers: cabeceras(1), config: {} });
    });

    expect(comprobarToken).not.toHaveBeenCalled();
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
    let resolver!: (value: { status: number; usuario: null }) => void;
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

    resolver({ status: 401, usuario: null });
    await waitFor(() => expect(latest?.loading).toBe(false));
  });

  it("un 200 reconstruye la sesión", async () => {
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));

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
    comprobarToken.mockResolvedValue({ status: 401, usuario: null });

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

  it("no hace una segunda pregunta para averiguar el vencimiento", async () => {
    // Había un efecto aparte que, en cuanto había sesión, pedía otra vez
    // `/auth/me` solo para saber cuándo vencía. Sobra desde que el vencimiento
    // viaja en la cabecera de cada respuesta autenticada, y no era gratis: su
    // `.then` no comprobaba si la sesión seguía existiendo, así que al cerrar
    // sesión antes de que volviera armaba el aviso y el cierre de una sesión
    // muerta — medido, con «tu sesión vence en 5 minutos» delante del
    // formulario de acceso.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );

    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    // Una vuelta más de microtareas: si algún efecto encadenara una segunda
    // pregunta al ver la sesión, ya habría salido.
    await act(async () => { await Promise.resolve(); });
    expect(comprobarToken).toHaveBeenCalledTimes(1);
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
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));
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

    // And the failure is not swallowed — see the next test for what is said
    // about it. Awaited here only so the rejection settles inside the test.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("says so when the server never got the logout, and offers to send it again", async () => {
    // The local cleanup above has to happen either way, but for a while that
    // was the whole story: the request was fired with `.catch(() => undefined)`
    // and a failure left no trace anywhere. The session row stays open and the
    // cookie — a persistent one, with an `expires`, so closing the browser does
    // not drop it — keeps working for up to a week. On the shared field laptop
    // that is the next person opening the ERP inside the previous person's
    // account, with the screen having said "logged out" to both of them.
    const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [mensaje, opciones] = vi.mocked(toast.error).mock.calls[0] as [string, { id?: string; duration?: number; action?: { label: string; onClick: () => void } }];
    // The wording has to say what is actually true — the session may still be
    // open on this machine — rather than "something went wrong", which tells
    // somebody on a shared laptop nothing they can act on.
    expect(mensaje).toContain("puede seguir abierta en este equipo");
    // Not a four-second toast: this one waits to be read.
    expect(opciones.duration).toBe(Infinity);
    expect(opciones.action?.label).toBe("Reintentar");

    // And the offer is real: pressing it sends the same request again, and
    // says so when it lands.
    post.mockResolvedValueOnce({});
    await act(async () => {
      opciones.action!.onClick();
    });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(`${urlApi}auth/logout`);
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const [exito, opcionesExito] = vi.mocked(toast.success).mock.calls[0] as [string, { id?: string }];
    expect(exito).toBe("Sesión cerrada en el servidor.");
    // The same toast, replaced — not a second one next to it. The warning
    // never expires on its own, so without a shared id the screen would end
    // up holding "may still be open" and "closed on the server" at the same
    // time, and pressing the button four times with no signal would stack
    // four copies of the warning.
    expect(opcionesExito.id).toBe(opciones.id);
    expect(opciones.id).toBeTruthy();
  });

  it("un reintento pulsado después de volver a entrar no manda nada", async () => {
    // El defecto que trajo el aviso permanente, y es peor que el silencio que
    // vino a arreglar. `POST /auth/logout` no nombra ninguna sesión: revoca la
    // que diga la cookie en el instante en que sale. El aviso no caduca —eso
    // está bien— así que sigue en pantalla, con su botón, después de que
    // alguien vuelva a entrar en la misma pestaña. Pulsarlo, que es justo lo
    // que el texto pide, revocaba la sesión que se acababa de abrir, contestaba
    // «Sesión cerrada en el servidor.» —la confirmación de lo contrario de lo
    // que pasó— y dejaba la fila abandonada abierta, que era el riesgo del que
    // el aviso avisaba. La secuencia completa está aquí: entrar, salir con el
    // POST caído, volver a entrar, pulsar reintentar.
    const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [, opciones] = vi.mocked(toast.error).mock.calls[0] as [string, { action?: { onClick: () => void } }];
    const reintentar = opciones.action!.onClick;

    // Vuelve la conexión y alguien entra otra vez, en esta misma pestaña: el
    // técnico siguiente, o el mismo. La cookie de ahora es la de esta sesión,
    // no la de la que no se pudo cerrar.
    post.mockClear();
    post.mockResolvedValue({});
    fireEvent.click(getByText("entrar"));
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await act(async () => {
      reintentar();
    });

    // Ni una petición: no hay forma de mandar este reintento sobre una
    // credencial que no es la que falló.
    expect(post).not.toHaveBeenCalled();
    // Y la sesión viva sigue viva, en la pantalla y en los permisos.
    expect(latest?.sesion.autenticado).toBe(true);
    expect(can(3, "generador", "ver")).toBe(true);
    // Sobre todo: no se confirma nada. La confirmación era la mitad peor del
    // fallo — dejaba a la persona tranquila con la fila abandonada abierta.
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("retira el aviso de logout fallido en cuanto hay otra sesión", async () => {
    // La otra mitad, y la que hace que nadie llegue a pulsar el botón: un
    // aviso que no caduca sigue en pantalla mientras la persona trabaja en su
    // sesión nueva, ofreciendo algo que ya no puede hacer. Y no es solo que no
    // pueda: la fila abandonada ya está cerrada, porque el propio login la
    // revoca —`rotateOut` en `api/src/auth/issueSession.ts` cierra la sesión
    // que nombra la cookie entrante, y esa cookie seguía puesta justamente
    // porque el logout no llegó a pasar. Así que el aviso pasó a ser falso, no
    // solo inútil.
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [, opciones] = vi.mocked(toast.error).mock.calls[0] as [string, { id?: string }];
    // Limpio aquí porque el aviso se retira en cada login, tenga algo que
    // retirar o no — lo que se mide es el login de abajo, no el de arriba.
    vi.mocked(toast.dismiss).mockClear();

    fireEvent.click(getByText("entrar"));

    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    expect(toast.dismiss).toHaveBeenCalledWith(opciones.id);
  });

  it("un fallo que aterriza después de volver a entrar no dice nada", async () => {
    // La misma cosa por la otra puerta, y la que el descarte del aviso no
    // cubre: si la petición tarda más en rendirse que la persona en volver a
    // entrar —en un enlace muerto eso es lo normal, no lo raro— el aviso sale
    // *detrás* de una sesión que funciona. Diría «puede seguir abierta» de una
    // fila que el login ya cerró, no caducaría nunca, y traería un botón que
    // el guardián del envío tiene que rechazar. No hay nada que anunciar.
    let rechazar!: (razon: unknown) => void;
    vi.spyOn(axios, "post").mockReturnValue(new Promise((_, reject) => { rechazar = reject; }));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    fireEvent.click(getByText("entrar"));
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    // Solo ahora se rinde la petición de cierre de la sesión anterior.
    await act(async () => {
      rechazar(new Error("network down"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("no confirma nada cuando el reintento vuelve después de que ya hay otra sesión", async () => {
    // El reintento sí salió con la cookie correcta —se pulsó estando fuera— y
    // sí cerró la fila abandonada, así que «Sesión cerrada en el servidor.» no
    // es mentira. Pero llega detrás de una sesión nueva y en pantalla no hay
    // nada que diga de cuál de las dos habla: sobre la única pantalla donde las
    // alarmas tienen que creerse, un mensaje de cierre encima de una sesión que
    // funciona se lee como que esa es la que se cerró. Una vez que la
    // credencial cambió, este mecanismo se calla, en las dos ramas.
    let resolverPost!: (value: unknown) => void;
    vi.spyOn(axios, "post")
      .mockRejectedValueOnce(new Error("network down"))
      .mockReturnValue(new Promise((resolve) => { resolverPost = resolve; }));

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [, opciones] = vi.mocked(toast.error).mock.calls[0] as [string, { action?: { onClick: () => void } }];

    // Se pulsa el reintento estando fuera, así que sale de verdad. Y mientras
    // viaja, alguien entra en esta misma pestaña.
    act(() => {
      opciones.action!.onClick();
    });
    fireEvent.click(getByText("entrar"));
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));

    await act(async () => {
      resolverPost({});
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("no avisa de nada cuando el 401 dice que ya no había sesión que cerrar", async () => {
    // El camino más ordinario que hay: a alguien le vence la sesión con la
    // pestaña abierta, el temporizador llama a `logout()`, y el servidor
    // contesta 401 porque esa credencial ya no vale. No es un fallo al
    // revocar, es que no quedaba nada que revocar — y decirle en un aviso que
    // no caduca que su sesión «puede seguir abierta» sería una falsa alarma
    // servida a todo el mundo, en la única pantalla donde las alarmas tienen
    // que creerse.
    vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401 } });

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    await act(async () => { await Promise.resolve(); });

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not announce anything when the server did close the session", async () => {
    // The other half: the ordinary logout must stay silent. A confirmation
    // toast on every logout is noise for news the person already has — the
    // login form is in front of them — and noise is how people learn to
    // dismiss the toast that matters.
    vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));

    fireEvent.click(getByText("salir"));
    await act(async () => { await Promise.resolve(); });

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
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

  it("no llama al servidor dos veces cuando dos peticiones dan 401 a la vez", async () => {
    // El caso más ordinario que hay: una pantalla que carga tres cosas a la
    // vez y la sesión muere. Las dos respuestas vuelven 401 antes de que React
    // vuelva a renderizar, así que el `hasSessionRef.current = false` que
    // `logout()` escribe a mano — en vez de esperar al efecto que lo
    // sincroniza con el estado — es lo único que impide un segundo POST. Se
    // observa en el mismo tick, sin mirar nada interno.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(can(3, "generador", "ver")).toBe(true));
    post.mockClear();

    await act(async () => {
      const a = onError!({ response: { status: 401 }, config: { url: `${url}/api/evento` } }).catch(() => undefined);
      const b = onError!({ response: { status: 401 }, config: { url: `${url}/api/poste` } }).catch(() => undefined);
      await Promise.all([a, b]);
    });

    expect(post).toHaveBeenCalledTimes(1);
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

  it("dice por qué la pantalla cambió cuando la sesión se cerró desde fuera", async () => {
    // Un administrador revoca la sesión del portátil que alguien dejó en el
    // colectivo, o la ventana de inactividad se agota con la pestaña dormida y
    // ningún temporizador llega a avisar. La persona estaba escribiendo un
    // evento y de golpe está en el formulario de acceso. Hasta aquí no había
    // ni una palabra: nada que distinguiera una revocación de la aplicación
    // rompiéndose. Vencimiento y revocación no se pueden separar desde aquí
    // —el servidor contesta 401 a los dos— así que el texto cubre los dos en
    // vez de adivinar.
    vi.spyOn(axios, "post").mockResolvedValue({});

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

    expect(toast.error).toHaveBeenCalledWith("Tu sesión se cerró. Volvé a iniciar sesión.");
  });

  it("no anuncia ninguna sesión cerrada en un arranque anónimo", async () => {
    // La primera pregunta que hace la página es `/auth/me`, y sin cookie
    // contesta 401. Ese 401 pasa por este mismo manejador, así que sin la
    // guarda de sesión todo el que abre el ERP por la mañana leería que su
    // sesión se cerró antes de haber tenido ninguna.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});

    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.loading).toBe(false));

    await act(async () => {
      await onError!({
        response: { status: 401 },
        config: { url: `${urlApi}auth/me` },
      }).catch(() => undefined);
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
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
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("la cuenta atrás, que sigue lo que dice el servidor", () => {
  // La sesión no vence a una hora fija: cada petición que el servidor
  // contesta empuja el vencimiento otra ventana entera hacia delante. El
  // servidor dice en qué instante muere, en la cabecera de cada respuesta
  // autenticada, y esta cuenta atrás no hace más que apuntar ahí. Antes lo
  // deducía —una ventana medida al cargar la página, empujada a mano en cada
  // 2xx— y las dos mitades de esa deducción estaban mal: la ventana salía de
  // la fila tal como estaba ANTES de que la propia petición la deslizara, y
  // las respuestas de error no contaban aunque deslizaran igual.
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

  /** Una sesión viva, en pantalla, sin ningún vencimiento aprendido todavía. */
  const conSesion = async () => {
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));
    const utils = render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    return utils;
  };

  it("avisa cinco minutos antes del vencimiento que dijo el servidor, y cierra la sesión al llegar", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({});
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

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

  it("mueve el aviso cuando el servidor manda un vencimiento nuevo", async () => {
    // El test que decide el diseño. Con una cuenta atrás congelada en el
    // primer vencimiento, el aviso salta en el minuto 15 aunque la persona
    // haya seguido trabajando: en el servidor esa sesión vence en el minuto
    // 30, no en el 20. Un aviso que salta cuando no toca enseña a la gente a
    // ignorarlo.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(10 * MINUTO);
    // Una petición cualquiera, contestada: el servidor deslizó la fila y lo
    // dice en la cabecera de esa misma respuesta.
    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(6 * MINUTO); // minuto 16: la hora vieja del aviso ya pasó
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(10 * MINUTO); // minuto 26: cinco antes del vencimiento nuevo
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("una respuesta con error también mueve el vencimiento", async () => {
    // El hallazgo que cierra la cabecera. `authenticate` corre antes que
    // cualquier controlador, así que un 422 por un campo que falta deslizó la
    // sesión otra semana igual que una lectura buena. Contar solo los 2xx
    // significaba echar a quien guardó un formulario, recibió el error de
    // validación y siguió trabajando. La regla es «cualquier respuesta que
    // llegó», no «cualquier respuesta 2xx» — y el 500 de aquí también sirve
    // para separar las dos cosas: que renueve, sin cerrar la sesión.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(10 * MINUTO);
    await act(async () => {
      await onError!(errorNuestro(422, venceEn(20 * MINUTO))).catch(() => undefined);
    });

    await avanzar(6 * MINUTO); // minuto 16: la hora vieja del aviso ya pasó
    expect(toast.warning).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(10 * MINUTO); // minuto 26: cinco antes del vencimiento nuevo
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una respuesta de otro host no puede mover el vencimiento", async () => {
    // El reverso de los dos anteriores. Un host cualquiera contestando a una
    // descarga de imagen no ha tocado nuestra sesión, así que no puede
    // empujar su vencimiento — ni retrasar el aviso que protege el trabajo
    // sin guardar — por mucho que mande la cabecera.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(10 * MINUTO);
    act(() => {
      onResponse!(respuestaAjena(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(6 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("una sesión que acaba de entrar aprende su vencimiento de la primera respuesta", async () => {
    // El login no pasa por `authenticate`, así que su respuesta no
    // trae la cabecera: quien entra por el formulario empieza sin plazo
    // ninguno y lo aprende de la primera petición que haga la pantalla —y la
    // pantalla de inicio pide su tablero al montarse. Antes esto se resolvía
    // con una segunda pregunta a `/auth/me`, que es la que ya no se hace.
    comprobarToken.mockResolvedValue({ status: 401, usuario: null });

    render(
      <SesionProvider>
        <Establecer id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Sonda />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    expect(comprobarToken).toHaveBeenCalledTimes(1);

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(16 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("una cabecera ausente no arma nada por sí sola", async () => {
    // «Sin novedad» es lo único que puede significar una cabecera que no
    // llegó. Quien todavía entra con el token antiguo no tiene fila de sesión
    // detrás y el servidor no manda ningún vencimiento, así que no hay nada
    // que contar y no se cuenta.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra());
    });

    await avanzar(60 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una cabecera ausente no cancela el plazo que ya había", async () => {
    // La mitad del contrato que es fácil hacer mal, y la que echa a la gente
    // por una configuración de red: un proxy que quita las cabeceras que no
    // conoce produce exactamente la misma ausencia que un servidor que no
    // manda ninguna. Si la ausencia se leyera como «ya venció», o como una
    // razón para desarmar, ese proxy dejaría a todo el mundo sin aviso o en la
    // calle. El plazo que ya se sabía sigue en pie, ni movido ni borrado.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    await avanzar(10 * MINUTO);
    act(() => {
      onResponse!(respuestaNuestra());
    });

    // Nada ha pasado en el minuto 10 — leer la ausencia como vencimiento se
    // vería aquí, con la sesión cerrada de golpe.
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(6 * MINUTO); // minuto 16, con el aviso puesto en el 15
    expect(toast.warning).toHaveBeenCalledTimes(1);

    await avanzar(5 * MINUTO); // minuto 21, con el vencimiento en el 20
    expect(toast.error).toHaveBeenCalledWith("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
  });

  it("un vencimiento ya pasado no echa a nadie por su cuenta", async () => {
    // Una sesión que el servidor ya considera muerta se cierra cuando el
    // servidor lo dice, con un 401. Armar un temporizador para un plazo
    // negativo lo dispararía de inmediato y echaría a alguien a quien el
    // servidor no ha rechazado todavía — por ejemplo, con el reloj del equipo
    // mal puesto.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(-1 * MINUTO)));
    });

    await avanzar(10 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una fecha de vencimiento ilegible no arma nada", async () => {
    // El servidor manda una cadena, y una cadena puede llegar mal. `NaN` como
    // plazo de un `setTimeout` se comporta como cero: el temporizador salta en
    // el tick siguiente. Nadie debería quedarse fuera porque una fecha viniera
    // torcida.
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, "mañana por la tarde"));
      onResponse!(respuestaNuestra(undefined, "   "));
    });

    await avanzar(10 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });

  it("una sesión más corta que el aviso vence sin avisar, en vez de avisar de golpe", async () => {
    // Cinco minutos de aviso sobre una sesión que dura tres no son un aviso:
    // el plazo sale negativo y `setTimeout` lo dispararía en el tick
    // siguiente, así que la alarma sonaría al cargar la página. Lo que sí
    // tiene que seguir funcionando es el vencimiento en su hora.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(3 * MINUTO)));
    });

    await avanzar(1 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(3 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
    expect(latest?.sesion.autenticado).toBe(false);
    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("un plazo de treinta días espera treinta días, no un tick", async () => {
    // `setTimeout` guarda su plazo en un entero de 32 bits con signo: por
    // encima de ~24,8 días desborda y el temporizador salta en el tick
    // siguiente. Medido con treinta días: `autenticado: false`, un aviso y un
    // error un segundo después de dibujar la página — todas las sesiones del
    // ERP muertas al nacer. Y se llega ahí con una sola edición en el otro
    // repositorio, subir `SESSION_IDLE_DAYS`, que es justamente el cambio que
    // el comentario de este fichero vendía como seguro.
    const post = vi.spyOn(axios, "post").mockResolvedValue({});
    await conSesion();

    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(30 * DIA)));
    });

    await avanzar(2 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    // Hasta el minuto 6 antes del final, cruzando por el camino el techo de
    // los 24,8 días donde el temporizador se rearma por tramos.
    await avanzar(30 * DIA - 8 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);

    await avanzar(2 * MINUTO);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();

    await avanzar(5 * MINUTO);
    expect(toast.error).toHaveBeenCalledWith("Tu sesión expiró. Por favor, volvé a iniciar sesión.");
    expect(latest?.sesion.autenticado).toBe(false);
    expect(post).toHaveBeenCalledWith(`${urlApi}auth/logout`);
  });

  it("cerrar sesión desarma la cuenta atrás", async () => {
    // Sin esto, el aviso y el cierre por vencimiento siguen programados
    // sobre una sesión que ya no existe: alguien que cerró sesión y dejó la
    // pestaña abierta vería «tu sesión vence en 5 minutos» delante del
    // formulario de acceso.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));
    vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    fireEvent.click(getByText("salir"));

    await avanzar(25 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("una sesión nueva no hereda la cuenta atrás de la anterior", async () => {
    // Dos respuestas llegan siempre después de que la sesión terminó: la del
    // propio `logout()` —el servidor escribe la cabecera antes de que el
    // controlador revoque la fila, así que ese vencimiento es viejo por
    // construcción— y cualquier otra que estuviera en vuelo al pulsar salir.
    // Sin la guarda de sesión esas arman el aviso y el cierre de una sesión
    // que ya no existe, y quien vuelve a entrar sin recargar la página hereda
    // la cuenta atrás de la muerta y se lo lleva por delante. Entrar y salir
    // varias veces sin recargar es lo normal en un equipo compartido.
    comprobarToken.mockResolvedValue(sesionViva(3, permisosCon("generador", "ver")));
    vi.spyOn(axios, "post").mockResolvedValue({});

    const { getByText } = render(
      <SesionProvider>
        <Sonda />
        <Entrar id_rol={3} permisos={permisosCon("generador", "ver")} />
        <Salir />
      </SesionProvider>,
    );
    await waitFor(() => expect(latest?.sesion.autenticado).toBe(true));
    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });

    fireEvent.click(getByText("salir"));
    // La respuesta que estaba en vuelo, con el vencimiento de la sesión
    // muerta, aterrizando ahora.
    act(() => {
      onResponse!(respuestaNuestra(undefined, venceEn(20 * MINUTO)));
    });
    fireEvent.click(getByText("entrar"));

    await avanzar(21 * MINUTO);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest?.sesion.autenticado).toBe(true);
  });
});
