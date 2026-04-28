import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";

const chartConfig = {
  pending: { label: "Pendientes", color: "#8FA3D0" },
  solved: { label: "Solucionados", color: "var(--primary)" },
} satisfies ChartConfig;

interface ActivityChartProps {
  chartData: { label: string; pending: number; solved: number }[];
  loading: boolean;
  xAxisLabel: string;
}

export function ActivityChart({ chartData, loading, xAxisLabel }: ActivityChartProps) {
  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle>Actividad de Eventos</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button type="button" aria-label="¿Qué muestra este gráfico?" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                        <InfoIcon className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <TooltipContent side="bottom" className="max-w-sm">
                    <span className="block text-left leading-relaxed normal-case">
                      Eventos <strong className="font-semibold">creados</strong> en el período, agrupados por su estado actual:
                      <span className="block mt-1">
                        <strong className="font-semibold">Pendientes</strong> — sin resolver al día de hoy.
                      </span>
                      <span className="block">
                        <strong className="font-semibold">Solucionados</strong> — ya resueltos.
                      </span>
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>{xAxisLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded bg-[#8FA3D0]" />Pendientes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded bg-primary" />Solucionados
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-87.5 w-full">
            <RechartsLineChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12, top: 12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <Line dataKey="pending" type="monotone" stroke="#8FA3D0" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="solved" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </RechartsLineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
