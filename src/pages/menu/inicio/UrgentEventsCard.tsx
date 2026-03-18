import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DashboardEvento } from "../../../api/dashboard.api";
import { daysOpen } from "./helpers";
import { useNavigate } from "react-router-dom";

interface UrgentEventsCardProps {
  urgentEvents: DashboardEvento[];
  loading: boolean;
}

export function UrgentEventsCard({ urgentEvents, loading }: UrgentEventsCardProps) {
  const navigate = useNavigate();
  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <CardTitle>Eventos Urgentes</CardTitle>
        <CardDescription>Eventos de alta prioridad sin resolver en el período seleccionado.</CardDescription>
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
                    onClick={() => { if (evento.id) navigate(`/eventos/${evento.id}`); }}>
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
