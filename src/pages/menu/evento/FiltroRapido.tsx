import { useId, type ReactNode } from "react";

/**
 * A quick filter with its name on top.
 *
 * The names used to sit to the left of their controls, all on one line. Read
 * across, a name belongs as much to the control before it as to the one after
 * it, and a control without one reads as more of its neighbour. Stacked, a
 * name can only belong to what is under it, and the row can space its filters
 * apart without the gap between a name and its control growing with it.
 *
 * The name is the group's accessible name as well, so the control inside does
 * not need to repeat it to be found.
 */
export function FiltroRapido({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5">
      {/* The dashboard's section-label style: small, upper-case, spaced. */}
      <span id={id} className="text-[11px] font-medium uppercase leading-none tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
