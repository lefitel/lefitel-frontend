import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DashboardEvento } from "../../../api/dashboard.api";
import { daysOpen } from "./helpers";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

interface UrgentEventsCardProps {
  urgentEvents: DashboardEvento[];
  loading: boolean;
}

export function UrgentEventsCard({ urgentEvents, loading }: UrgentEventsCardProps) {
  const navigate = useNavigate();
  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle>Eventos Urgentes</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="¿Qué eventos aparecen aquí?" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <span className="block text-left leading-relaxed normal-case">
                      Eventos con la bandera de <strong className="font-semibold">alta prioridad</strong> activada y aún sin resolver, creados en el período seleccionado. Ordenados por fecha de creación (los más recientes primero). Máximo 5.
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Eventos de alta prioridad sin resolver en el período seleccionado.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => navigate("/app/eventos")}
          >
            Ver todos <ArrowRightIcon className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead>Poste</TableHead>
              <TableHead className="hidden sm:table-cell">Descripción</TableHead>
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
            {!loading && urgentEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                  No hay eventos urgentes pendientes.
                </TableCell>
              </TableRow>
            )}
            {!loading && urgentEvents.map((evento) => (
              <TableRow key={evento.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{evento.poste?.name ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell max-w-30 truncate text-sm text-muted-foreground">{evento.description}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">{daysOpen(evento.date)}</TableCell>
                <TableCell className="text-right pr-4">
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => { if (evento.id) navigate(`/app/eventos/${evento.id}`); }}>
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
