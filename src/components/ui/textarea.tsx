import * as React from "react"

import { cn } from "@/lib/utils"
import { controlSurface } from "./control-surface"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Same skin as every other control — see `controlSurface`.
        controlSurface,
        "flex min-h-[60px] w-full px-3 py-2 text-base transition-[color,box-shadow,border-color] placeholder:text-muted-foreground md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
