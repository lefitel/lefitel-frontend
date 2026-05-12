import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
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
  load: () => void;
  period: Period;
  setPeriod: (p: Period) => void;
  customRange: CustomRange;
  setCustomRange: (r: CustomRange) => void;
  currentDateRange: { start: Date; end: Date };
  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;
  kpis: KpiData | null;
  chartData: { label: string; pending: number; solved: number }[];
  xAxisLabel: string;
  showTrend: boolean;
  urgentEvents: DashboardEvento[];
  criticalObsEvents: DashboardEvento[];
  topPostes: { name: string; count: number }[];
  mapMarkers: MapMarker[];
  criticalAlerts: CriticalAlert;
  token: string;
  dataPoste: PosteInterface;
  setDataPoste: (p: PosteInterface) => void;
  openEditPoste: boolean;
  setOpenEditPoste: (v: boolean) => void;
}

const getSolDate = (e: DashboardEvento): Date | null => {
  const d = e.solucions?.[0]?.date;
  return d ? new Date(d) : null;
};

export function useInicioData(): InicioData {
  const { sesion } = useContext(SesionContext);

  const [listPostes, setListPostes] = useState<DashboardPoste[] | null>(null);
  const [listEventos, setListEventos] = useState<DashboardEvento[] | null>(null);
  const [loading, setLoading] = useState(true);
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
      const data = await getDashboard(sesion.token);
      setListEventos(data.eventos);
      setListPostes(data.postes);
    } catch {
      toast.error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [sesion.token]);

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

    const postesTotal = listPostes.length;
    const postesCurr = listPostes.filter((p) => inCurr(new Date(p.date))).length;
    const postesConPendientes = new Set(listEventos.filter((e) => !e.state).map((e) => e.id_poste));
    const postesConIncidencias = postesConPendientes.size;
    const postesConEventos = new Set(listEventos.filter((e) => e.id_poste != null).map((e) => e.id_poste)).size;
    const eventosTotal = listEventos.length;
    const eventosResueltosTotal = listEventos.filter((e) => e.state).length;
    const pendGlobal = listEventos.filter((e) => !e.state).length;

    const reviewedList = listEventos.filter(hasRevisionInCurr);
    const postesRevisadosCurr = new Set(reviewedList.map((e) => e.id_poste)).size;
    const postesRevisadosPrev = new Set(listEventos.filter(hasRevisionInPrev).map((e) => e.id_poste)).size;
    const pendientesRevisadosCurr = reviewedList.filter((e) => !e.state);
    const postesPendientesRevisadosCurr = new Set(pendientesRevisadosCurr.map((e) => e.id_poste)).size;

    const postesSolucionadosIdsCurr = new Set(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inCurr(d); }).map((e) => e.id_poste));
    const postesSolucionadosCurr = postesSolucionadosIdsCurr.size;
    const postesSolucionadosPrev = new Set(listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inPrev(d); }).map((e) => e.id_poste)).size;

    const creadosIds = new Set(listPostes.filter((p) => inCurr(new Date(p.date))).map((p) => p.id));
    const revisadosIds = new Set(reviewedList.map((e) => e.id_poste));
    const postesActivosCurr = new Set([...creadosIds, ...revisadosIds, ...postesSolucionadosIdsCurr]).size;
    const postesActivosPrev = new Set([
      ...listPostes.filter((p) => inPrev(new Date(p.date))).map((p) => p.id),
      ...listEventos.filter(hasRevisionInPrev).map((e) => e.id_poste),
      ...listEventos.filter((e) => { const d = getSolDate(e); return e.state && !!d && inPrev(d); }).map((e) => e.id_poste),
    ]).size;

    return {
      postesTotal, postesConIncidencias, postesConEventos,
      eventosTotal, eventosResueltosTotal, pendGlobal,
      postesCurr, postesRevisadosCurr, postesRevisadosPrev,
      postesPendientesRevisadosCurr,
      postesSolucionadosCurr, postesSolucionadosPrev,
      postesActivosCurr, postesActivosPrev,
    };
  }, [listEventos, listPostes, bounds, period]);

  const chartData = useMemo(() => {
    if (!listEventos) return [];
    if (period === "fortnight") {
      return Array.from({ length: 15 }, (_, i) => {
        const day = new Date(bounds.start);
        day.setDate(day.getDate() + i);
        const dayStart = day.getTime();
        const dayEnd = dayStart + 86_400_000;
        let pending = 0, solved = 0;
        listEventos.forEach((e) => {
          if (!e.state) {
            const t = new Date(e.date).getTime();
            if (t >= dayStart && t < dayEnd) pending++;
          } else {
            const d = getSolDate(e);
            if (d && d.getTime() >= dayStart && d.getTime() < dayEnd) solved++;
          }
        });
        return { label: `${day.getDate()}/${day.getMonth() + 1}`, pending, solved };
      });
    }
    if (period === "month") {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        let pending = 0, solved = 0;
        listEventos.forEach((e) => {
          if (!e.state) {
            const d = new Date(e.date);
            if (d.getDate() === day && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) pending++;
          } else {
            const d = getSolDate(e);
            if (d && d.getDate() === day && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) solved++;
          }
        });
        return { label: day.toString(), pending, solved };
      });
    }
    if (period === "quarter") {
      return [0, 1, 2].map((i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
        const month = d.getMonth(), year = d.getFullYear();
        return {
          label: MONTH_NAMES[month],
          pending: listEventos.filter((e) => { const dd = new Date(e.date); return !e.state && dd.getMonth() === month && dd.getFullYear() === year; }).length,
          solved: listEventos.filter((e) => { const dd = getSolDate(e); return !!dd && dd.getMonth() === month && dd.getFullYear() === year; }).length,
        };
      });
    }
    if (period === "year") {
      return Array.from({ length: 12 }, (_, m) => ({
        label: MONTH_NAMES[m],
        pending: listEventos.filter((e) => { const d = new Date(e.date); return !e.state && d.getMonth() === m && d.getFullYear() === now.getFullYear(); }).length,
        solved: listEventos.filter((e) => { const d = getSolDate(e); return !!d && d.getMonth() === m && d.getFullYear() === now.getFullYear(); }).length,
      }));
    }
    if (period === "custom") {
      const diffDays = Math.ceil((customRange.end.getTime() - customRange.start.getTime()) / 86_400_000);
      if (diffDays <= 90) {
        // daily
        return Array.from({ length: diffDays + 1 }, (_, i) => {
          const day = new Date(customRange.start);
          day.setDate(day.getDate() + i);
          const dayStart = day.getTime();
          const dayEnd = dayStart + 86_400_000;
          let pending = 0, solved = 0;
          listEventos.forEach((e) => {
            if (!e.state) {
              const t = new Date(e.date).getTime();
              if (t >= dayStart && t < dayEnd) pending++;
            } else {
              const d = getSolDate(e);
              if (d && d.getTime() >= dayStart && d.getTime() < dayEnd) solved++;
            }
          });
          return { label: `${day.getDate()}/${day.getMonth() + 1}`, pending, solved };
        });
      }
      if (diffDays <= 365) {
        // weekly — always ≥ 13 points for ranges > 90 days
        const weeks = Math.ceil((diffDays + 1) / 7);
        return Array.from({ length: weeks }, (_, i) => {
          const weekStart = new Date(customRange.start);
          weekStart.setDate(weekStart.getDate() + i * 7);
          weekStart.setHours(0, 0, 0, 0);
          const ws = weekStart.getTime();
          const we = Math.min(ws + 7 * 86_400_000, customRange.end.getTime() + 86_400_000);
          let pending = 0, solved = 0;
          listEventos.forEach((e) => {
            if (!e.state) {
              const t = new Date(e.date).getTime();
              if (t >= ws && t < we) pending++;
            } else {
              const d = getSolDate(e);
              if (d && d.getTime() >= ws && d.getTime() < we) solved++;
            }
          });
          return { label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, pending, solved };
        });
      }
      // monthly for ranges > 1 year
      const months: { label: string; month: number; year: number }[] = [];
      let cursor = new Date(customRange.start.getFullYear(), customRange.start.getMonth(), 1);
      const endCursor = new Date(customRange.end.getFullYear(), customRange.end.getMonth(), 1);
      while (cursor <= endCursor) {
        months.push({ label: `${MONTH_NAMES[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`, month: cursor.getMonth(), year: cursor.getFullYear() });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      return months.map(({ label, month, year }) => ({
        label,
        pending: listEventos.filter((e) => { const d = new Date(e.date); return !e.state && d.getMonth() === month && d.getFullYear() === year; }).length,
        solved: listEventos.filter((e) => { const d = getSolDate(e); return !!d && d.getMonth() === month && d.getFullYear() === year; }).length,
      }));
    }
    // "all"
    const systemStart = new Date(2020, 0, 1).getTime();
    const allMs = listEventos.map((e) => new Date(e.date).getTime()).filter((ms) => !isNaN(ms) && ms >= systemStart);
    const earliest = allMs.length > 0 ? new Date(Math.min(...allMs)) : new Date(2020, 0, 1);
    const months: { label: string; month: number; year: number }[] = [];
    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const endCursor = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
    while (cursor <= endCursor) {
      months.push({ label: `${MONTH_NAMES[cursor.getMonth()]} '${String(cursor.getFullYear()).slice(2)}`, month: cursor.getMonth(), year: cursor.getFullYear() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return months.map(({ label, month, year }) => ({
      label,
      pending: listEventos.filter((e) => { const d = new Date(e.date); return !e.state && d.getMonth() === month && d.getFullYear() === year; }).length,
      solved: listEventos.filter((e) => { const d = getSolDate(e); return !!d && d.getMonth() === month && d.getFullYear() === year; }).length,
    }));
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
    loading, load, period, setPeriod, customRange, setCustomRange,
    currentDateRange: { start: bounds.start, end: bounds.end },
    mapTab, setMapTab,
    kpis, chartData, xAxisLabel, showTrend,
    urgentEvents, criticalObsEvents, topPostes, mapMarkers, criticalAlerts,
    token: sesion.token,
    dataPoste, setDataPoste, openEditPoste, setOpenEditPoste,
  };
}
