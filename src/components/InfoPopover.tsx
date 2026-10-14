// The small ⓘ that opens an explanation on click.
//
// A tooltip opens on hover and on keyboard focus. A finger does neither, so on
// a touch screen an explanation held in one cannot be opened at all. A popover
// opens on press, and closes on a press outside it or on Escape, which Radix
// handles; hover does nothing here on purpose.
//
// Renders the button and nothing around it, so the caller's layout (a flex
// row, an overlay corner) sees exactly one child, as it did with the icon.

import { InfoIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { touchTarget } from "./ui/touch-target";
import { cn } from "@/lib/utils";

interface Props {
  /** Names the button for anyone listening rather than looking. */
  label: string;
  children: ReactNode;
  side?: ComponentProps<typeof PopoverContent>["side"];
  align?: ComponentProps<typeof PopoverContent>["align"];
  /** Extra classes for the open panel: width, text colour. */
  className?: string;
  /** Extra classes for the icon, to change its size. */
  iconClassName?: string;
  /** Extra classes for the button, to change its colour. */
  triggerClassName?: string;
}

const InfoPopover = ({ label, children, side, align, className, iconClassName, triggerClassName }: Props) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={label}
        className={cn("shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground", touchTarget, triggerClassName)}
      >
        <InfoIcon className={cn("h-3.5 w-3.5", iconClassName)} />
      </button>
    </PopoverTrigger>
    <PopoverContent
      side={side}
      align={align}
      className={cn("text-xs leading-relaxed text-popover-foreground", className)}
    >
      {children}
    </PopoverContent>
  </Popover>
);

export default InfoPopover;
