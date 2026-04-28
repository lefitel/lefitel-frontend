import { useNavigate } from "react-router-dom";
import { AlertOctagonIcon, ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, InfoIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { CriticalAlert } from "./useInicioData";
import { daysOpen } from "./helpers";

interface AlertBannerProps {
  alerts: CriticalAlert;
  loading: boolean;
}

export function AlertBanner({ alerts, loading }: AlertBannerProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <Skeleton className="h-14 w-full rounded-lg" />;
  }

  if (alerts.events.length === 0) return null;

  const count = alerts.events.length;
  const visible = expanded ? alerts.events.slice(0, 5) : [];

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 overflow-hidden animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-red-500/15 rounded-full shrink-0">
            <AlertOctagonIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {count} {count === 1 ? "evento prioritario" : "eventos prioritarios"} sin resolver
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button type="button" aria-label="¿Qué cuenta esta alerta?" className="text-red-500/60 hover:text-red-600 transition-colors">
                        <InfoIcon className="h-3 w-3" />
                      </button>
                    }
                  />
                  <TooltipContent side="bottom" className="max-w-xs">
                    <span className="block text-left leading-relaxed normal-case">
                      Eventos marcados como <strong className="font-semibold">alta prioridad</strong>, sin resolver y con más de <strong className="font-semibold">{alerts.thresholdDays} días</strong> desde su creación.
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">
              llevan más de {alerts.thresholdDays} días sin atender
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 hover:bg-red-500/10"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Contraer detalle" : "Ver detalle"}
          >
            <span className="hidden sm:inline">{expanded ? "Ocultar" : "Ver detalle"}</span>
            {expanded ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-red-500/20 divide-y divide-red-500/10">
          {visible.map((e) => (
            <button
              key={e.id}
              type="button"
              className="w-full flex items-center justify-between gap-3 p-3 sm:px-4 text-left hover:bg-red-500/5 transition-colors"
              onClick={() => navigate(`/eventos/${e.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.poste?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{e.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                  {daysOpen(e.date)}
                </span>
                <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
          {count > 5 && (
            <button
              type="button"
              className="w-full p-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-red-500/5 transition-colors"
              onClick={() => navigate("/eventos")}
            >
              Ver los {count - 5} restantes →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
