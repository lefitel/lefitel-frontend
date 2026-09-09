import * as React from "react"

import { cn } from "@/lib/utils"
import { controlSurface } from "./control-surface"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Lit like everything else, not outlined — see `controlSurface`,
          // which carries the argument and what it costs a text field.
          controlSurface,
          "flex h-9 w-full px-3 py-1 text-base transition-[color,box-shadow,border-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
