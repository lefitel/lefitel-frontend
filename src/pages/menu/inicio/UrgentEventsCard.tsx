import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { DashboardEvento } from "../../../api/dashboard.api";
import { daysOpen } from "./helpers";
import { useNavigate } from "react-router-dom";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

type Tab = "urgentes" | "criticos";

interface UrgentEventsCardProps {
  urgentEvents: DashboardEvento[];
  criticalObsEvents: DashboardEvento[];
  loading: boolean;
}

const CRITICALITY_COLORS: Record<number, string> = {
  1: "bg-red-500/15 text-red-600",
  2: "bg-red-400/15 text-red-500",
  3: "bg-orange-600/15 text-orange-600",
  4: "bg-orange-500/15 text-orange-500",
  5: "bg-amber-500/15 text-amber-600",
  6: "bg-amber-400/15 text-amber-500",
  7: "bg-yellow-500/15 text-yellow-600",
  8: "bg-yellow-400/15 text-yellow-500",
  9: "bg-yellow-300/15 text-yellow-500",
};

const CriticalObsCell = ({ evento }: { evento: DashboardEvento }) => {
  const obs = (evento.eventoObs ?? [])
    .filter((eo) => eo.ob?.criticality != null)
    .map((eo) => eo.ob!)
    .sort((a, b) => (a.criticality ?? 9) - (b.criticality ?? 9));
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {obs.map((ob) => (
        <span key={ob.id} className="flex items-center gap-1">
          <span className="truncate">{ob.name}</span>
          <span className={`shrink-0 text-[10px] font-semibold rounded px-1 py-px leading-none ${CRITICALITY_COLORS[ob.criticality ?? 9] ?? "bg-muted text-muted-foreground"}`}>
            {ob.criticality}
          </span>
        </span>
      ))}
    </span>
  );
};

const DESCRIPTIONS: Record<Tab, string> = {
  urgentes: "Todos los eventos de alta prioridad sin resolver, ordenados por antigüedad.",
  criticos: "Eventos pendientes con al menos una observación con criticidad asignada.",
};

const TOOLTIP: Record<Tab, string> = {
  urgentes: "Eventos con la bandera de alta prioridad activada y aún sin resolver, independientemente del período. Ordenados por antigüedad — los más viejos primero.",
  criticos: "Eventos pendientes que tienen al menos una observación con criticidad asignada. Ordenados por nivel de criticidad — los más críticos (nivel 1) primero.",
};

export function UrgentEventsCard({ urgentEvents, criticalObsEvents, loading }: UrgentEventsCardProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("urgentes");

  const events = tab === "urgentes" ? urgentEvents : criticalObsEvents;
  const level1Count = criticalObsEvents.filter((e) =>
    (e.eventoObs ?? []).some((eo) => eo.ob?.criticality === 1)
  ).length;

  return (
    <Card className="shadow-sm border-muted/60 flex flex-col h-80 sm:h-105">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle>Alertas</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="¿Qué eventos aparecen aquí?" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <span className="block text-left leading-relaxed normal-case">
                      {TOOLTIP[tab]}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>{DESCRIPTIONS[tab]}</CardDescription>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="urgentes" className="text-xs h-8 gap-1.5">
                Urgentes
                {!loading && (
                  <span className="bg-primary/10 text-primary rounded-full px-1.5 py-px text-[10px] font-semibold leading-none">
                    {urgentEvents.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="criticos" className="text-xs h-8 gap-1.5">
                Obs. crítica
                {!loading && level1Count > 0 && (
                  <span className="bg-red-500/10 text-red-500 rounded-full px-1.5 py-px text-[10px] font-semibold leading-none">
                    {level1Count}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead>Poste</TableHead>
              <TableHead className="hidden sm:table-cell">
                {tab === "urgentes" ? "Descripción" : "Observación"}
              </TableHead>
              <TableHead className="hidden sm:table-cell">Abierto</TableHead>
              <TableHead className="text-right pr-4">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              </TableRow>
            ))}
            {!loading && events.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                  {tab === "urgentes"
                    ? "No hay eventos urgentes pendientes."
                    : "No hay eventos con observaciones críticas pendientes."}
                </TableCell>
              </TableRow>
            )}
            {!loading && events.map((evento) => (
              <TableRow key={evento.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{evento.poste?.name ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell max-w-45 text-sm text-muted-foreground">
                  {tab === "urgentes" ? evento.description : <CriticalObsCell evento={evento} />}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                  {daysOpen(evento.date)}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { if (evento.id) navigate(`/app/eventos/${evento.id}`); }}
                  >
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
