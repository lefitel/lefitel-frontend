import type { KeyboardEvent, ReactNode } from "react";
import { CheckCircle2Icon, HistoryIcon, LayoutListIcon, RouteIcon } from "lucide-react";
import { Card } from "../../../../components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../components/ui/tooltip";
import { VISTA_PANEL_ID, vistaTabId, type VistaPoste } from "./posteVistas";

interface Props {
  vista: VistaPoste;
  onVista: (vista: VistaPoste) => void;
  /**
   * Whether this role may see incidents (`eventos.ver`). Without it there is no
   * "Resueltos" view — the sheet never asked for them.
   */
  canVerEventos: boolean;
  /**
   * Whether this role may read the audit log (`bitacora.ver`). The view is not
   * offered without it: the log's own endpoint asks for that permission, so the
   * seeded Coordinador and Cliente roles were shown a section whose only
   * content was "No tiene permiso para ver la bitácora".
   */
  canVerBitacora: boolean;
  resueltos: number;
  vecinos: number;
}

/**
 * The strip beside the pole's panel that chooses what the panel shows.
 *
 * The short things — the pole, its open incidents, its record — share one
 * view. The long lists each get the whole panel to themselves: folded into the
 * same column, opening forty neighbours pushed everything else out of sight.
 */
export default function PosteDetalleRail({
  vista, onVista, canVerEventos, canVerBitacora, resueltos, vecinos,
}: Props) {
  const items: { vista: VistaPoste; label: string; icon: ReactNode; count?: number }[] = [
    { vista: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    ...(canVerEventos
      ? [{ vista: "resueltos" as const, label: "Resueltos", icon: <CheckCircle2Icon />, count: resueltos }]
      : []),
    { vista: "vecinos", label: "Vecinos", icon: <RouteIcon />, count: vecinos },
    ...(canVerBitacora
      ? [{ vista: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  // The arrows move the choice along the strip, as they do on any set of tabs.
  const onKeyDown = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 :
      e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const i = items.findIndex((it) => it.vista === vista);
    const next = items[(i + step + items.length) % items.length].vista;
    onVista(next);
    document.getElementById(vistaTabId(next))?.focus();
  };

  return (
    // Its own provider, so the rail does not depend on where it is mounted.
    <TooltipProvider delayDuration={150}>
    <Card
      role="tablist"
      aria-label="Vistas del poste"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className="shadow-sm border-muted/60 p-1 gap-1 flex-row lg:flex-col lg:self-start"
    >
      {items.map((it) => {
        const active = it.vista === vista;
        // The icon alone: with its word under it the rail was as wide as a
        // column. The word, and the count where there is one, are still its
        // name — read out, and shown beside it on hover or focus.
        const nombre = it.count ? `${it.label} (${it.count})` : it.label;
        return (
          <Tooltip key={it.vista}>
          <TooltipTrigger asChild>
          <button
            id={vistaTabId(it.vista)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={VISTA_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onVista(it.vista)}
            aria-label={nombre}
            className={`flex h-9 flex-1 lg:flex-none lg:w-9 items-center justify-center rounded-lg transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&>svg]:h-4 [&>svg]:w-4 ${
              active
                ? "bg-primary-fill text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {it.icon}
          </button>
          </TooltipTrigger>
          <TooltipContent side="left">{nombre}</TooltipContent>
          </Tooltip>
        );
      })}
    </Card>
    </TooltipProvider>
  );
}
