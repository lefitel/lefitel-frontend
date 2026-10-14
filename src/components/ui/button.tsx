import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[filter,box-shadow,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        // Flat: the fill and nothing else. They were lit gradients with a
        // raised edge, beside secondaries that are now a flat tint — two
        // languages on one row. Still the strongest thing there, being the
        // only one filled. Chosen by Isaias on 2026-10-13.
        default:
          "bg-primary-fill text-primary-foreground hover:brightness-[1.07] active:brightness-95",
        destructive:
          "bg-destructive-fill text-destructive-foreground hover:brightness-[1.07] active:brightness-95",
        /*
         * A tint of the button's own text colour, and no relief. It was the
         * card's surface with a soft shadow: on a card — where most of these
         * sit — it had the card's exact background and only the shadow drew it,
         * so Revisión, Editar and Archivar were lost beside Resolver.
         *
         * `currentColor`, not `--primary`: a button that sets its own colour
         * (`text-destructive` on Archivar, amber on Reabrir) is tinted with
         * that colour without asking for a fill of its own.
         *
         * Chosen by Isaias on 2026-10-13 from four options, with this measured
         * beside it: in the dark theme the blue text on its tint is about
         * 3.5:1, under the 4.5:1 asked of text.
         */
        outline:
          "bg-[color-mix(in_oklab,currentColor_13%,var(--card))] text-primary hover:bg-[color-mix(in_oklab,currentColor_22%,var(--card))]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // The same tint as `outline`. What set it apart was a grey hover in
        // place of the accent one, and neither has one now.
        outlineGray:
          "bg-[color-mix(in_oklab,currentColor_13%,var(--card))] text-primary hover:bg-[color-mix(in_oklab,currentColor_22%,var(--card))]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
