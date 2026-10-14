import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { DashboardEvento } from "../../../api/dashboard.api";
import { daysOpen } from "./helpers";
import { useNavigate } from "react-router-dom";
import InfoPopover from "../../../components/InfoPopover";
import { getCriticalityMeta } from "../../../lib/criticality";

type Tab = "urgentes" | "criticos";

interface UrgentEventsCardProps {
  urgentEvents: DashboardEvento[];
  criticalObsEvents: DashboardEvento[];
  loading: boolean;
}

const CriticalObsCell = ({ evento }: { evento: DashboardEvento }) => {
  const obs = (evento.eventoObs ?? [])
    .filter((eo) => eo.ob?.criticality != null)
    .map((eo) => eo.ob!)
    // `Infinity`, not 9: the filter above already dropped the unclassified, and
    // saying "no level" sorts like "Mantenimiento" would be a claim about them.
    .sort((a, b) => (a.criticality ?? Infinity) - (b.criticality ?? Infinity));
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {obs.map((ob) => {
        const meta = getCriticalityMeta(ob.criticality);
        return (
          <span key={ob.id} className="flex items-center gap-1">
            <span className="truncate">{ob.name}</span>
            <span
              className={`shrink-0 text-[10px] font-semibold rounded px-1 py-px leading-none ${meta.bgClass} ${meta.textClass}`}
              title={`Nivel ${meta.level} — ${meta.label}`}
            >
              {ob.criticality}
            </span>
          </span>
        );
      })}
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
  // Opens on the second tab: the client reads this card for severity first.
  const [tab, setTab] = useState<Tab>("criticos");

  const events = tab === "urgentes" ? urgentEvents : criticalObsEvents;

  return (
    <Card className="shadow-sm border-muted/60 flex flex-col h-80 sm:h-105">
      <CardHeader className="border-b border-border/40 pb-4">
        {/* The tabs drop below the title on a phone: beside them the
            description had some 100px, a word or two to a line. */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex items-center gap-1.5">
              <CardTitle>Alertas</CardTitle>
              <InfoPopover label="¿Qué eventos aparecen aquí?" side="bottom" className="w-80 max-w-[calc(100vw-2rem)]">
                <span className="block text-left leading-relaxed normal-case">
                  {TOOLTIP[tab]}
                </span>
              </InfoPopover>
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
                {/* Its own rows, like the tab beside it. This counted only
                    level 1 and hid itself at zero, so a list of thirty events
                    of levels 2 to 9 sat under a tab that read as none.
                    Catastrophic is still visible where it belongs: the list is
                    sorted by severity and each row carries its coloured badge. */}
                {!loading && (
                  <span className="bg-primary/10 text-primary rounded-full px-1.5 py-px text-[10px] font-semibold leading-none">
                    {criticalObsEvents.length}
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
