import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDashboard, DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";
import { PosteInterface } from "../../../interfaces/interfaces";
import { posteExample } from "../../../data/example";
import { Period, MapTab, KpiData, MapMarker, MONTH_NAMES, CustomRange } from "./types";
import { getPeriodBounds } from "./helpers";

export interface CriticalAlert {
  events: DashboardEvento[];
  thresholdDays: number;
}

export interface InicioData {
  loading: boolean;
  /**
   * The last load failed and there is nothing to draw.
   *
   * Distinct from `loading` and from empty data, because those three states used
   * to look identical on screen. `kpis` stays null on failure and every card
   * reads `kpis?.x ?? 0`, so a three-second outage rendered "0 postes · 0
   * pendientes", "No hay incidencias pendientes en este período" and an empty
   * map — the failure drawn exactly like a system in perfect health, behind a
   * toast that disappears after four seconds. Whoever reads this must show a way
   * back instead of a zero.
   */
  error: boolean;
  load: () => void;
  period: Period;
  setPeriod: (p: Period) => void;
  customRange: CustomRange;
  setCustomRange: (r: CustomRange) => void;
  currentDateRange: { start: Date; end: Date };
  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;
  kpis: KpiData | null;
  /**
   * Dos flujos por tramo de tiempo: cuántas averías ENTRARON, por su propia
   * fecha, y cuántas se repararon (SALIERON), por la fecha de su solución.
   * Ninguna de las dos mira el estado actual del evento: si lo hicieran,
   * uno cerrado desaparecería del mes en que entró.
   */
  chartData: { label: string; entraron: number; salieron: number }[];
  xAxisLabel: string;
  showTrend: boolean;
  urgentEvents: DashboardEvento[];
  criticalObsEvents: DashboardEvento[];
  topPostes: { name: string; count: number }[];
  mapMarkers: MapMarker[];
  criticalAlerts: CriticalAlert;
  dataPoste: PosteInterface;
  setDataPoste: (p: PosteInterface) => void;
  openEditPoste: boolean;
  setOpenEditPoste: (v: boolean) => void;
}

const getSolDate = (e: DashboardEvento): Date | null => {
  const d = e.solucions?.[0]?.date;
  return d ? new Date(d) : null;
};

