// The two ways this hook used to lie about the state of the network.
//
// One: a failed request left `listEventos` and `listPostes` at null, and every
// card downstream reads `?? 0`, so a three-second outage rendered "0 pendientes"
// and "No hay eventos urgentes pendientes" — the failure state drawn exactly
// like the healthiest state possible, with a toast that vanishes after four
// seconds.
//
// Two: archiving a pole is a soft delete with no cascade, and Sequelize puts the
// paranoid condition in the ON clause of a LEFT JOIN, so its incidents come back
// with `poste: null` and a live `id_poste`. Sets built from `id_poste` counted
// poles that `listPostes.length` does not, so a ratio of the two could pass 100%
// and their difference could go negative.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import type { SesionInterface } from "../../../interfaces/interfaces";
import type { DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";
import { useInicioData } from "./useInicioData";

const getDashboard = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("../../../api/dashboard.api", () => ({ getDashboard }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

// `autenticado: true` is set explicitly even though a cast follows: without
// it here, this fixture would silently carry `autenticado: undefined` and no
// compiler error would ever say so (task 5's brief flagged this exact file).
const sesion = { usuario: { id: 7, id_rol: 1 }, autenticado: true } as unknown as SesionInterface;

const wrapper = ({ children }: PropsWithChildren) => (
  <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
    {children}
  </SesionContext.Provider>
);

/** A pole that exists, dated well before any window these tests use. */
function poste(id: number): DashboardPoste {
  return {
    id,
    name: `P-${id}`,
    lat: -17.78,
    lng: -63.18,
    date: new Date("2024-01-15") as unknown as Date,
  };
}

/** An unresolved incident. `orphan` drops the pole the way an archive does. */
function evento(id: number, id_poste: number, orphan = false): DashboardEvento {
  return {
    id,
    description: `E-${id}`,
    state: false,
    date: new Date("2024-06-01") as unknown as Date,
    id_poste,
    poste: orphan ? null : { id: id_poste, name: `P-${id_poste}`, lat: -17.78, lng: -63.18 },
    revisions: [],
    solucions: [],
    eventoObs: [],
  };
}

beforeEach(() => {
  getDashboard.mockReset();
  toastError.mockReset();
});

describe("useInicioData", () => {
  describe("when the request fails", () => {
    it("says so instead of reporting zeros", async () => {
      getDashboard.mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useInicioData(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe(true);
      // Nothing to draw. A card that reads `kpis?.x ?? 0` must not be handed a
      // zero that looks like an answer.
      expect(result.current.kpis).toBeNull();
      expect(toastError).toHaveBeenCalled();
    });

    it("clears the error once a retry succeeds", async () => {
      getDashboard.mockRejectedValueOnce(new Error("network down"));
      getDashboard.mockResolvedValue({ eventos: [evento(1, 10)], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.error).toBe(true));

      result.current.load();

      await waitFor(() => expect(result.current.error).toBe(false));
      expect(result.current.kpis).not.toBeNull();
    });
  });

  describe("when a pole has been archived under its incidents", () => {
    it("never counts more poles with incidents than there are poles", async () => {
      // Five live poles, four of them with an incident, plus twelve incidents
      // hanging off poles that were archived without being resolved.
      const postes = [10, 11, 12, 13, 14].map(poste);
      const eventos = [
        ...[10, 11, 12, 13].map((p, i) => evento(i + 1, p)),
        ...Array.from({ length: 12 }, (_, i) => evento(100 + i, 900 + i, true)),
      ];
      getDashboard.mockResolvedValue({ eventos, postes });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.kpis).not.toBeNull());

      const k = result.current.kpis!;
      expect(k.postesTotal).toBe(5);
      expect(k.postesConIncidencias).toBe(4);
      expect(k.postesConIncidencias).toBeLessThanOrEqual(k.postesTotal);
      // The difference the card prints must not be able to go negative.
      expect(k.postesTotal - k.postesConIncidencias).toBeGreaterThanOrEqual(0);
    });

    it("keeps the orphaned incidents in the pending total", async () => {
      // They are real work that is really open. Dropping them from the count
      // would trade a wrong percentage for a wrong backlog.
      const postes = [10].map(poste);
      const eventos = [evento(1, 10), evento(2, 901, true), evento(3, 902, true)];
      getDashboard.mockResolvedValue({ eventos, postes });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.kpis).not.toBeNull());

      expect(result.current.kpis!.pendGlobal).toBe(3);
    });
  });

  // ── Postes nuevos ──────────────────────────────────────────────────────────
  //
  // A pole is new in a period when its `date` — «Fecha en campo» on the form —
  // falls inside it. The card needs the same count for the window before, or
  // its trend badge has nothing to compare against.
  describe("postes nuevos", () => {
    const posteDe = (id: number, date: Date): DashboardPoste => ({ ...poste(id), date: date as unknown as Date });

    it("counts the poles of the period and those of the one before, each on its own", async () => {
      getDashboard.mockResolvedValue({
        eventos: [],
        postes: [
          poste(1),                               // 2024: in neither window
          posteDe(2, new Date(2026, 2, 10)),      // inside the period
          posteDe(3, new Date(2026, 1, 10)),      // inside the one before
          posteDe(4, new Date(2026, 1, 20)),      // inside the one before
        ],
      });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      // March 2026. The window before is the same length, ending where it starts.
      act(() => result.current.setCustomRange({ start: new Date(2026, 2, 1), end: new Date(2026, 2, 31) }));

      await waitFor(() => expect(result.current.kpis!.postesCurr).toBe(1));
      expect(result.current.kpis!.postesPrev).toBe(2);
    });
  });

  // ── Eventos solucionados ───────────────────────────────────────────────────
  //
  // The card counts repairs, not poles, and by the date of the solution — the
  // same rule as the «Eventos solucionados» line of the chart, so the card is
  // the sum of the line over the period. It used to count distinct poles, which
  // made two repairs on one pole read as one.
  describe("eventos solucionados", () => {
    const reparado = (id: number, id_poste: number, date: Date): DashboardEvento => ({
      ...evento(id, id_poste),
      state: true,
      solucions: [{ date } as unknown as never],
    });

    it("counts every repair of the period, even two on the same pole", async () => {
      getDashboard.mockResolvedValue({
        postes: [poste(10)],
        eventos: [
          reparado(1, 10, new Date(2026, 2, 5)),   // in the period
          reparado(2, 10, new Date(2026, 2, 20)),  // in the period, same pole
          reparado(3, 10, new Date(2026, 1, 15)),  // in the one before
          evento(4, 10),                           // never repaired
        ],
      });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setCustomRange({ start: new Date(2026, 2, 1), end: new Date(2026, 2, 31) }));

      await waitFor(() => expect(result.current.kpis!.eventosSolucionadosCurr).toBe(2));
      expect(result.current.kpis!.eventosSolucionadosPrev).toBe(1);
      // The pole count beside it, still used by Postes Activos, stays a pole count.
      expect(result.current.kpis!.postesSolucionadosCurr).toBe(1);
    });
  });

  // ── El gráfico de Actividad ────────────────────────────────────────────────
  //
  // Las dos barras contaban poblaciones distintas: `pending` se agrupaba por la
  // fecha del evento y `solved` por la de su solución. Un evento de enero
  // cerrado en marzo desaparecía de enero y reaparecía en marzo, así que la
  // barra de enero no era "lo que entró en enero" ni "lo que sigue abierto de
  // enero": era la resta de las dos cosas. Medido sobre la base real, 627 de
  // 937 eventos cerrados (el 67%) cierran en un mes distinto al de su alta.
  //
  // En febrero de 2026 entraron 15 eventos y el gráfico dibujaba 8 + 33.
  //
  // Ahora son dos flujos: cuántas averías entraron y cuántas se repararon, cada
  // una en su fecha y sin mirar el estado actual del evento. Eso es lo que hace
  // que el modo Balance signifique algo.
  describe("el gráfico de actividad", () => {
    // Un rango fijo de dos años, no «este año»: el granulado lo elige ahora
    // `chartBuckets` según lo largo del período, así que el mismo botón corta
    // por días en enero y por semanas en marzo. Dos años son 105 semanas, por
    // encima del tope, y se cortan por mes: 24 tramos, enero de 2025 el primero.
    const ESTE_ANIO = 2025;
    const DOS_ANIOS = { start: new Date(2025, 0, 1), end: new Date(2026, 11, 31) };

    /** Un evento nacido en `mes`, reparado en `mesCierre` si se indica. */
    function eventoDeMes(id: number, mes: number, mesCierre?: number): DashboardEvento {
      const cerrado = mesCierre !== undefined;
      return {
        ...evento(id, 10),
        state: cerrado,
        date: new Date(ESTE_ANIO, mes, 10) as unknown as Date,
        solucions: cerrado
          ? [{ date: new Date(ESTE_ANIO, mesCierre, 10) } as unknown as never]
          : [],
      };
    }

    it("un evento cerrado sigue contando en el mes en que entró", async () => {
      // Entra en enero, se repara en marzo. Enero no puede perderlo.
      getDashboard.mockResolvedValue({ eventos: [eventoDeMes(1, 0, 2)], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setCustomRange(DOS_ANIOS));
      // 24 tramos = la vista por meses ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(24));

      expect(result.current.chartData[0].entraron).toBe(1);
    });

    it("la reparación cuenta en el mes en que se reparó", async () => {
      getDashboard.mockResolvedValue({ eventos: [eventoDeMes(1, 0, 2)], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setCustomRange(DOS_ANIOS));
      // 24 tramos = la vista por meses ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(24));

      expect(result.current.chartData[2].salieron).toBe(1);
      // Y no se cuenta como salida en el mes en que entró.
      expect(result.current.chartData[0].salieron).toBe(0);
    });

    it("las entradas del mes son todas, no solo las que siguen abiertas", async () => {
      // Tres entran en enero; dos se reparan en marzo. Enero entraron = 3.
      getDashboard.mockResolvedValue({
        eventos: [eventoDeMes(1, 0, 2), eventoDeMes(2, 0, 2), eventoDeMes(3, 0)],
        postes: [poste(10)],
      });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setCustomRange(DOS_ANIOS));
      // 24 tramos = la vista por meses ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(24));

      expect(result.current.chartData[0].entraron).toBe(3);
      expect(result.current.chartData[2].salieron).toBe(2);
    });

    it("los postes nuevos cuentan en el tramo de su fecha en campo", async () => {
      // La tercera línea. Un poste de enero y dos de marzo; el de 2024 que trae
      // `poste()` queda fuera del rango.
      const posteDeMes = (id: number, mes: number): DashboardPoste =>
        ({ ...poste(id), date: new Date(ESTE_ANIO, mes, 10) as unknown as Date });
      getDashboard.mockResolvedValue({
        eventos: [],
        postes: [poste(10), posteDeMes(11, 0), posteDeMes(12, 2), posteDeMes(13, 2)],
      });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setCustomRange(DOS_ANIOS));
      await waitFor(() => expect(result.current.chartData).toHaveLength(24));

      expect(result.current.chartData.map((t) => t.postes)).toEqual([1, 0, 2, ...Array(21).fill(0)]);
    });

    it("tres meses no son tres puntos", async () => {
      // El defecto que motivó la regla: «3 meses» se cortaba por mes. Según el
      // día en que se mire son entre 60 y 92 días — 60 puntos diarios como
      // mucho, 9 semanales como poco — y el rótulo dice cuál de los dos.
      getDashboard.mockResolvedValue({ eventos: [], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setPeriod("quarter"));

      await waitFor(() => expect(result.current.xAxisLabel).toMatch(/^Últimos 3 meses · por (día|semana)$/));
      expect(result.current.chartData.length).toBeGreaterThanOrEqual(9);
      expect(result.current.chartData.length).toBeLessThanOrEqual(60);
    });

    it("con el tope alto, tres meses se cortan por día", async () => {
      // El tope lo pone la página según lo ancho que mida el gráfico. Tres
      // meses son 92 días como mucho: caben enteros en 120 puntos.
      getDashboard.mockResolvedValue({ eventos: [], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(120), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setPeriod("quarter"));

      await waitFor(() => expect(result.current.xAxisLabel).toBe("Últimos 3 meses · por día"));
      expect(result.current.chartData.length).toBeGreaterThanOrEqual(60);
      expect(result.current.chartData.length).toBeLessThanOrEqual(92);
    });

    it("«Todo» empieza en el primer dato, no en 2020", async () => {
      // Un poste de enero de 2024 y nada más: de ahí a hoy por meses. Empezando
      // en 2020 serían más de 60 meses y el gráfico saltaría a trimestres por
      // unos años en los que no hay nada.
      getDashboard.mockResolvedValue({ eventos: [], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setPeriod("all"));

      await waitFor(() => expect(result.current.xAxisLabel).toMatch(/^Histórico completo · /));
      expect(result.current.chartData[0].label).toBe("Ene '24");
      expect(result.current.chartData[0].postes).toBe(1);
    });

    it("cuenta igual en las vistas por día que en las vistas por mes", async () => {
      // La regla estaba escrita de dos formas: unas vistas contaban las salidas
      // dentro del `else` de "si no está resuelto", otras las contaban aparte.
      // Un evento cerrado, en las primeras, no podía contar como entrada nunca.
      const hoy = new Date();
      const cerradoHoy = {
        ...evento(1, 10),
        state: true,
        date: hoy as unknown as Date,
        solucions: [{ date: hoy } as unknown as never],
      };
      getDashboard.mockResolvedValue({ eventos: [cerradoHoy], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setPeriod("fortnight"));
      await waitFor(() => expect(result.current.chartData).toHaveLength(15));

      const ultimo = result.current.chartData[result.current.chartData.length - 1];
      expect(ultimo.entraron).toBe(1);
      expect(ultimo.salieron).toBe(1);
    });
  });

  // ── El mapa, por departamento ──────────────────────────────────────────────
  //
  // El departamento es del tramo, y el tramo viaja dentro de cada poste. Los
  // eventos no lo traen: el suyo es el de su poste. Un tramo puede no tener
  // departamento — al estrenarse esto no lo tenía ninguno — y sus postes no
  // pueden quedarse sin sitio en el selector, o filtrar los haría desaparecer.
  describe("el mapa por departamento", () => {
    const LA_PAZ = { id: 2, name: "La Paz" };
    const POTOSI = { id: 5, name: "Potosí" };

    /** Un poste en un tramo del departamento dado, o en uno que no tiene. */
    const posteEn = (id: number, departamento: { id: number; name: string } | null): DashboardPoste => ({
      ...poste(id),
      tramo: {
        id: id * 10, nombre: `Tramo ${id}`, archivado: false,
        id_departamento: departamento?.id ?? null, departamento,
        ciudades: [{ id: 1, name: "A", lat: -17, lng: -63 }, { id: 2, name: "B", lat: -18, lng: -64 }],
      },
    });

    /** Un evento abierto con una revisión, que es lo que lo pone en el mapa. */
    const revisado = (id: number, id_poste: number): DashboardEvento => ({
      ...evento(id, id_poste),
      revisions: [{ id, date: new Date("2025-03-01") as unknown as Date }],
    });

    const montar = async () => {
      getDashboard.mockResolvedValue({
        // Potosí delante de La Paz: el orden del selector no es el de llegada.
        postes: [posteEn(10, POTOSI), posteEn(11, LA_PAZ), posteEn(12, LA_PAZ), posteEn(13, null), poste(14)],
        eventos: [revisado(1, 10), revisado(2, 11), revisado(3, 12), revisado(4, 13), revisado(5, 14)],
      });
      const hook = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      act(() => hook.result.current.setPeriod("all"));
      await waitFor(() => expect(hook.result.current.mapMarkers).toHaveLength(5));
      return hook.result;
    };
    const nombres = (r: { current: { mapMarkers: { label: string }[] } }) => r.current.mapMarkers.map((m) => m.label).sort();

    it("ofrece los departamentos que tienen postes, por orden alfabético y una vez cada uno", async () => {
      const result = await montar();

      expect(result.current.mapDepartamentos).toEqual([LA_PAZ, POTOSI]);
    });

    it("avisa de que hay postes sin departamento, tengan tramo o no", async () => {
      const result = await montar();

      expect(result.current.mapSinDepartamento).toBe(true);
    });

    it("no ofrece «sin departamento» cuando todos lo tienen", async () => {
      getDashboard.mockResolvedValue({ postes: [posteEn(10, POTOSI)], eventos: [] });
      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.mapSinDepartamento).toBe(false);
    });

    it("enseña todo mientras no se elige ninguno", async () => {
      const result = await montar();

      expect(result.current.mapDepartamento).toBe("all");
      expect(nombres(result)).toEqual(["P-10", "P-11", "P-12", "P-13", "P-14"]);
    });

    it("deja solo los postes del departamento elegido", async () => {
      const result = await montar();

      act(() => result.current.setMapDepartamento(LA_PAZ.id));

      expect(nombres(result)).toEqual(["P-11", "P-12"]);
    });

    it("«sin departamento» deja los que no tienen, con tramo o sin él", async () => {
      const result = await montar();

      act(() => result.current.setMapDepartamento("none"));

      expect(nombres(result)).toEqual(["P-13", "P-14"]);
    });

    it("filtra los eventos por el departamento de su poste", async () => {
      // La pestaña de pendientes pinta eventos, que no traen tramo.
      const result = await montar();
      act(() => result.current.setMapTab("pendientes"));
      await waitFor(() => expect(result.current.mapMarkers.every((m) => !m.isPoste)).toBe(true));

      act(() => result.current.setMapDepartamento(POTOSI.id));

      expect(result.current.mapMarkers.map((m) => m.item.id)).toEqual([1]);
    });

    it("vuelve a enseñar todo si el departamento elegido deja de existir tras recargar", async () => {
      // Elegido, y al recargar ya no hay ningún poste en él: un filtro que
      // nadie puede ver ni quitar dejaría el mapa vacío sin explicación.
      const result = await montar();
      act(() => result.current.setMapDepartamento(POTOSI.id));
      expect(nombres(result)).toEqual(["P-10"]);

      getDashboard.mockResolvedValue({ postes: [posteEn(11, LA_PAZ)], eventos: [revisado(2, 11)] });
      act(() => { result.current.load(); });

      await waitFor(() => expect(result.current.mapDepartamento).toBe("all"));
      expect(nombres(result)).toEqual(["P-11"]);
    });
  });

  describe("critical alerts", () => {
    const DAY = 86_400_000;
    const LOAD = new Date("2025-03-10T12:00:00Z").getTime();
    /** A priority incident that is still open, `days` before `LOAD`. */
    const urgente = (id: number, days: number): DashboardEvento => ({
      ...evento(id, 10),
      priority: true,
      date: new Date(LOAD - days * DAY) as unknown as Date,
    });

    afterEach(() => vi.useRealTimers());

    it("counts the week from the moment the data was loaded, not from the render", async () => {
      // Only the clock is faked: `waitFor` still needs real timers to poll.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(LOAD);
      getDashboard.mockResolvedValue({
        postes: [poste(10)],
        eventos: [urgente(1, 8), urgente(2, 6)],
      });

      const { result, rerender } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.kpis).not.toBeNull());

      expect(result.current.criticalAlerts.thresholdDays).toBe(7);
      expect(result.current.criticalAlerts.events.map((e) => e.id)).toEqual([1]);

      // Three days pass and the screen renders again: the six-day-old incident
      // is nine days old by the clock, but the list belongs to the load.
      vi.setSystemTime(LOAD + 3 * DAY);
      rerender();
      expect(result.current.criticalAlerts.events.map((e) => e.id)).toEqual([1]);

      // A refresh takes a new reading, and the alert list follows it.
      act(() => { result.current.load(); });
      await waitFor(() => expect(result.current.criticalAlerts.events.map((e) => e.id)).toEqual([1, 2]));
    });

    it("is empty before anything has loaded", () => {
      getDashboard.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useInicioData(), { wrapper });
      expect(result.current.criticalAlerts.events).toEqual([]);
    });
  });
});

