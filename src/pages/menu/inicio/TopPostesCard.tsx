import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { CheckCircle2Icon } from "lucide-react";

interface TopPostesCardProps {
  topPostes: { name: string; count: number }[];
  loading: boolean;
}

export function TopPostesCard({ topPostes, loading }: TopPostesCardProps) {
  const maxCount = topPostes[0]?.count ?? 1;

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <CardTitle>Top Postes con Más Incidencias Pendientes</CardTitle>
        <CardDescription>Postes con mayor cantidad de eventos sin resolver en el período seleccionado.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : topPostes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-2">
            <CheckCircle2Icon className="h-8 w-8 text-primary/40" />
            No hay incidencias pendientes en este período.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
            {topPostes.map((p, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </div>
                  <Badge className={`shrink-0 text-xs font-semibold border-transparent shadow-none ${i === 0 ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"}`}>
                    {p.count} {p.count === 1 ? "evento" : "eventos"}
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${i === 0 ? "bg-amber-500/70" : "bg-primary/60"}`}
                    style={{ width: `${Math.round((p.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
