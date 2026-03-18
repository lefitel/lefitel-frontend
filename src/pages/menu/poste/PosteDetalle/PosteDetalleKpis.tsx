import { Card, CardContent } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { AlertTriangleIcon, BarChart3Icon, CheckCircle2Icon, ZapIcon } from "lucide-react";

interface Props {
  loading: boolean;
  total: number;
  pendientes: number;
  resueltos: number;
  tasa: number;
}

export default function PosteDetalleKpis({ loading, total, pendientes, resueltos, tasa }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            {loading ? <Skeleton className="h-4 w-28" /> : (
              <p className="text-xs text-muted-foreground font-medium">Total Eventos</p>
            )}
            <div className="p-2 bg-muted rounded-full shrink-0">
              <ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          {loading ? <Skeleton className="h-10 w-14" /> : (
            <div className="text-4xl font-bold tracking-tight">{total}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-amber-500/20 py-0">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            {loading ? <Skeleton className="h-4 w-24" /> : (
              <p className="text-xs text-muted-foreground font-medium">Pendientes</p>
            )}
            <div className={`p-2 rounded-full shrink-0 ${pendientes > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
              <AlertTriangleIcon className={`h-3.5 w-3.5 ${pendientes > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
          </div>
          {loading ? <Skeleton className="h-10 w-10" /> : (
            <div className={`text-4xl font-bold tracking-tight ${pendientes > 0 ? "text-amber-500" : ""}`}>{pendientes}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-primary/20 py-0">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            {loading ? <Skeleton className="h-4 w-24" /> : (
              <p className="text-xs text-muted-foreground font-medium">Resueltos</p>
            )}
            <div className="p-2 bg-primary/10 rounded-full shrink-0">
              <CheckCircle2Icon className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          {loading ? <Skeleton className="h-10 w-10" /> : (
            <div className="text-4xl font-bold tracking-tight text-primary">{resueltos}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60 py-0">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            {loading ? <Skeleton className="h-4 w-32" /> : (
              <p className="text-xs text-muted-foreground font-medium">Tasa de Resolución</p>
            )}
            <div className="p-2 bg-muted rounded-full shrink-0">
              <BarChart3Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          {loading ? <Skeleton className="h-10 w-16" /> : (
            <div className="text-4xl font-bold tracking-tight">{tasa}%</div>
          )}
          {!loading && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${tasa}%` }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
