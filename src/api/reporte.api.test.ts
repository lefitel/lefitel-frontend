// The six fixed reports, now asked for with `GET` and a filter in the URL.
//
// The move is task C1 of the API standard: these six read and write nothing, and
// a `PUT` that changes nothing misleads every cache, proxy and retry in the
// path. The change itself is one word per function. What is not obvious, and
// what this file is for, is that **the filter has to survive being a URL**.
//
// Three of its five values change form on the way out, and each one fails
// differently and quietly:
//
//   - `fechaInicial` and `fechaFinal` are `Date` objects. Serialised as anything
//     other than an ISO string they reach the server as an invalid date, which
//     it now refuses with a 400 — every report, every time.
//   - `tramo` is the id of the stretch to narrow by, and a screen with none
//     chosen has to leave the key out: the server answers 400 to `tramo=`
//     with nothing after it, and to the text "null" as well.
//   - `excludeOld` is a boolean, and it is the dangerous one: dropped from the
//     URL, the server falls back to its default, which today is the same value.
//     Nothing breaks and nothing is visible — until the default changes, or
//     until somebody reads the request log and sees a filter that never mentions
//     the switch the screen shows.
//
// So these assertions are about the wire, not about the call: what is read is
// the URL axios actually built.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import {
  getReporteGeneral, getReporteTramo, getReporteRecorrido,
  getEstadoRed, getObsFrecuencia, getTiemposResumen,
} from "./reporte.api";
import type { ReporteInterface } from "../interfaces/interfaces";

afterEach(() => {
  vi.restoreAllMocks();
});

const FILTRO: ReporteInterface = {
  fechaInicial: new Date("2026-01-01T00:00:00.000Z"),
  fechaFinal: new Date("2026-03-31T23:59:59.000Z"),
  excludeOld: false,
};

const espia = () => vi.spyOn(axios, "get").mockResolvedValue({ data: [] });

/**
 * The URL axios would really send, built the way axios builds it.
 *
 * Reading `mock.calls[0][1].params` would assert the object handed to axios,
 * which is the object this file already has. What can be wrong is what axios
 * makes of it, so the serialiser is run and its output is what gets checked.
 */
const urlEnviada = (get: ReturnType<typeof espia>) => {
  const [url, config] = get.mock.calls[0] as [string, { params: Record<string, unknown> }];
  return axios.getUri({ url, params: config.params });
};

describe("the six go out as GET", () => {
  it("asks each report at its own address", async () => {
    const casos: [() => Promise<unknown>, string][] = [
      [() => getReporteGeneral(FILTRO), "general"],
      [() => getReporteTramo(FILTRO), "tramo"],
      [() => getReporteRecorrido({ ...FILTRO, tramo: 3 }), "recorrido"],
      [() => getEstadoRed({}), "estado-red"],
      [() => getObsFrecuencia({ fechaInicial: FILTRO.fechaInicial, fechaFinal: FILTRO.fechaFinal }), "frecuencia-obs"],
      [() => getTiemposResumen({ fechaInicial: FILTRO.fechaInicial, fechaFinal: FILTRO.fechaFinal }), "resumen-tiempos"],
    ];

    for (const [llamar, nombre] of casos) {
      const get = espia();
      await llamar();
      expect(get, nombre).toHaveBeenCalledTimes(1);
      expect(String(get.mock.calls[0][0]), nombre).toMatch(new RegExp(`/reporte/${nombre}$`));
      vi.restoreAllMocks();
    }
  });

  it("uses no other verb, which is the whole point of the task", async () => {
    // Anchored on `axios.put` never being touched: half a migration — three
    // functions moved and three left — is the shape this most plausibly takes,
    // and every one of the six is exercised above.
    const put = vi.spyOn(axios, "put");
    espia();

    await getReporteGeneral(FILTRO);
    await getEstadoRed({});

    expect(put).not.toHaveBeenCalled();
  });
});

describe("what the filter looks like once it is a URL", () => {
  it("sends the two dates as ISO strings the server can parse", async () => {
    const get = espia();

    await getReporteGeneral(FILTRO);

    // Unencoded colons: that is what axios's own serialiser produces, and it is
    // legal in a query string. Asserted as the literal it really sends rather
    // than as a percent-encoded guess, so this test fails if the shape changes
    // and not merely if the encoding does.
    const url = urlEnviada(get);
    expect(url).toContain("fechaInicial=2026-01-01T00:00:00.000Z");
    expect(url).toContain("fechaFinal=2026-03-31T23:59:59.000Z");
  });

  it("leaves the key out when no tramo was chosen, instead of sending the word null", async () => {
    // Five of the six take `tramo` as optional. The server refuses one it
    // cannot read (`tramo=` and `tramo=null` are both 400), so the screens omit
    // the key and nothing about it may appear in the URL.
    const get = espia();

    await getReporteGeneral(FILTRO);

    expect(urlEnviada(get)).not.toContain("ramo");
  });

  it("sends the tramo when there is one, as its id", async () => {
    const get = espia();

    await getReporteRecorrido({ ...FILTRO, tramo: 14 });

    const url = urlEnviada(get);
    expect(url).toContain("tramo=14");
    expect(url).not.toContain("TramoInicial");
    expect(url).not.toContain("TramoFinal");
  });

  it("passes the tramo through on the three summaries when given, and not otherwise", async () => {
    const periodo = { fechaInicial: FILTRO.fechaInicial, fechaFinal: FILTRO.fechaFinal };
    const resumenes: [string, (tramo?: number) => Promise<unknown>][] = [
      ["estado-red", (tramo) => getEstadoRed({ ...periodo, ...(tramo !== undefined ? { tramo } : {}) })],
      ["frecuencia-obs", (tramo) => getObsFrecuencia({ ...periodo, ...(tramo !== undefined ? { tramo } : {}) })],
      ["resumen-tiempos", (tramo) => getTiemposResumen({ ...periodo, ...(tramo !== undefined ? { tramo } : {}) })],
    ];

    for (const [nombre, llamar] of resumenes) {
      const con = espia();
      await llamar(14);
      expect(urlEnviada(con), nombre).toContain("tramo=14");
      vi.restoreAllMocks();

      const sin = espia();
      await llamar();
      expect(urlEnviada(sin), nombre).not.toContain("ramo");
      vi.restoreAllMocks();
    }
  });

  it("sends excludeOld even when it is false", async () => {
    // The one value whose absence is indistinguishable from its default. The
    // server reads the two words and refuses anything else, so `false` has to
    // arrive as `false` and not be dropped for being falsy.
    const get = espia();

    await getReporteGeneral({ ...FILTRO, excludeOld: false });

    expect(urlEnviada(get)).toContain("excludeOld=false");
  });

  it("sends excludeOld as true when it is on", async () => {
    const get = espia();

    await getReporteGeneral({ ...FILTRO, excludeOld: true });

    expect(urlEnviada(get)).toContain("excludeOld=true");
  });

  it("sends nothing at all when the report is asked without a period", async () => {
    // `estado-red` alone answers over the whole history. An empty filter must
    // produce an empty query string rather than keys with no values, which the
    // server would read as a period half given and refuse.
    const get = espia();

    await getEstadoRed({});

    expect(urlEnviada(get)).not.toContain("?");
  });
});
