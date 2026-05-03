import { Badge } from "../../../components/ui/badge";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

interface TrendBadgeProps {
  current: number;
  prev: number;
  /** When true, a positive change is shown as bad (amber). Use for "pendientes". */
  invertTrend?: boolean;
}

const tooltipText = (current: number, prev: number) => (
  <span className="block text-left leading-relaxed normal-case">
    Comparación con el <strong className="font-semibold">período anterior equivalente</strong> (mes vs. mes pasado, año vs. año anterior, etc.).
    <span className="block mt-1 text-muted/70">Actual: {current} · Anterior: {prev}</span>
  </span>
);

export function TrendBadge({ current, prev, invertTrend = false }: TrendBadgeProps) {
  if (prev === 0 && current === 0) return null;
  const pct = prev === 0 ? 100 : Math.round(((current - prev) / prev) * 100);

  const wrap = (children: React.ReactNode) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children as React.ReactElement}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">{tooltipText(current, prev)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (pct === 0) {
    return wrap(
      <Badge variant="outline" className="gap-1 text-xs font-normal cursor-help">
        <MinusIcon className="h-3 w-3" /> Sin cambio
      </Badge>
    );
  }
  const isPositive = pct > 0;
  const isGood = invertTrend ? !isPositive : isPositive;
  return wrap(
    <Badge
      className={`gap-1 text-xs font-normal border-transparent shadow-none cursor-help ${
        isGood ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"
      }`}
    >
      {isPositive ? <TrendingUpIcon className="h-3 w-3" /> : <TrendingDownIcon className="h-3 w-3" />}
      {isPositive ? "+" : ""}{pct}% vs anterior
    </Badge>
  );
}
