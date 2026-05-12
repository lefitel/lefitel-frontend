import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { AreaChartIcon, BarChart2Icon, InfoIcon, LayersIcon, TrendingUpIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  Area, AreaChart as RechartsAreaChart,
  Bar, BarChart as RechartsBarChart,
  ComposedChart,
  Cell, ReferenceLine,
  XAxis, YAxis,
} from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";
import { Period } from "./types";

type ChartType = "area" | "composed" | "bar" | "balance";

const chartConfig = {
  pending: { label: "Pendientes", color: "var(--chart-1)" },
  solved:  { label: "Solucionados", color: "var(--primary)" },
  net:     { label: "Balance", color: "var(--primary)" },
} satisfies ChartConfig;

const CHART_TYPES: { type: ChartType; icon: typeof AreaChartIcon; label: string }[] = [
  { type: "area",     icon: AreaChartIcon,   label: "Área" },
  { type: "composed", icon: LayersIcon,      label: "Compuesto" },
  { type: "bar",      icon: BarChart2Icon,   label: "Barras" },
  { type: "balance",  icon: TrendingUpIcon,  label: "Balance" },
];

const SHORT_PERIODS: Period[] = ["fortnight", "month"];

interface ActivityChartProps {
  chartData: { label: string; pending: number; solved: number }[];
  loading: boolean;
  xAxisLabel: string;
  period: Period;
}

export function ActivityChart({ chartData, loading, xAxisLabel, period }: ActivityChartProps) {
  const [chartType, setChartType] = useState<ChartType>("area");
  const showDots = SHORT_PERIODS.includes(period);

  const netData = useMemo(
    () => chartData.map(d => ({ ...d, net: d.solved - d.pending })),
    [chartData]
  );

  const commonAxisProps = {
    xAxis:   <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} className="text-xs" />,
    yAxis:   <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} className="text-xs" allowDecimals={false} />,
    grid:    <CartesianGrid vertical={false} strokeDasharray="3 3" />,
    tooltip: <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />,
  };

  const isBalance = chartType === "balance";

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle>Actividad de Eventos</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="¿Qué muestra este gráfico?" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm">
                    {isBalance ? (
                      <span className="block text-left leading-relaxed normal-case">
                        <strong className="font-semibold">Balance por período:</strong> solucionados − pendientes.
                        <span className="block mt-1 text-emerald-500 font-medium">Verde — se resolvió más de lo que entró.</span>
                        <span className="block text-rose-500 font-medium">Rojo — el backlog creció.</span>
                      </span>
                    ) : (
                      <span className="block text-left leading-relaxed normal-case">
                        Eventos <strong className="font-semibold">creados</strong> en el período, agrupados por su estado actual:
                        <span className="block mt-1">
                          <strong className="font-semibold">Pendientes</strong> — sin resolver al día de hoy.
                        </span>
                        <span className="block">
                          <strong className="font-semibold">Solucionados</strong> — ya resueltos.
                        </span>
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>{xAxisLabel}</CardDescription>
          </div>

          <div className="flex flex-col items-end gap-0 shrink-0 rounded-md border border-border/60 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
              {isBalance ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    Mejora
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                    Retroceso
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
                    Pendientes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                    Solucionados
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center border-t border-border/60 w-full">
              {CHART_TYPES.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  aria-label={label}
                  onClick={() => setChartType(type)}
                  className={`flex-1 flex justify-center p-1.5 transition-colors ${chartType === type ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
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
            {chartType === "area" ? (
              <RechartsAreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 12, top: 12 }}>
                <defs>
                  <linearGradient id="grad-pending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-pending)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-pending)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-solved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-solved)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-solved)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {commonAxisProps.grid}
                {commonAxisProps.xAxis}
                {commonAxisProps.yAxis}
                {commonAxisProps.tooltip}
                <Area dataKey="pending" type="monotone" stroke="var(--color-pending)" strokeWidth={2} fill="url(#grad-pending)" dot={showDots ? { r: 2.5 } : false} activeDot={{ r: 4 }} />
                <Area dataKey="solved"  type="monotone" stroke="var(--color-solved)"  strokeWidth={2} fill="url(#grad-solved)"  dot={showDots ? { r: 2.5 } : false} activeDot={{ r: 4 }} />
              </RechartsAreaChart>
            ) : chartType === "composed" ? (
              <ComposedChart accessibilityLayer data={chartData} margin={{ left: 0, right: 12, top: 12 }} barCategoryGap="35%">
                {commonAxisProps.grid}
                {commonAxisProps.xAxis}
                {commonAxisProps.yAxis}
                {commonAxisProps.tooltip}
                <Bar dataKey="pending" fill="var(--color-pending)" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Line dataKey="solved" type="monotone" stroke="var(--color-solved)" strokeWidth={2} dot={showDots ? { r: 2.5 } : false} activeDot={{ r: 4 }} />
              </ComposedChart>
            ) : chartType === "bar" ? (
              <RechartsBarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 12, top: 12 }} barCategoryGap="30%">
                {commonAxisProps.grid}
                {commonAxisProps.xAxis}
                {commonAxisProps.yAxis}
                {commonAxisProps.tooltip}
                <Bar dataKey="pending" stackId="stack" fill="var(--color-pending)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="solved"  stackId="stack" fill="var(--color-solved)"  radius={[3, 3, 0, 0]} />
              </RechartsBarChart>
            ) : (
              <RechartsBarChart accessibilityLayer data={netData} margin={{ left: 0, right: 12, top: 12 }} barCategoryGap="30%">
                {commonAxisProps.grid}
                {commonAxisProps.xAxis}
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} className="text-xs" allowDecimals={false} />
                {commonAxisProps.tooltip}
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                <Bar dataKey="net" radius={[3, 3, 3, 3]}>
                  {netData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.net >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </RechartsBarChart>
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
