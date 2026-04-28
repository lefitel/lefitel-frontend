import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { AlertTriangleIcon, ClipboardCheckIcon, FilePlusIcon, InfoIcon, MapPinIcon } from "lucide-react";
import { TrendBadge } from "./TrendBadge";
import { KpiData, Period, PERIOD_LABELS } from "./types";

interface KpiCardsProps {
  kpis: KpiData | null;
  loading: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
  showTrend: boolean;
}

export function KpiCards({ kpis, loading, period, setPeriod, showTrend }: KpiCardsProps) {
  return (
    <>
      {/* Fila 1: Estado global */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado del sistema</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button type="button" aria-label="Información sobre el estado del sistema" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                    <InfoIcon className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <TooltipContent side="right" className="max-w-sm">
                <span className="block text-left leading-relaxed normal-case space-y-1.5">
                  <span className="block">
                    <strong className="font-semibold">Postes registrados:</strong> total de postes en el sistema y cuántos tienen al menos una incidencia <strong className="font-semibold">pendiente</strong>.
                  </span>
                  <span className="block">
                    <strong className="font-semibold">Pendientes totales:</strong> eventos sin resolver acumulados en toda la historia. La barra muestra la tasa global de resolución.
                  </span>
                  <span className="block text-muted/80">
                    Métricas históricas — no dependen del período seleccionado.
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
                <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md py-0">
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
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight">{postesTotal}</span>
                        <span className="text-sm font-semibold text-muted-foreground">{pctConIncidencias}% con incidencias</span>
                      </div>
                    )}
                    {loading ? <Skeleton className="h-2 w-full rounded-full" /> : (
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${pctConIncidencias}%` }} />
                      </div>
                    )}
                    {loading ? <Skeleton className="h-4 w-40" /> : (
                      <p className="text-xs text-muted-foreground">
                        {postesConInc} con incidencias · {postesTotal - postesConInc} sin incidencias
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Hero card — Pendientes totales con desglose y tasa global */}
                <Card
                  className="shadow-md border-0 transition-all hover:shadow-lg relative overflow-hidden py-0"
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
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{kpis?.pendGlobal ?? 0}</span>
                        <span className="text-sm font-semibold text-white/70">{pctResueltosGlobal}% resueltos</span>
                      </div>
                    )}
                    {loading ? <Skeleton className="h-2 w-full rounded-full bg-white/15" /> : (
                      <div className="w-full bg-white/15 rounded-full h-1.5">
                        <div className="bg-white h-1.5 rounded-full transition-all duration-500" style={{ width: `${pctResueltosGlobal}%` }} />
                      </div>
                    )}
                    {loading ? <Skeleton className="h-4 w-40 bg-white/20" /> : (
                      <p className="text-xs text-white/60">
                        {kpis?.pendGlobal ?? 0} sin resolver · {eventosResueltos} resueltos
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actividad del período</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button type="button" aria-label="Información sobre las métricas del período" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  }
                />
                <TooltipContent side="right" className="max-w-sm">
                  <span className="block text-left leading-relaxed normal-case space-y-1.5">
                    <span className="block">
                      <strong className="font-semibold">Eventos registrados:</strong> incidencias <strong className="font-semibold">creadas</strong> en el período. Mide el flujo de entrada.
                    </span>
                    <span className="block">
                      <strong className="font-semibold">Eventos revisados:</strong> incidencias con al menos una <strong className="font-semibold">revisión</strong> en el período (incluye históricas que siguen vivas). Mide el trabajo realizado.
                    </span>
                    <span className="block text-muted/80">
                      Cada card muestra el porcentaje de eventos resueltos sobre su propio total.
                    </span>
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1 self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Button key={p} variant={period === p ? "default" : "ghost"} size="sm" className="h-7 text-xs px-2 sm:px-3 shrink-0 whitespace-nowrap" onClick={() => setPeriod(p)}>
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">

          {/* Postes del período */}
          <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-32" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Postes Registrados</p>
                )}
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full shrink-0">
                  <MapPinIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                <div className="text-3xl sm:text-4xl font-bold tracking-tight">{kpis?.postesCurr ?? 0}</div>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.postesCurr ?? 0} prev={kpis?.postesPrev ?? 0} />
              ) : null}
            </CardContent>
          </Card>

          {/* Eventos registrados — del período con desglose y tasa */}
          <Card className="shadow-sm border-amber-500/20 transition-all hover:shadow-md hover:border-amber-500/40 py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-32" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Eventos registrados</p>
                )}
                <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-full shrink-0">
                  <FilePlusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-amber-500">{kpis?.openedCurr ?? 0}</span>
                  <span className="text-sm font-semibold text-muted-foreground">{kpis?.resRateCurr ?? 0}% resueltos</span>
                </div>
              )}
              {loading ? <Skeleton className="h-2 w-full rounded-full" /> : (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${kpis?.resRateCurr ?? 0}%` }} />
                </div>
              )}
              {loading ? <Skeleton className="h-4 w-36" /> : (
                <p className="text-xs text-muted-foreground">
                  {kpis?.pendCurr ?? 0} pendientes · {kpis?.solCurr ?? 0} resueltos
                </p>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.openedCurr ?? 0} prev={kpis?.openedPrev ?? 0} />
              ) : null}
            </CardContent>
          </Card>

          {/* Eventos revisados — incluye históricos, con desglose y tasa */}
          <Card className="shadow-sm border-blue-500/20 transition-all hover:shadow-md hover:border-blue-500/40 py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-28" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Eventos revisados</p>
                )}
                <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-full shrink-0">
                  <ClipboardCheckIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-blue-500">{kpis?.reviewedCurr ?? 0}</span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {(kpis?.reviewedCurr ?? 0) > 0 ? Math.round(((kpis?.reviewedSolved ?? 0) / (kpis?.reviewedCurr ?? 1)) * 100) : 0}% resueltos
                  </span>
                </div>
              )}
              {loading ? <Skeleton className="h-2 w-full rounded-full" /> : (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${(kpis?.reviewedCurr ?? 0) > 0 ? Math.round(((kpis?.reviewedSolved ?? 0) / (kpis?.reviewedCurr ?? 1)) * 100) : 0}%`,
                    }}
                  />
                </div>
              )}
              {loading ? <Skeleton className="h-4 w-36" /> : (
                <p className="text-xs text-muted-foreground">
                  {kpis?.reviewedPending ?? 0} sin resolver · {kpis?.reviewedSolved ?? 0} resueltos
                </p>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.reviewedCurr ?? 0} prev={kpis?.reviewedPrev ?? 0} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
