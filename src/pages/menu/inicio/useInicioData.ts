import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDashboard, DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";
import { Departamento, PosteInterface } from "../../../interfaces/interfaces";
import { posteExample } from "../../../data/example";
import { Period, MapTab, MapDepartamento, KpiData, MapMarker, MONTH_NAMES, CustomRange } from "./types";
import { chartBuckets, getPeriodBounds, Granularity, MAX_CHART_POINTS } from "./helpers";

export interface CriticalAlert {
  events: DashboardEvento[];
  thresholdDays: number;
}

export interface ChartTramo {
  /** The bucket's date in full, for the tooltip. The axis writes it in two rows. */
  label: string;
  /** Where the bucket begins, in ms. Unique, so it is also the chart's key. */
  desde: number;
  postes: number;
  entraron: number;
  salieron: number;
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
  /** The department the map is narrowed to. Only the map: the cards and the chart count everything. */
  mapDepartamento: MapDepartamento;
  setMapDepartamento: (d: MapDepartamento) => void;
  /** The departments that have at least one pole, by name. */
  mapDepartamentos: Departamento[];
  /** Whether any pole has no department, so the map can offer to show those. */
  mapSinDepartamento: boolean;
  kpis: KpiData | null;
  /**
   * Tres cuentas por tramo de tiempo, cada una por su propia fecha: cuántos
   * POSTES se dieron de alta en campo, cuántas averías ENTRARON y cuántas se
   * repararon (SALIERON), por la fecha de su solución. Las dos de eventos no
   * miran el estado actual del evento: si lo hicieran, uno cerrado
   * desaparecería del mes en que entró.
   */
  chartData: ChartTramo[];
  /** The grain `chartData` was cut at; the chart's axis is written from it. */
  chartGranularity: Granularity;
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

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "por día",
  week: "por semana",
  month: "por mes",
  quarter: "por trimestre",
  year: "por año",
};

/**
 * @param chartMaxPoints The most points the activity chart may be cut into.
 *   The page decides it from how wide the chart is drawn; see `WIDE_CHART_POINTS`.
 */
