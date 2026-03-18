import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";

const chartConfig = {
  pending: { label: "Pendientes", color: "#8FA3D0" },
  solved:  { label: "Solucionados", color: "var(--primary)" },
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Actividad de Eventos</CardTitle>
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
          <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
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
