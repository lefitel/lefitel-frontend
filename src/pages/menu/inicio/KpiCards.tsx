import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { AlertTriangleIcon, BarChart3Icon, CheckCircle2Icon, MapPinIcon } from "lucide-react";
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Estado del sistema</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-6">

          {/* Postes totales */}
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
                <div className="text-3xl sm:text-4xl font-bold tracking-tight">{kpis?.postesTotal ?? 0}</div>
              )}
            </CardContent>
          </Card>

          {/* Hero card — Pendientes totales */}
          <Card
            className="sm:col-span-2 shadow-md border-0 transition-all hover:shadow-lg relative overflow-hidden py-0"
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
                <div className="text-3xl sm:text-5xl font-bold tracking-tight text-white">{kpis?.pendGlobal ?? 0}</div>
              )}
              {loading ? <Skeleton className="h-4 w-40 bg-white/20" /> : (
                <p className="text-xs text-white/40">sin resolver en el sistema</p>
              )}
            </CardContent>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-2 -right-2 w-20 h-20 rounded-full bg-white/5" />
          </Card>
        </div>
      </div>

      {/* Fila 2: Actividad del período */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actividad del período</p>
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1 self-start sm:self-auto">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Button key={p} variant={period === p ? "default" : "ghost"} size="sm" className="h-7 text-xs px-2 sm:px-3" onClick={() => setPeriod(p)}>
                {PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">

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

          {/* Pendientes del período */}
          <Card className="shadow-sm border-amber-500/20 transition-all hover:shadow-md hover:border-amber-500/40 py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-24" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Pendientes</p>
                )}
                <div className={`p-1.5 sm:p-2 rounded-full shrink-0 ${(kpis?.pendCurr ?? 0) > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                  <AlertTriangleIcon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${(kpis?.pendCurr ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                <div className={`text-3xl sm:text-4xl font-bold tracking-tight ${(kpis?.pendCurr ?? 0) > 0 ? "text-amber-500" : ""}`}>
                  {kpis?.pendCurr ?? 0}
                </div>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.pendCurr ?? 0} prev={kpis?.pendPrev ?? 0} invertTrend />
              ) : null}
            </CardContent>
          </Card>

          {/* Solucionados */}
          <Card className="shadow-sm border-primary/20 transition-all hover:shadow-md hover:border-primary/40 py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-24" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Solucionados</p>
                )}
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full shrink-0">
                  <CheckCircle2Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-14 mt-1" /> : (
                <div className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">{kpis?.solCurr ?? 0}</div>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.solCurr ?? 0} prev={kpis?.solPrev ?? 0} />
              ) : null}
            </CardContent>
          </Card>

          {/* Tasa de Resolución */}
          <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md py-0">
            <CardContent className="p-3 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-1">
                {loading ? <Skeleton className="h-4 w-32" /> : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">Tasa de Resolución</p>
                )}
                <div className="p-1.5 sm:p-2 bg-muted rounded-full shrink-0">
                  <BarChart3Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                </div>
              </div>
              {loading ? <Skeleton className="h-9 w-16 mt-1" /> : (
                <div className="text-3xl sm:text-4xl font-bold tracking-tight">{kpis?.resRateCurr ?? 0}%</div>
              )}
              {loading ? <Skeleton className="h-2 w-full rounded-full" /> : (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${kpis?.resRateCurr ?? 0}%` }} />
                </div>
              )}
              {loading ? <Skeleton className="h-4 w-36" /> : (
                <p className="text-xs text-muted-foreground">de {kpis?.openedCurr ?? 0} reportados</p>
              )}
              {loading ? <Skeleton className="h-5 w-28" /> : showTrend ? (
                <TrendBadge current={kpis?.resRateCurr ?? 0} prev={kpis?.resRatePrev ?? 0} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
