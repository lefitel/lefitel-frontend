import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { getDashboard, DashboardEvento, DashboardPoste } from "../../../api/dashboard.api";
import { PosteInterface } from "../../../interfaces/interfaces";
import { posteExample } from "../../../data/example";
import { Period, MapTab, KpiData, MapMarker, MONTH_NAMES } from "./types";
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
  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;
  kpis: KpiData | null;
  chartData: { label: string; pending: number; solved: number }[];
  xAxisLabel: string;
  showTrend: boolean;
  urgentEvents: DashboardEvento[];
  topPostes: { name: string; count: number }[];
  mapMarkers: MapMarker[];
  criticalAlerts: CriticalAlert;
  token: string;
  dataPoste: PosteInterface;
  setDataPoste: (p: PosteInterface) => void;
  openEditPoste: boolean;
  setOpenEditPoste: (v: boolean) => void;
}

export function useInicioData(): InicioData {
  const { sesion } = useContext(SesionContext);

  const [listPostes, setListPostes] = useState<DashboardPoste[] | null>(null);
  const [listEventos, setListEventos] = useState<DashboardEvento[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
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

  const bounds = useMemo(() => getPeriodBounds(period), [period]);

  const kpis = useMemo((): KpiData | null => {
    if (!listEventos || !listPostes) return null;
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    const inPrev = period === "all" ? () => true : (d: Date) => d >= bounds.prevStart && d <= bounds.prevEnd;
    const hasRevicionInCurr = (e: DashboardEvento) =>
      (e.revicions ?? []).some((r) => inCurr(new Date(r.date)));
    const hasRevicionInPrev = (e: DashboardEvento) =>
      (e.revicions ?? []).some((r) => inPrev(new Date(r.date)));

    const postesTotal = listPostes.length;
    const postesCurr = listPostes.filter((p) => inCurr(new Date(p.date))).length;
    const postesPrev = listPostes.filter((p) => inPrev(new Date(p.date))).length;
    const postesConPendientes = new Set(listEventos.filter((e) => !e.state).map((e) => e.id_poste));
    const postesConIncidencias = postesConPendientes.size;
    const eventosTotal = listEventos.length;
    const eventosResueltosTotal = listEventos.filter((e) => e.state).length;
    const pendGlobal = listEventos.filter((e) => !e.state).length;
    const pendCurr = listEventos.filter((e) => !e.state && inCurr(new Date(e.date))).length;
    const pendPrev = listEventos.filter((e) => !e.state && inPrev(new Date(e.date))).length;
    const solCurr = listEventos.filter((e) => e.state && inCurr(new Date(e.date))).length;
    const solPrev = listEventos.filter((e) => e.state && inPrev(new Date(e.date))).length;
    const openedCurr = listEventos.filter((e) => inCurr(new Date(e.date))).length;
    const openedPrev = listEventos.filter((e) => inPrev(new Date(e.date))).length;
    const resRateCurr = openedCurr > 0 ? Math.round((solCurr / openedCurr) * 100) : 0;
    const resRatePrev = openedPrev > 0 ? Math.round((solPrev / openedPrev) * 100) : 0;

    const reviewedList = listEventos.filter(hasRevicionInCurr);
    const reviewedCurr = reviewedList.length;
    const reviewedPrev = listEventos.filter(hasRevicionInPrev).length;
    const reviewedSolved = reviewedList.filter((e) => e.state).length;
    const reviewedPending = reviewedList.filter((e) => !e.state).length;

    return {
      postesTotal, postesConIncidencias, eventosTotal, eventosResueltosTotal,
      postesCurr, postesPrev, pendGlobal, pendCurr, pendPrev,
      solCurr, solPrev, resRateCurr, resRatePrev, openedCurr, openedPrev,
      reviewedCurr, reviewedPrev, reviewedSolved, reviewedPending,
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
          const t = new Date(e.date).getTime();
          if (t >= dayStart && t < dayEnd) {
            if (!e.state) pending++; else solved++;
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
          const d = new Date(e.date);
          if (d.getDate() === day && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            if (!e.state) pending++; else solved++;
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
          solved: listEventos.filter((e) => { const dd = new Date(e.date); return e.state && dd.getMonth() === month && dd.getFullYear() === year; }).length,
        };
      });
    }
    if (period === "year") {
      return Array.from({ length: 12 }, (_, m) => ({
        label: MONTH_NAMES[m],
        pending: listEventos.filter((e) => { const d = new Date(e.date); return !e.state && d.getMonth() === m && d.getFullYear() === now.getFullYear(); }).length,
        solved: listEventos.filter((e) => { const d = new Date(e.date); return e.state && d.getMonth() === m && d.getFullYear() === now.getFullYear(); }).length,
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
      solved: listEventos.filter((e) => { const d = new Date(e.date); return e.state && d.getMonth() === month && d.getFullYear() === year; }).length,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEventos, period, bounds]);

  const xAxisLabel =
    period === "fortnight" ? "Día — últimos 15 días" :
    period === "month"   ? `Día — ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` :
    period === "quarter" ? "Últimos 3 meses" :
    period === "year"    ? `Mes — ${now.getFullYear()}` :
    "Histórico completo (por mes)";

  const showTrend = period !== "all";

  const urgentEvents = useMemo(() => {
    if (!listEventos) return [];
    const inCurr = period === "all" ? () => true : (d: Date) => d >= bounds.start && d <= bounds.end;
    return [...listEventos]
      .filter((e) => !e.state && e.priority && inCurr(new Date(e.date)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [listEventos, bounds, period]);

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
    if (mapTab === "postes") {
      return (listPostes ?? []).filter((p) => inCurr(new Date(p.date))).map((p) => ({
        lat: p.lat, lng: p.lng, label: p.name, isPoste: true as const, item: p,
      }));
    }
    return (listEventos ?? [])
      .filter((e) => {
        const hasCoords = (e.poste?.lat ?? 0) !== 0 && (e.poste?.lng ?? 0) !== 0;
        return inCurr(new Date(e.date)) && hasCoords && (mapTab === "pendientes" ? !e.state : e.state);
      })
      .map((e) => ({ lat: e.poste!.lat, lng: e.poste!.lng, label: e.poste?.name ?? "—", isPoste: false as const, item: e }));
  }, [listPostes, listEventos, mapTab, bounds, period]);

  return {
    loading, load, period, setPeriod, mapTab, setMapTab,
    kpis, chartData, xAxisLabel, showTrend,
    urgentEvents, topPostes, mapMarkers, criticalAlerts,
    token: sesion.token,
    dataPoste, setDataPoste, openEditPoste, setOpenEditPoste,
  };
}