export function useInicioData(chartMaxPoints: number = MAX_CHART_POINTS): InicioData {
  const [listPostes, setListPostes] = useState<DashboardPoste[] | null>(null);
  const [listEventos, setListEventos] = useState<DashboardEvento[] | null>(null);
  // When `listEventos` arrived. The clock is read here, once per load, and not
  // while rendering: a render that reads the time is not repeatable, so the
  // alerts would depend on when React happened to render rather than on the data.
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("custom");
  const [customRange, setCustomRange] = useState<CustomRange>(() => {
    const n = new Date();
    return { start: new Date(n.getFullYear(), n.getMonth() - 1, 1), end: n };
  });
  const [mapTab, setMapTab] = useState<MapTab>("postes");
  const [mapDepartamentoElegido, setMapDepartamento] = useState<MapDepartamento>("all");
  const [dataPoste, setDataPoste] = useState<PosteInterface>(posteExample);
  const [openEditPoste, setOpenEditPoste] = useState(false);

  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboard();
      setListEventos(data.eventos);
      setListPostes(data.postes);
      setLoadedAt(Date.now());
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
    // Repairs, not poles, and by the solution's date alone — the rule the
    // chart's «Eventos solucionados» line uses, so the card is that line summed
    // over the period. No pole filter either: a repair on a pole archived since
    // is still a repair that was made.
    const reparadoEn = (enVentana: (d: Date) => boolean) => (e: DashboardEvento) => {
      const d = getSolDate(e);
      return !!d && enVentana(d);
    };
    const eventosSolucionadosCurr = listEventos.filter(reparadoEn(inCurr)).length;
    const eventosSolucionadosPrev = listEventos.filter(reparadoEn(inPrev)).length;

    const creadosIds = new Set(listPostes.filter((p) => inCurr(new Date(p.date))).map((p) => p.id));
    const postesActivosCurr = new Set([...creadosIds, ...revisadosIds, ...postesSolucionadosIdsCurr]).size;
    const postesActivosPrev = new Set([
      ...listPostes.filter((p) => inPrev(new Date(p.date))).map((p) => p.id),
      ...livePostes(listEventos.filter(hasRevisionInPrev)),
      ...livePostes(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inPrev(d); })),
    ]).size;

    return {
      postesTotal, postesConIncidencias,
      eventosTotal, eventosResueltosTotal, pendGlobal,
      postesCurr, postesPrev, postesRevisadosCurr, postesRevisadosPrev,
      postesPendientesRevisadosCurr,
      postesSolucionadosCurr, eventosSolucionadosCurr, eventosSolucionadosPrev,
      postesActivosCurr, postesActivosPrev,
    };
  }, [listEventos, listPostes, bounds, period]);

  // ── Actividad: tres cuentas, una sola regla cada una ───────────────────────
  //
  // POSTES se cuenta por su fecha en campo. De los eventos salen dos flujos:
  // ENTRARON se cuenta por `evento.date` y SALIERON por la fecha de la solución,
  // y ninguna de las dos mira `state`. Antes las entradas se contaban dentro de
  // un `if (!e.state)`, así que un evento cerrado desaparecía del tramo en que
  // había entrado: en 2026, enero recibió 196 averías y el gráfico dibujaba 160.
  //
  // Y la regla estaba escrita ocho veces, no siempre igual — en unas vistas las
  // salidas colgaban del `else` de esa condición y en otras se contaban aparte,
  // de modo que el mismo evento podía salir resuelto en una vista y pendiente en
  // otra. Escribirla una sola vez es lo que impide que vuelvan a separarse.
  //
  // Lo mismo pasaba con el granulado: cada período traía el suyo escrito a mano
  // y «3 meses» dibujaba tres puntos. Ahora lo decide `chartBuckets` para todos.
  const chart = useMemo((): { granularity: Granularity; tramos: ChartTramo[] } => {
    if (!listEventos || !listPostes) return { granularity: "day", tramos: [] };

    /** Postes cuya fecha en campo cae en [desde, hasta) — la regla de la tarjeta «Postes Nuevos». */
    const postesEntre = (desde: number, hasta: number) =>
      listPostes.filter((p) => {
        const t = new Date(p.date).getTime();
        return !isNaN(t) && t >= desde && t < hasta;
      }).length;

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

    // "Todo" empieza en la avería o el poste más antiguo que no sea anterior al
    // sistema, no en 2020: los años vacíos de delante gastarían puntos del tope
    // y empujarían el gráfico a un granulado más grueso sin motivo.
    let desde = bounds.start;
    if (period === "all") {
      const systemStart = new Date(2020, 0, 1).getTime();
      const allMs = [...listEventos, ...listPostes]
        .map((x) => new Date(x.date).getTime())
        .filter((ms) => !isNaN(ms) && ms >= systemStart);
      desde = allMs.length > 0 ? new Date(Math.min(...allMs)) : bounds.end;
    }

    const { granularity, buckets } = chartBuckets(desde, bounds.end, chartMaxPoints);
    return {
      granularity,
      tramos: buckets.map((b) => ({
        label: b.label,
        desde: b.desde,
        postes: postesEntre(b.desde, b.hasta),
        entraron: entraronEntre(b.desde, b.hasta),
        salieron: salieronEntre(b.desde, b.hasta),
      })),
    };
  }, [listEventos, listPostes, period, bounds, chartMaxPoints]);

  const periodoLabel =
    period === "fortnight" ? "Últimos 15 días" :
    period === "month"     ? `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` :
    period === "quarter"   ? "Últimos 3 meses" :
    period === "year"      ? `${now.getFullYear()}` :
    period === "custom"
      ? `${customRange.start.getDate()}/${customRange.start.getMonth() + 1}/${customRange.start.getFullYear()} — ${customRange.end.getDate()}/${customRange.end.getMonth() + 1}/${customRange.end.getFullYear()}` :
    "Histórico completo";
  // The grain is the chart's own choice now, so the caption has to say it:
  // the same button draws days in January and weeks in March.
  const xAxisLabel = `${periodoLabel} · ${GRANULARITY_LABELS[chart.granularity]}`;

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
    if (!listEventos || loadedAt === null) return { events: [], thresholdDays };
    // "Older than a week" is counted from when the data was loaded, so the list
    // is stable between renders and is recomputed with each refresh.
    const cutoff = loadedAt - thresholdDays * 86_400_000;
    const events = listEventos
      .filter((e) => e.priority && !e.state && new Date(e.date).getTime() <= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { events, thresholdDays };
  }, [listEventos, loadedAt]);

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

  // ── El mapa, por departamento ──────────────────────────────────────────────
  //
  // El departamento es del tramo y el tramo viaja dentro de cada poste. Un
  // evento no lo trae: el suyo es el de su poste, y se busca por `id_poste`.
  // `null` es "no tiene": un poste sin tramo, o en un tramo al que aún no se le
  // ha dado departamento.
  const departamentoDePoste = useMemo(
    () => new Map((listPostes ?? []).map((p) => [p.id, p.tramo?.departamento?.id ?? null])),
    [listPostes],
  );

  const { mapDepartamentos, mapSinDepartamento } = useMemo(() => {
    const porId = new Map<number, Departamento>();
    for (const p of listPostes ?? []) {
      const d = p.tramo?.departamento;
      if (d) porId.set(d.id, { id: d.id, name: d.name });
    }
    return {
      mapDepartamentos: [...porId.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
      mapSinDepartamento: [...departamentoDePoste.values()].some((id) => id === null),
    };
  }, [listPostes, departamentoDePoste]);

  // Lo elegido solo vale mientras siga en la lista. Tras recargar puede no
  // quedar ningún poste en ese departamento, y un filtro que el selector ya no
  // enseña dejaría el mapa vacío sin nada en pantalla que lo explique.
  const mapDepartamento: MapDepartamento =
    mapDepartamentoElegido === "all" ? "all"
    : mapDepartamentoElegido === "none" ? (mapSinDepartamento ? "none" : "all")
    : mapDepartamentos.some((d) => d.id === mapDepartamentoElegido) ? mapDepartamentoElegido : "all";

  const mapMarkers = useMemo((): MapMarker[] => {
    const enDepartamento = (idPoste: number) => {
      if (mapDepartamento === "all") return true;
      const id = departamentoDePoste.get(idPoste) ?? null;
      return mapDepartamento === "none" ? id === null : id === mapDepartamento;
    };
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    const hasRevisionInCurr = (e: DashboardEvento) =>
      (e.revisions ?? []).some((r) => inCurr(new Date(r.date)));

    if (mapTab === "postes") {
      const revisedPosteIds = new Set((listEventos ?? []).filter(hasRevisionInCurr).map((e) => e.id_poste));
      return (listPostes ?? [])
        .filter((p) => revisedPosteIds.has(p.id) && enDepartamento(p.id))
        .map((p) => ({ lat: p.lat, lng: p.lng, label: p.name, isPoste: true as const, item: p }));
    }
    if (mapTab === "pendientes") {
      return (listEventos ?? [])
        .filter((e) => {
          const hasCoords = (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0;
          return !e.state && hasRevisionInCurr(e) && hasCoords && enDepartamento(e.id_poste);
        })
        .map((e) => ({ lat: e.poste!.lat, lng: e.poste!.lng, label: e.poste?.name ?? "—", isPoste: false as const, item: e }));
    }
    return (listEventos ?? [])
      .filter((e) => {
        const hasCoords = (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0;
        const sd = getSolDate(e); return e.state && !!sd && inCurr(sd) && hasCoords && enDepartamento(e.id_poste);
      })
      .map((e) => ({ lat: e.poste!.lat, lng: e.poste!.lng, label: e.poste?.name ?? "—", isPoste: false as const, item: e }));
  }, [listPostes, listEventos, mapTab, bounds, period, mapDepartamento, departamentoDePoste]);

  return {
    loading, error, load, period, setPeriod, customRange, setCustomRange,
    currentDateRange: { start: bounds.start, end: bounds.end },
    mapTab, setMapTab,
    mapDepartamento, setMapDepartamento, mapDepartamentos, mapSinDepartamento,
    kpis, chartData: chart.tramos, chartGranularity: chart.granularity, xAxisLabel, showTrend,
    urgentEvents, criticalObsEvents, topPostes, mapMarkers, criticalAlerts,
    dataPoste, setDataPoste, openEditPoste, setOpenEditPoste,
  };
}
