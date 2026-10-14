import type { ComponentProps } from "react";
import { MoreVerticalIcon } from "lucide-react";
import { DropdownMenuTrigger } from "../ui/dropdown-menu";
import { touchTarget } from "../ui/touch-target";
import { cn } from "@/lib/utils";

/**
 * The ⋮ at the end of a list's row, which opens what can be done with it.
 *
 * Ten lists drew it from the same copied line, 28px and with no name — a
 * button a screen reader announced as nothing, and a target small for a thumb.
 * It keeps its size so the rows keep theirs; a touch screen gets the larger
 * place to press from `touchTarget`.
 *
 * `aria-label` defaults to «Acciones». A row that has a name says whose they
 * are: «Acciones de Potosí».
 */
export function RowActionsTrigger({ className, "aria-label": label = "Acciones", ...props }: ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted",
        touchTarget,
        className,
      )}
      {...props}
    >
      <MoreVerticalIcon className="h-4 w-4" />
    </DropdownMenuTrigger>
  );
}
