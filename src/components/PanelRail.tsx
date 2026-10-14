import type { KeyboardEvent, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export interface PanelRailItem<V extends string> {
  value: V;
  label: string;
  /** The word shown under the icon on a narrow screen, when `label` is too long for a quarter of a phone. */
  short?: string;
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
 *
 * Its icons stand straight on the page, each on its own. They were held in a
 * card of their own, a second floating thing beside the panel's; Isaias tried
 * them loose on the user's sheet and asked for the same on every sheet
 * (2026-10-13).
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
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="flex gap-1 flex-row lg:flex-col lg:self-start"
      >
        {items.map((it) => {
          const active = it.value === value;
          // The icon alone where the rail is a column: with its word under it
          // the rail was as wide as one. The word, and the count where there
          // is one, are still its name — read out, and shown beside it on hover
          // or focus.
          //
          // Below `lg` the rail lies across the top of the panel, each tab a
          // share of the width, and there the word is drawn under the icon: a
          // phone has no hover, so a name kept in a tooltip is a name nobody
          // reads. Under, not beside — four to a 360px screen leaves some 80px
          // each, and beside the icon «Resumen» was already cut short.
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
                  className={`flex min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5 lg:h-9 lg:flex-none lg:w-9 lg:p-0 items-center justify-center rounded-lg transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${
                    active
                      ? "bg-primary-fill text-primary-foreground"
                      // With no card behind it, each one that is not chosen
                      // is its own piece of the card's surface.
                      : "bg-card elevation-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {it.icon}
                  <span aria-hidden className="max-w-full truncate text-[11px] leading-tight font-medium lg:hidden">{it.short ?? it.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{nombre}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
