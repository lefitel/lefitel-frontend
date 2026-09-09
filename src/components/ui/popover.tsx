import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      // Not decoration: things inside a popover ask for this by name.
      //
      // `Calendar` paints its own `bg-background` and turns it off with
      // `in-data-[slot=popover-content]:bg-transparent` — its way of saying
      // "unless somebody else is already painting behind me". Without the
      // attribute the escape never fired, so the calendar laid an opaque
      // square of a *different* colour over this panel: `--background` against
      // `--popover`, which is 0.976 against pure white in the light theme and
      // 0.215 against 0.288 in the dark one. It covered the rounded corners
      // too, which is why the date picker was the one popup in the app with
      // square edges.
      //
      // `card.tsx` has always carried its half of the same contract
      // (`data-slot="card-content"`), which is why a calendar inside a card
      // looked right and this one did not.
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
