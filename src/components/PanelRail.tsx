import type { KeyboardEvent, ReactNode } from "react";
import { Card } from "./ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export interface PanelRailItem<V extends string> {
  value: V;
  label: string;
  icon: ReactNode;
  /** Shown beside the label when above zero. */
  count?: number;
}

interface Props<V extends string> {
  /** What the strip chooses between, for whoever cannot see it: "Vistas del poste". */
  label: string;
  items: PanelRailItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The id of the panel the strip fills, and the id each of its tabs answers to. */
  panelId: string;
  tabId: (value: V) => string;
}

/**
 * The strip beside a detail sheet's panel that chooses what the panel shows.
 *
 * It began on the pole's sheet and is the same on every sheet that has one, so
 * it lives here: which views a sheet offers — and which a role may open — is
 * the sheet's business, and arrives as `items`.
 */
export default function PanelRail<V extends string>({
  label, items, value, onChange, panelId, tabId,
}: Props<V>) {
  // The arrows move the choice along the strip, as they do on any set of tabs.
  const onKeyDown = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 :
      e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const i = items.findIndex((it) => it.value === value);
    const next = items[(i + step + items.length) % items.length].value;
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    // Its own provider, so the rail does not depend on where it is mounted.
    <TooltipProvider delayDuration={150}>
      <Card
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="shadow-sm border-muted/60 p-1 gap-1 flex-row lg:flex-col lg:self-start"
      >
        {items.map((it) => {
          const active = it.value === value;
          // The icon alone: with its word under it the rail was as wide as a
          // column. The word, and the count where there is one, are still its
          // name — read out, and shown beside it on hover or focus.
          const nombre = it.count ? `${it.label} (${it.count})` : it.label;
          return (
            <Tooltip key={it.value}>
              <TooltipTrigger asChild>
                <button
                  id={tabId(it.value)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={panelId}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onChange(it.value)}
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
