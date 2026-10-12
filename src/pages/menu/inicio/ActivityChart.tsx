import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { InfoIcon, LineChartIcon, ScaleIcon } from "lucide-react";
import {
  CartesianGrid,
  Line, LineChart,
  Bar, BarChart as RechartsBarChart,
  Cell, ReferenceLine,
  XAxis, YAxis,
} from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";
import { Period } from "./types";
import { ChartTramo } from "./useInicioData";
import { axisLabels, Granularity } from "./helpers";

type ChartType = "lineas" | "balance";

// Three hues of the categorical chart scale, not shades of the brand blue: the
// two event series used to be `--chart-1` and `--primary`, the same hue three
// points of lightness apart, and could barely be told from one another. Green
// and blue also match the «Postes Nuevos» and «Eventos Solucionados» cards.
const chartConfig = {
  postes:   { label: "Postes nuevos", color: "var(--chart-5)" },
  entraron: { label: "Eventos nuevos", color: "var(--chart-2)" },
  salieron: { label: "Eventos solucionados", color: "var(--chart-1)" },
  net:      { label: "Balance", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** The three lines, in the order the legend and the tooltip list them. */
const SERIES = ["postes", "entraron", "salieron"] as const;

const CHART_TYPES: { type: ChartType; icon: typeof InfoIcon; label: string }[] = [
  { type: "lineas",  icon: LineChartIcon, label: "Líneas" },
  { type: "balance", icon: ScaleIcon,     label: "Balance" },
];

const SHORT_PERIODS: Period[] = ["fortnight", "month"];

interface ActivityChartProps {
  chartData: ChartTramo[];
  /** The grain `chartData` was cut at: it decides what the axis writes. */
  granularity: Granularity;
  loading: boolean;
  xAxisLabel: string;
  period: Period;
}

export function ActivityChart({ chartData, granularity, loading, xAxisLabel, period }: ActivityChartProps) {
  const [chartType, setChartType] = useState<ChartType>("lineas");
  const showDots = SHORT_PERIODS.includes(period);

  // Repairs against incoming events. Poles stay out of it: a new pole neither
  // adds to the backlog nor takes from it.
  const netData = useMemo(
    () => chartData.map(d => ({ ...d, net: d.salieron - d.entraron })),
    [chartData]
  );

  // The dates, on two rows: see `axisLabels`. Both axes are keyed on `desde`
  // and not on the text they print, because that text repeats — there is a
  // "1" in every month — and an axis keyed on it would fold those into one.
  const { tickOf, groupOf, groupStarts } = useMemo(() => {
    const labels = axisLabels(chartData.map((d) => d.desde), granularity);
    const tickOf = new Map<number, string>();
    const groupOf = new Map<number, string>();
    chartData.forEach((d, i) => {
      tickOf.set(d.desde, labels[i].tick);
      const group = labels[i].group;
      if (group) groupOf.set(d.desde, group);
    });
    return { tickOf, groupOf, groupStarts: [...groupOf.keys()] };
  }, [chartData, granularity]);

  const commonAxisProps = {
    xAxis: (
      <>
        <XAxis dataKey="desde" tickFormatter={(ms: number) => tickOf.get(ms) ?? ""} tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} height={24} className="text-xs" />
        {/* The shared part, on an axis of its own. Hung from the row above it
            would vanish whenever the library drops the first of a month for
            lack of room, which is exactly when it is most needed. It drops its
            own labels by the same rule, keeping the earliest. */}
        {groupStarts.length > 0 && (
          <XAxis
            xAxisId="group"
            dataKey="desde"
            ticks={groupStarts}
            tickFormatter={(ms: number) => groupOf.get(ms) ?? ""}
            interval="preserveStart"
            minTickGap={12}
            tickLine={false}
            axisLine={false}
            tickMargin={0}
            height={18}
            className="text-xs font-medium [&_.recharts-cartesian-axis-tick_text]:fill-foreground"
          />
        )}
      </>
    ),
    yAxis:   <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} className="text-xs" allowDecimals={false} />,
    grid:    <CartesianGrid vertical={false} strokeDasharray="3 3" />,
    // The axis key is a timestamp now; the tooltip keeps titling itself with the date.
    tooltip: <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => payload?.[0]?.payload?.label} />} />,
  };

  const isBalance = chartType === "balance";

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle>Actividad</CardTitle>
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
                        <strong className="font-semibold">Balance del tramo:</strong> eventos solucionados − eventos nuevos. Los postes nuevos no cuentan aquí.
                        <span className="block mt-1 text-emerald-500 font-medium">Verde — se reparó más de lo que entró: la cola de averías bajó.</span>
                        <span className="block text-rose-500 font-medium">Rojo — entró más de lo que se reparó: la cola creció.</span>
                      </span>
                    ) : (
                      <span className="block text-left leading-relaxed normal-case">
                        Tres cuentas independientes, cada una en su propia fecha:
                        <span className="block mt-1">
                          <strong className="font-semibold">Postes nuevos</strong> — postes cuya fecha en campo cae en ese tramo.
                        </span>
                        <span className="block">
                          <strong className="font-semibold">Eventos nuevos</strong> — averías registradas en ese tramo, estén hoy reparadas o no.
                        </span>
                        <span className="block">
                          <strong className="font-semibold">Eventos solucionados</strong> — reparaciones hechas en ese tramo, sin importar cuándo apareció la avería.
                        </span>
                        <span className="block mt-1 text-muted-foreground">
                          Una avería de enero reparada en marzo cuenta en enero como evento nuevo y en marzo como solucionado.
                        </span>
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>{xAxisLabel}</CardDescription>
          </div>

          {/* `max-w-full` and a wrapping legend: three labels in one unbreakable
              row are wider than a phone, and the box used to refuse to shrink. */}
          <div className="flex flex-col items-end gap-0 max-w-full rounded-md border border-border/60 overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
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
                SERIES.map((key) => (
                  <span key={key} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: chartConfig[key].color }} />
                    {chartConfig[key].label}
                  </span>
                ))
              )}
            </div>
            <div className="flex items-center border-t border-border/60 w-full">
              {CHART_TYPES.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  aria-label={label}
                  aria-pressed={chartType === type}
                  title={label}
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
            {chartType === "lineas" ? (
              <LineChart accessibilityLayer data={chartData} margin={{ left: 0, right: 12, top: 12 }}>
                {commonAxisProps.grid}
                {commonAxisProps.xAxis}
                {commonAxisProps.yAxis}
                {commonAxisProps.tooltip}
                {SERIES.map((key) => (
                  <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${key})`} strokeWidth={2} dot={showDots ? { r: 2.5 } : false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
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
