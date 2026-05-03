import { Card, CardContent } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { AnimatedNumber } from "../../../components/AnimatedNumber";
import { LucideIcon } from "lucide-react";

export type KpiTone = "default" | "warning" | "danger" | "success" | "info";

export interface KpiItem {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
}

interface ParametrosKpiCardsProps {
  items: [KpiItem, KpiItem, KpiItem];
  loading?: boolean;
}

const TONE_CLASSES: Record<KpiTone, {
  border: string;
  text: string;
  iconBg: string;
  accentBar: string;
  pulse: boolean;
}> = {
  default: {
    border: "border-muted/60",
    text: "",
    iconBg: "bg-primary/10 text-primary",
    accentBar: "bg-primary/40",
    pulse: false,
  },
  warning: {
    border: "border-amber-500/30",
    text: "text-amber-600",
    iconBg: "bg-amber-500/15 text-amber-600",
    accentBar: "bg-amber-500/70",
    pulse: true,
  },
  danger: {
    border: "border-red-500/30",
    text: "text-red-600",
    iconBg: "bg-red-500/15 text-red-600",
    accentBar: "bg-red-500/70",
    pulse: true,
  },
  success: {
    border: "border-emerald-500/30",
    text: "text-emerald-600",
    iconBg: "bg-emerald-500/15 text-emerald-600",
    accentBar: "bg-emerald-500/70",
    pulse: false,
  },
  info: {
    border: "border-blue-500/30",
    text: "text-blue-600",
    iconBg: "bg-blue-500/15 text-blue-600",
    accentBar: "bg-blue-500/70",
    pulse: false,
  },
};

export function ParametrosKpiCards({ items, loading = false }: ParametrosKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
      {items.map((item, idx) => {
        const tone = TONE_CLASSES[item.tone ?? "default"];
        const Icon = item.icon;
        const numericValue = typeof item.value === "number" ? item.value : null;
        const showPulse = tone.pulse && numericValue != null && numericValue > 0;

        return (
          <Card
            key={idx}
            className={`relative shadow-sm ${tone.border} overflow-hidden py-0 transition-all duration-300 ease-out hover:shadow-md`}
          >
            {/* accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${tone.accentBar}`} />

            <CardContent className="p-3 sm:p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {loading ? (
                  <Skeleton className="h-3.5 w-24" />
                ) : (
                  <p className="text-xs text-muted-foreground font-medium leading-tight">
                    {item.label}
                  </p>
                )}
                {Icon && (
                  <div className={`p-1.5 rounded-full shrink-0 ${tone.iconBg} ${showPulse ? "animate-pulse" : ""}`}>
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                )}
              </div>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${tone.text}`}>
                  {numericValue != null ? <AnimatedNumber value={numericValue} /> : item.value}
                </div>
              )}
              {loading ? (
                <Skeleton className="h-3 w-32" />
              ) : item.hint ? (
                <p className="text-xs text-muted-foreground truncate" title={item.hint}>
                  {item.hint}
                </p>
              ) : (
                <p className="text-xs text-transparent select-none">·</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
