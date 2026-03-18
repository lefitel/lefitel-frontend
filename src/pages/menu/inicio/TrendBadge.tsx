import { Badge } from "../../../components/ui/badge";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

interface TrendBadgeProps {
  current: number;
  prev: number;
  /** When true, a positive change is shown as bad (amber). Use for "pendientes". */
  invertTrend?: boolean;
}

export function TrendBadge({ current, prev, invertTrend = false }: TrendBadgeProps) {
  if (prev === 0 && current === 0) return null;
  const pct = prev === 0 ? 100 : Math.round(((current - prev) / prev) * 100);
  if (pct === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-xs font-normal">
        <MinusIcon className="h-3 w-3" /> Sin cambio
      </Badge>
    );
  }
  const isPositive = pct > 0;
  const isGood = invertTrend ? !isPositive : isPositive;
  return (
    <Badge
      className={`gap-1 text-xs font-normal border-transparent shadow-none ${
        isGood ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600"
      }`}
    >
      {isPositive ? <TrendingUpIcon className="h-3 w-3" /> : <TrendingDownIcon className="h-3 w-3" />}
      {isPositive ? "+" : ""}{pct}% vs anterior
    </Badge>
  );
}