/** Los meses naturales que van de `desde` a `hasta`, ambos incluidos. */
const mesesEntre = (desde: Date, hasta: Date): { label: string; month: number; year: number }[] => {
  const out: { label: string; month: number; year: number }[] = [];
  let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  while (cursor <= fin) {
    out.push({
      label: `${MONTH_NAMES[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`,
      month: cursor.getMonth(),
      year: cursor.getFullYear(),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
};

export function useInicioData(): InicioData {
  const [listPostes, setListPostes] = useState<DashboardPoste[] | null>(null);
  const [listEventos, setListEventos] = useState<DashboardEvento[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("custom");
  const [customRange, setCustomRange] = useState<CustomRange>(() => {
    const n = new Date();
    return { start: new Date(n.getFullYear(), n.getMonth() - 1, 1), end: n };
  });
  const [mapTab, setMapTab] = useState<MapTab>("postes");
  const [dataPoste, setDataPoste] = useState<PosteInterface>(posteExample);
  const [openEditPoste, setOpenEditPoste] = useState(false);

  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboard();
      setListEventos(data.eventos);
      setListPostes(data.postes);
      setError(false);
    } catch {
      // Both: the toast for whoever is looking right now, the flag for whoever
      // arrives four seconds later and would otherwise read zeros as an answer.
      setError(true);
      toast.error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bounds = useMemo(() => {
    if (period === "custom") {
      const durationMs = customRange.end.getTime() - customRange.start.getTime();
      const prevEnd = new Date(customRange.start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      return { start: customRange.start, end: customRange.end, prevStart, prevEnd };
    }
    return getPeriodBounds(period);
  }, [period, customRange]);

  const kpis = useMemo((): KpiData | null => {
    if (!listEventos || !listPostes) return null;
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    const inPrev = period === "all" ? () => true : (d: Date) => d >= bounds.prevStart && d <= bounds.prevEnd;
    const hasRevisionInCurr = (e: DashboardEvento) =>
      (e.revisions ?? []).some((r) => inCurr(new Date(r.date)));
    const hasRevisionInPrev = (e: DashboardEvento) =>
      (e.revisions ?? []).some((r) => inPrev(new Date(r.date)));

    /**
     * The poles that still exist, and the only ones any of these counts may name.
     *
     * Archiving a pole is a soft delete with no cascade to its incidents, and
     * Sequelize puts the paranoid condition in the ON clause of a LEFT JOIN — so
     * those incidents arrive with `poste: null` and a live `id_poste` pointing at
     * a row `listPostes` does not contain. Every count below used to build its
     * set straight from `id_poste`, while `postesTotal` counts `listPostes`. One
     * archived pole carrying three open incidents was enough to render
     * "100% con incidencias" and "−1 sin incidencias".
     *
     * The incidents themselves stay in `pendGlobal` and `eventosTotal`: they are
     * real work that is really open, and dropping them would trade a wrong
     * percentage for a wrong backlog. What they may not do is be counted as
     * poles.
     */
    const livePosteIds = new Set(listPostes.map((p) => p.id));
    const livePostes = (list: DashboardEvento[]) =>
      new Set(list.filter((e) => livePosteIds.has(e.id_poste)).map((e) => e.id_poste));

    const postesTotal = listPostes.length;
    const postesCurr = listPostes.filter((p) => inCurr(new Date(p.date))).length;
    const postesPrev = listPostes.filter((p) => inPrev(new Date(p.date))).length;
    const postesConIncidencias = livePostes(listEventos.filter((e) => !e.state)).size;
    const postesConEventos = livePostes(listEventos).size;
    const eventosTotal = listEventos.length;
    const eventosResueltosTotal = listEventos.filter((e) => e.state).length;
    const pendGlobal = listEventos.filter((e) => !e.state).length;

    const reviewedList = listEventos.filter(hasRevisionInCurr);
    const revisadosIds = livePostes(reviewedList);
    const postesRevisadosCurr = revisadosIds.size;
    const postesRevisadosPrev = livePostes(listEventos.filter(hasRevisionInPrev)).size;
    const pendientesRevisadosCurr = reviewedList.filter((e) => !e.state);
    const postesPendientesRevisadosCurr = livePostes(pendientesRevisadosCurr).size;

    const postesSolucionadosIdsCurr = livePostes(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inCurr(d); }));
    const postesSolucionadosCurr = postesSolucionadosIdsCurr.size;
    const postesSolucionadosPrev = livePostes(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inPrev(d); })).size;

    const creadosIds = new Set(listPostes.filter((p) => inCurr(new Date(p.date))).map((p) => p.id));
    const postesActivosCurr = new Set([...creadosIds, ...revisadosIds, ...postesSolucionadosIdsCurr]).size;
    const postesActivosPrev = new Set([
      ...listPostes.filter((p) => inPrev(new Date(p.date))).map((p) => p.id),
      ...livePostes(listEventos.filter(hasRevisionInPrev)),
      ...livePostes(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inPrev(d); })),
    ]).size;

    return {
      postesTotal, postesConIncidencias, postesConEventos,
      eventosTotal, eventosResueltosTotal, pendGlobal,
      postesCurr, postesPrev, postesRevisadosCurr, postesRevisadosPrev,
      postesPendientesRevisadosCurr,
      postesSolucionadosCurr, postesSolucionadosPrev,
      postesActivosCurr, postesActivosPrev,
    };
  }, [listEventos, listPostes, bounds, period]);

  // ── Actividad: dos flujos, una sola regla ──────────────────────────────────
  //
  // ENTRARON se cuenta por `evento.date` y SALIERON por la fecha de la solución,
  // y ninguna de las dos mira `state`. Antes las entradas se contaban dentro de
  // un `if (!e.state)`, así que un evento cerrado desaparecía del tramo en que
  // había entrado: en 2026, enero recibió 196 averías y el gráfico dibujaba 160.
  //
  // Y la regla estaba escrita ocho veces, no siempre igual — en unas vistas las
  // salidas colgaban del `else` de esa condición y en otras se contaban aparte,
  // de modo que el mismo evento podía salir resuelto en una vista y pendiente en
  // otra. Escribirla una sola vez es lo que impide que vuelvan a separarse.
  const chartData = useMemo(() => {
    if (!listEventos) return [];

    /** Averías nacidas en [desde, hasta). Su estado de hoy no cambia cuándo entró. */
    const entraronEntre = (desde: number, hasta: number) =>
      listEventos.filter((e) => {
        const t = new Date(e.date).getTime();
        return !isNaN(t) && t >= desde && t < hasta;
      }).length;

    /** Reparaciones hechas en [desde, hasta), por la fecha de la solución. */
    const salieronEntre = (desde: number, hasta: number) =>
      listEventos.filter((e) => {
        const d = getSolDate(e);
        return !!d && d.getTime() >= desde && d.getTime() < hasta;
      }).length;

    const tramo = (label: string, desde: number, hasta: number) => ({
      label,
      entraron: entraronEntre(desde, hasta),
      salieron: salieronEntre(desde, hasta),
    });

    /** Un mes natural completo, de su día 1 al día 1 del siguiente. */
    const tramoMes = (label: string, year: number, month: number) =>
      tramo(label, new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime());

    const tramoDia = (day: Date) => {
      const inicio = new Date(day);
      inicio.setHours(0, 0, 0, 0);
      const ms = inicio.getTime();
      return tramo(`${inicio.getDate()}/${inicio.getMonth() + 1}`, ms, ms + 86_400_000);
    };

    if (period === "fortnight") {
      return Array.from({ length: 15 }, (_, i) => {
        const day = new Date(bounds.start);
        day.setDate(day.getDate() + i);
        return tramoDia(day);
      });
    }

    if (period === "month") {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = new Date(now.getFullYear(), now.getMonth(), i + 1);
        const ms = day.getTime();
        return tramo((i + 1).toString(), ms, ms + 86_400_000);
      });
    }

    if (period === "quarter") {
      return [0, 1, 2].map((i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
        return tramoMes(MONTH_NAMES[d.getMonth()], d.getFullYear(), d.getMonth());
      });
    }

    if (period === "year") {
      return Array.from({ length: 12 }, (_, m) =>
        tramoMes(MONTH_NAMES[m], now.getFullYear(), m)
      );
    }

    if (period === "custom") {
      const diffDays = Math.ceil((customRange.end.getTime() - customRange.start.getTime()) / 86_400_000);

      if (diffDays <= 90) {
        return Array.from({ length: diffDays + 1 }, (_, i) => {
          const day = new Date(customRange.start);
          day.setDate(day.getDate() + i);
          return tramoDia(day);
        });
      }

      if (diffDays <= 365) {
        // Semanal — siempre ≥ 13 puntos para rangos de más de 90 días.
        const weeks = Math.ceil((diffDays + 1) / 7);
        return Array.from({ length: weeks }, (_, i) => {
          const weekStart = new Date(customRange.start);
          weekStart.setDate(weekStart.getDate() + i * 7);
          weekStart.setHours(0, 0, 0, 0);
          const ws = weekStart.getTime();
          const we = Math.min(ws + 7 * 86_400_000, customRange.end.getTime() + 86_400_000);
          return tramo(`${weekStart.getDate()}/${weekStart.getMonth() + 1}`, ws, we);
        });
      }

      return mesesEntre(customRange.start, customRange.end).map(({ label, month, year }) =>
        tramoMes(label, year, month)
      );
    }

    // "all" — desde la avería más antigua que no sea anterior al sistema.
    const systemStart = new Date(2020, 0, 1).getTime();
    const allMs = listEventos.map((e) => new Date(e.date).getTime()).filter((ms) => !isNaN(ms) && ms >= systemStart);
    const earliest = allMs.length > 0 ? new Date(Math.min(...allMs)) : new Date(2020, 0, 1);
    return mesesEntre(earliest, bounds.end).map(({ label, month, year }) =>
      tramoMes(label, year, month)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEventos, period, bounds]);

  const xAxisLabel =
    period === "fortnight" ? "Día — últimos 15 días" :
    period === "month"   ? `Día — ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` :
    period === "quarter" ? "Últimos 3 meses" :
    period === "year"    ? `Mes — ${now.getFullYear()}` :
    period === "custom"
      ? `${customRange.start.getDate()}/${customRange.start.getMonth() + 1}/${customRange.start.getFullYear()} — ${customRange.end.getDate()}/${customRange.end.getMonth() + 1}/${customRange.end.getFullYear()}` :
    "Histórico completo (por mes)";

  const showTrend = period !== "all";

  const urgentEvents = useMemo(() => {
    if (!listEventos) return [];
    return [...listEventos]
      .filter((e) => !e.state && e.priority)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [listEventos]);

  const criticalObsEvents = useMemo(() => {
    if (!listEventos) return [];
    const minCriticality = (e: DashboardEvento) =>
      Math.min(...(e.eventoObs ?? []).filter((eo) => eo.ob?.criticality != null).map((eo) => eo.ob!.criticality!));
    return [...listEventos]
      .filter((e) => !e.state && (e.eventoObs ?? []).some((eo) => eo.ob?.criticality != null))
      .sort((a, b) => minCriticality(a) - minCriticality(b));
  }, [listEventos]);

  const criticalAlerts = useMemo<CriticalAlert>(() => {
    const thresholdDays = 7;
    if (!listEventos) return { events: [], thresholdDays };
    const cutoff = Date.now() - thresholdDays * 86_400_000;
    const events = listEventos
      .filter((e) => e.priority && !e.state && new Date(e.date).getTime() <= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { events, thresholdDays };
  }, [listEventos]);

  const topPostes = useMemo(() => {
    if (!listEventos) return [];
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    const byPoste = new Map<number, { name: string; count: number }>();
    listEventos.filter((e) => !e.state && inCurr(new Date(e.date))).forEach((e) => {
      const id = e.id_poste;
      const name = e.poste?.name ?? `Poste #${id}`;
      byPoste.set(id, { name, count: (byPoste.get(id)?.count ?? 0) + 1 });
    });
    return [...byPoste.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [listEventos, bounds, period]);

  const mapMarkers = useMemo((): MapMarker[] => {
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    const hasRevisionInCurr = (e: DashboardEvento) =>
      (e.revisions ?? []).some((r) => inCurr(new Date(r.date)));

    if (mapTab === "postes") {
      const revisedPosteIds = new Set((listEventos ?? []).filter(hasRevisionInCurr).map((e) => e.id_poste));
      return (listPostes ?? [])
        .filter((p) => revisedPosteIds.has(p.id))
        .map((p) => ({ lat: p.lat, lng: p.lng, label: p.name, isPoste: true as const, item: p }));
    }
    if (mapTab === "pendientes") {
      return (listEventos ?? [])
        .filter((e) => {
          const hasCoords = (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0;
          return !e.state && hasRevisionInCurr(e) && hasCoords;
        })
        .map((e) => ({ lat: e.poste!.lat, lng: e.poste!.lng, label: e.poste?.name ?? "—", isPoste: false as const, item: e }));
    }
    return (listEventos ?? [])
      .filter((e) => {
        const hasCoords = (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0;
        const sd = getSolDate(e); return e.state && !!sd && inCurr(sd) && hasCoords;
      })
      .map((e) => ({ lat: e.poste!.lat, lng: e.poste!.lng, label: e.poste?.name ?? "—", isPoste: false as const, item: e }));
  }, [listPostes, listEventos, mapTab, bounds, period]);

  return {
    loading, error, load, period, setPeriod, customRange, setCustomRange,
    currentDateRange: { start: bounds.start, end: bounds.end },
    mapTab, setMapTab,
    kpis, chartData, xAxisLabel, showTrend,
    urgentEvents, criticalObsEvents, topPostes, mapMarkers, criticalAlerts,
    dataPoste, setDataPoste, openEditPoste, setOpenEditPoste,
  };
}
