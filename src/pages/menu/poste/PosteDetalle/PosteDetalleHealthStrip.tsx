import { useMemo } from "react";
import { EventoInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { ActivityIcon, AlertTriangleIcon, ClockIcon, GaugeIcon, InfoIcon } from "lucide-react";
import { daysOpen } from "../../inicio/helpers";

type HealthStatus = "operativo" | "atencion" | "critico";

interface Props {
  loading: boolean;
  eventos: EventoInterface[];
}

interface HealthMetrics {
  status: HealthStatus;
  pendientes: number;
  criticos: number;
  ultimoEvento: EventoInterface | null;
  mttrDays: number | null;
  oldestOpen: Date | null;
  totalResueltos: number;
  mttrSampleSize: number;
}

function fmtShort(d: Date | string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function computeMetrics(eventos: EventoInterface[]): HealthMetrics {
  const abiertos = eventos.filter((e) => !e.state);
  const criticos = abiertos.filter((e) => e.priority).length;
  const pendientes = abiertos.length;

  const status: HealthStatus =
    criticos > 0 ? "critico" : pendientes > 0 ? "atencion" : "operativo";

  const ultimoEvento = [...eventos].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0] ?? null;

  const oldestOpen = abiertos.length > 0
    ? new Date(Math.min(...abiertos.map((e) => new Date(e.date).getTime())))
    : null;

  const resueltos = eventos.filter((e) => e.state);
  const tiempos = resueltos
    .map((e) => {
      const sol = e.solucions?.[0];
      const end = sol?.date ?? e.updatedAt;
      if (!end) return null;
      const ms = new Date(end).getTime() - new Date(e.date).getTime();
      return ms > 0 ? ms / 86_400_000 : null;
    })
    .filter((d): d is number => d !== null);

  const mttrDays =
    tiempos.length > 0
      ? Math.round((tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10) / 10
      : null;

  return { status, pendientes, criticos, ultimoEvento, mttrDays, oldestOpen, totalResueltos: resueltos.length, mttrSampleSize: tiempos.length };
}

const STATUS_CONFIG: Record<
  HealthStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  operativo: {
    label: "Operativo",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  atencion: {
    label: "Atención",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  critico: {
    label: "Crítico",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
  },
};

export default function PosteDetalleHealthStrip({ loading, eventos }: Props) {
  const m = useMemo(() => computeMetrics(eventos), [eventos]);
  const cfg = STATUS_CONFIG[m.status];

  if (loading) {
    return (
      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 lg:px-3 first:lg:pl-0 last:lg:pr-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-muted/60 py-0">
      <CardContent className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 lg:divide-x divide-border/40">
        {/* Estado */}
        <Cell label="Estado" icon={<ActivityIcon className="h-3.5 w-3.5" />}>
          <div className="flex items-center gap-2">
            <span className={`h-6 w-6 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
              <span className={`h-3 w-3 rounded-full ${cfg.dot}`} />
            </span>
            <span className={`text-lg font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>
          <p className={`text-xs mt-1.5 leading-relaxed ${m.status === "critico" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            {m.status === "operativo" && "Sin incidencias activas"}
            {m.status === "atencion" && (m.oldestOpen ? `Desde el ${fmtShort(m.oldestOpen)}` : "Hay eventos pendientes")}
            {m.status === "critico" && "Requiere atención inmediata"}
          </p>
        </Cell>

        {/* Eventos abiertos */}
        <Cell
          label="Eventos abiertos"
          icon={<AlertTriangleIcon className={`h-3.5 w-3.5 ${m.pendientes > 0 ? "text-amber-500" : ""}`} />}
        >
          {m.pendientes === 0 ? (
            <p className="text-lg font-semibold text-muted-foreground">Ninguno</p>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold leading-none ${m.criticos > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                {m.pendientes}
              </span>
              {m.criticos > 0 && (
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  · {m.criticos} crítico{m.criticos === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {m.totalResueltos > 0
              ? `${m.totalResueltos} resuelto${m.totalResueltos === 1 ? "" : "s"} en total`
              : "Sin histórico resuelto"}
          </p>
        </Cell>

        {/* Último evento */}
        <Cell label="Último evento" icon={<ClockIcon className="h-3.5 w-3.5" />}>
          {m.ultimoEvento ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium truncate" title={m.ultimoEvento.description}>
                {m.ultimoEvento.description}
              </p>
              <p className="text-xs text-muted-foreground">{daysOpen(m.ultimoEvento.date)}</p>
            </div>
          ) : (
            <p className="text-lg font-semibold text-muted-foreground">—</p>
          )}
        </Cell>

        {/* MTTR */}
        <Cell
          label={
            <span className="inline-flex items-center gap-1">
              MTTR
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/60 hover:text-muted-foreground inline-flex">
                    <InfoIcon className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-60">
                  Tiempo medio que tardan los eventos resueltos de este poste en cerrarse.
                </TooltipContent>
              </Tooltip>
            </span>
          }
          icon={<GaugeIcon className="h-3.5 w-3.5" />}
        >
          {m.mttrDays !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold leading-none">{m.mttrDays}</span>
              <span className="text-xs text-muted-foreground">días</span>
            </div>
          ) : (
            <p className="text-lg font-semibold text-muted-foreground">—</p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            {m.mttrSampleSize > 0
              ? `Basado en ${m.mttrSampleSize} evento${m.mttrSampleSize === 1 ? "" : "s"}`
              : "Sin eventos resueltos"}
          </p>
        </Cell>
      </CardContent>
    </Card>
  );
}

function Cell({
  label,
  icon,
  children,
}: {
  label: React.ReactNode;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:px-3 first:lg:pl-0 last:lg:pr-0 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
