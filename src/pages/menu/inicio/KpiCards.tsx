import { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { Card, CardContent } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { DateRangePicker } from "../../../components/ui/date-range-picker";
import { AlertTriangleIcon, ClipboardCheckIcon, InfoIcon, MapPinIcon } from "lucide-react";
import { TrendBadge } from "./TrendBadge";
import { KpiData, Period, PERIOD_LABELS, CustomRange } from "./types";
import { AnimatedNumber } from "../../../components/AnimatedNumber";

interface KpiCardsProps {
  kpis: KpiData | null;
  loading: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
  showTrend: boolean;
  setCustomRange: (r: CustomRange) => void;
  currentDateRange: { start: Date; end: Date };
}

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 50);
    return () => clearTimeout(t);
  }, [pct]);
  return <div className={`${color} h-1.5 rounded-full transition-all duration-700 ease-out`} style={{ width: `${width}%` }} />;
}

export function KpiCards({ kpis, loading, period, setPeriod, showTrend, setCustomRange, currentDateRange }: KpiCardsProps) {
  const [interimRange, setInterimRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => { setInterimRange(undefined); }, [period]);

  const pickerValue: DateRange = interimRange ?? { from: currentDateRange.start, to: currentDateRange.end };

  function handleRangeChange(range: DateRange | undefined) {
    if (range?.from && range?.to) {
      setInterimRange(undefined);
      setPeriod("custom");
      setCustomRange({ start: range.from, end: range.to });
    } else {
      setInterimRange(range);
    }
  }

  return (
    <>
      {/* Fila 1: Estado global */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado del sistema</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Información sobre el estado del sistema" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                  <InfoIcon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <span className="block text-left leading-relaxed normal-case space-y-1.5">
                  <span className="block">
                    <strong className="font-semibold">Postes Registrados:</strong> total de postes en el sistema. La barra indica qué porcentaje tiene al menos una incidencia <strong className="font-semibold">pendiente actualmente</strong>.
                  </span>
                  <span className="block">
                    <strong className="font-semibold">Pendientes Totales:</strong> eventos sin resolver acumulados en toda la historia. La barra refleja la tasa global de resolución histórica.
                  </span>
                  <span className="block text-muted-foreground/70">
                    Métricas históricas — independientes del período seleccionado.
                  </span>
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
          {(() => {
            const postesTotal = kpis?.postesTotal ?? 0;
            const postesConInc = kpis?.postesConIncidencias ?? 0;
            const pctConIncidencias = postesTotal > 0 ? Math.round((postesConInc / postesTotal) * 100) : 0;
            const eventosTotal = kpis?.eventosTotal ?? 0;
            const eventosResueltos = kpis?.eventosResueltosTotal ?? 0;
            const pctResueltosGlobal = eventosTotal > 0 ? Math.round((eventosResueltos / eventosTotal) * 100) : 0;
            return (
              <>
                {/* Postes totales con desglose */}
                <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md py-0 animate-in fade-in duration-500">
                  <CardContent className="p-3 sm:p-5 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      {loading ? <Skeleton className="h-4 w-32" /> : (
                        <p className="text-xs text-muted-foreground font-medium leading-tight">Postes Registrados</p>
                      )}
                      <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full shrink-0">
                        <MapPinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                      </div>
                    </div>
                    {loading ? <Skeleton className="h-9 w-16 mt-1" /> : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                          <AnimatedNumber value={postesTotal} />
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground">
                          <AnimatedNumber value={pctConIncidencias} format={(n) => `${n}%`} /> con incidencias
                        </span>
                      </div>
                    )}
                    {loading ? <Skeleton className="h-2 w-full rounded-full" /> : (
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <AnimatedBar pct={pctConIncidencias} color="bg-primary" />
                      </div>
                    )}
                    {loading ? <Skeleton className="h-4 w-40" /> : (
                      <p className="text-xs text-muted-foreground">
                        <AnimatedNumber value={postesConInc} /> con incidencias · <AnimatedNumber value={postesTotal - postesConInc} /> sin incidencias
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Hero card — Pendientes totales con desglose y tasa global */}
                <Card
                  className="shadow-md border-0 transition-all hover:shadow-lg relative overflow-hidden py-0 animate-in fade-in duration-500"
                  style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 75%, black) 0%, var(--primary) 100%)" }}
                >
                  <CardContent className="p-3 sm:p-5 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      {loading ? <Skeleton className="h-4 w-48 bg-white/20" /> : (
                        <p className="text-xs sm:text-sm text-white/60 font-medium leading-tight">Pendientes Totales</p>
                      )}
                      <div className="p-1.5 sm:p-2 bg-white/10 rounded-full shrink-0">
                        <AlertTriangleIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                      </div>
                    </div>
                    {loading ? <Skeleton className="h-9 w-16 bg-white/20 mt-1" /> : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                          <AnimatedNumber value={kpis?.pendGlobal ?? 0} />
                        </span>
                        <span className="text-sm font-semibold text-white/70">
                          <AnimatedNumber value={pctResueltosGlobal} format={(n) => `${n}%`} /> resueltos
                        </span>
                      </div>
                    )}
                    {loading ? <Skeleton className="h-2 w-full rounded-full bg-white/15" /> : (
                      <div className="w-full bg-white/15 rounded-full h-1.5">
                        <AnimatedBar pct={pctResueltosGlobal} color="bg-white" />
                      </div>
                    )}
                    {loading ? <Skeleton className="h-4 w-40 bg-white/20" /> : (
                      <p className="text-xs text-white/60">
                        <AnimatedNumber value={kpis?.pendGlobal ?? 0} /> sin resolver · <AnimatedNumber value={eventosResueltos} /> resueltos
                      </p>
                    )}
                  </CardContent>
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
                  <div className="absolute -bottom-2 -right-2 w-20 h-20 rounded-full bg-white/5" />
                </Card>
              </>
            );
          })()}
        </div>
      </div>

      {/* Fila 2: Actividad del período */}
      <div>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actividad del período</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Información sobre las métricas del período" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                    <InfoIcon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm">
                  <span className="block text-left leading-relaxed normal-case space-y-1.5">
                    <span className="block">
                      <strong className="font-semibold">Postes Activos:</strong> unión única de postes creados, revisados y solucionados en el período — sin duplicados. Cada barra muestra cuántos postes de esa categoría hay respecto al total en el sistema.
                    </span>
                    <span className="block">
                      <strong className="font-semibold">Postes Revisados:</strong> postes únicos con al menos una revisión en el período. <em>Del total</em> = revisados sobre el total de postes. <em>Pendientes</em> = cuántos de esos revisados aún tienen eventos sin resolver.
                    </span>
                    <span className="block">
                      <strong className="font-semibold">Postes Solucionados:</strong> postes únicos con al menos un evento cuya <strong className="font-semibold">fecha de resolución</strong> cae en el período. <em>Del total</em> = solucionados sobre el total de postes. <em>Con incidencias</em> = solucionados sobre el total de postes que alguna vez tuvieron eventos.
                    </span>
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center justify-between gap-2">
            <DateRangePicker
              value={pickerValue}
              onChange={handleRangeChange}
              className={`text-xs h-8 transition-opacity duration-200 ${period !== "custom" ? "opacity-40 hover:opacity-70" : ""}`}
            />
            <SegmentedControl
              options={(Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
              value={period}
              onValueChange={setPeriod}
              scrollable
              ariaLabel="Período del dashboard"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">

          {/* Postes Activos — unión de creados + revisados + solucionados en el período */}
          {(() => {
            const total = kpis?.postesTotal ?? 0;
            const creados = kpis?.postesCurr ?? 0;
            const revisados = kpis?.postesRevisadosCurr ?? 0;
            const solucionados = kpis?.postesSolucionadosCurr ?? 0;
            const pctCreados    = total > 0 ? Math.min(Math.round((creados    / total) * 100), 100) : 0;
            const pctRevisados  = total > 0 ? Math.min(Math.round((revisados  / total) * 100), 100) : 0;
            const pctSolucionados = total > 0 ? Math.min(Math.round((solucionados / total) * 100), 100) : 0;
            return (
              <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md py-0 animate-in fade-in duration-500">
                <CardContent className="p-3 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    {loading ? <Skeleton className="h-4 w-32" /> : (
                      <p className="text-xs text-muted-foreground font-medium leading-tight">Postes Activos</p>
                    )}
                    <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full shrink-0">
                      <MapPinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                    </div>
                  </div>
                  {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                      <AnimatedNumber value={kpis?.postesActivosCurr ?? 0} />
                    </div>
                  )}
                  {loading ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { label: "Creados",      numerator: creados,      pct: pctCreados,      color: "bg-primary" },
                        { label: "Revisados",    numerator: revisados,    pct: pctRevisados,    color: "bg-amber-500" },
                        { label: "Solucionados", numerator: solucionados, pct: pctSolucionados, color: "bg-blue-500" },
                      ].map(({ label, numerator, pct, color }) => (
                        <div key={label}>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <AnimatedBar pct={pct} color={color} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">{numerator} de {total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                    <TrendBadge current={kpis?.postesActivosCurr ?? 0} prev={kpis?.postesActivosPrev ?? 0} />
                  ) : null}
                </CardContent>
              </Card>
            );
          })()}

          {/* Postes Revisados — postes únicos con al menos una revisión en el período */}
          {(() => {
            const totalPostes = kpis?.postesTotal ?? 0;
            const revisados = kpis?.postesRevisadosCurr ?? 0;
            const pendientes = kpis?.postesPendientesRevisadosCurr ?? 0;
            const revPct = totalPostes > 0
              ? Math.min(Math.round((revisados / totalPostes) * 100), 100)
              : 0;
            const pendPct = revisados > 0
              ? Math.min(Math.round((pendientes / revisados) * 100), 100)
              : 0;
            return (
              <Card className="shadow-sm border-amber-500/20 transition-all hover:shadow-md hover:border-amber-500/40 py-0 animate-in fade-in duration-500">
                <CardContent className="p-3 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    {loading ? <Skeleton className="h-4 w-32" /> : (
                      <p className="text-xs text-muted-foreground font-medium leading-tight">Postes Revisados</p>
                    )}
                    <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-full shrink-0">
                      <MapPinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
                    </div>
                  </div>
                  {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight text-amber-500">
                      <AnimatedNumber value={revisados} />
                    </div>
                  )}
                  {loading ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { label: "Del total",  pct: revPct,  numerator: revisados,  denominator: totalPostes, color: "bg-amber-500" },
                        { label: "Pendientes", pct: pendPct, numerator: pendientes, denominator: revisados,   color: "bg-red-500"   },
                      ].map(({ label, pct, numerator, denominator, color }) => (
                        <div key={label}>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <AnimatedBar pct={pct} color={color} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{numerator} de {denominator}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                    <TrendBadge current={revisados} prev={kpis?.postesRevisadosPrev ?? 0} />
                  ) : null}
                </CardContent>
              </Card>
            );
          })()}

          {/* Postes Solucionados — postes únicos con al menos un evento resuelto en el período */}
          {(() => {
            const totalPostes = kpis?.postesTotal ?? 0;
            const postesConEventos = kpis?.postesConEventos ?? 0;
            const solucionados = kpis?.postesSolucionadosCurr ?? 0;
            const solPct = totalPostes > 0
              ? Math.min(Math.round((solucionados / totalPostes) * 100), 100)
              : 0;
            const coberturaPct = postesConEventos > 0
              ? Math.min(Math.round((solucionados / postesConEventos) * 100), 100)
              : 0;
            return (
              <Card className="shadow-sm border-blue-500/20 transition-all hover:shadow-md hover:border-blue-500/40 py-0 animate-in fade-in duration-500">
                <CardContent className="p-3 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    {loading ? <Skeleton className="h-4 w-28" /> : (
                      <p className="text-xs text-muted-foreground font-medium leading-tight">Postes Solucionados</p>
                    )}
                    <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-full shrink-0">
                      <ClipboardCheckIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />
                    </div>
                  </div>
                  {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight text-blue-500">
                      <AnimatedNumber value={solucionados} />
                    </div>
                  )}
                  {loading ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { label: "Del total",       pct: solPct,       numerator: solucionados, denominator: totalPostes,      color: "bg-blue-500"    },
                        { label: "Con incidencias", pct: coberturaPct, numerator: solucionados, denominator: postesConEventos, color: "bg-emerald-500" },
                      ].map(({ label, pct, numerator, denominator, color }) => (
                        <div key={label}>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <AnimatedBar pct={pct} color={color} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{numerator} de {denominator}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                    <TrendBadge current={solucionados} prev={kpis?.postesSolucionadosPrev ?? 0} />
                  ) : null}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>
    </>
  );
}
