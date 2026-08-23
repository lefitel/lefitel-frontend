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
import { renderHook, waitFor } from "@testing-library/react";
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
const sesion = { usuario: { id: 7, id_rol: 1 }, token: "t", autenticado: true } as unknown as SesionInterface;

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
});
