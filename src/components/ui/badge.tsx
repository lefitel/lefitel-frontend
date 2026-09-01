import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-[filter,box-shadow,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[image:var(--gradient-primary)] text-primary-foreground elevation-raised hover:brightness-[1.07]",
        secondary:
          "border-transparent bg-[image:var(--gradient-secondary)] text-secondary-foreground elevation-sunken hover:bg-[image:var(--gradient-accent)]",
        destructive:
          "border-transparent bg-[image:var(--gradient-destructive)] text-destructive-foreground elevation-raised hover:brightness-[1.07]",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
