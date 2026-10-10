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

import { describe, expect, it, vi, beforeEach } from "vitest";
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

    it("does not count them as poles that ever had incidents either", async () => {
      const postes = [10, 11].map(poste);
      const eventos = [evento(1, 10), evento(2, 901, true)];
      getDashboard.mockResolvedValue({ eventos, postes });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.kpis).not.toBeNull());

      const k = result.current.kpis!;
      expect(k.postesConEventos).toBe(1);
      expect(k.postesConEventos).toBeLessThanOrEqual(k.postesTotal);
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
    const ESTE_ANIO = new Date().getFullYear();

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
      act(() => result.current.setPeriod("year"));
      // 12 tramos = la vista anual ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(12));

      expect(result.current.chartData[0].entraron).toBe(1);
    });

    it("la reparación cuenta en el mes en que se reparó", async () => {
      getDashboard.mockResolvedValue({ eventos: [eventoDeMes(1, 0, 2)], postes: [poste(10)] });

      const { result } = renderHook(() => useInicioData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.setPeriod("year"));
      // 12 tramos = la vista anual ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(12));

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
      act(() => result.current.setPeriod("year"));
      // 12 tramos = la vista anual ya está montada. Con "> 0" bastaba el
      // período por defecto y el test leía otra vista.
      await waitFor(() => expect(result.current.chartData).toHaveLength(12));

      expect(result.current.chartData[0].entraron).toBe(3);
      expect(result.current.chartData[2].salieron).toBe(2);
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
});
