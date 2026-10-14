import type { ComponentProps, ReactNode } from "react";
import { Button } from "../../../../components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { cn } from "../../../../lib/utils";

// The pieces the card's views share. They follow the pole detail page's right-hand
// card (PosteDetalleHeader / PosteDetalleInfo): a small label over a bold title, and
// 11px muted labels over the values.

/**
 * What the card is showing, over its title. `accion` is what the card does —
 * its one tool, or its save — at the far end of that row: the same place in
 * every card, and no card has a foot.
 *
 * No way back in here. A tramo's card is left from the app's header, left of
 * the trail (see `RedPage`); the two cards of a new tramo have their own
 * «Cancelar» and «Volver» in `accion`.
 */
export function Encabezado({ rotulo, titulo, accion }: { rotulo: string; titulo: string; accion?: ReactNode }) {
  return (
    <header className="flex min-w-0 items-center gap-1.5">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">{rotulo}</p>
        <h2 className="text-lg font-bold tracking-tight leading-tight break-words">{titulo}</h2>
      </div>
      {accion && <div className="ml-auto shrink-0">{accion}</div>}
    </header>
  );
}

/**
 * A button of a card's title row that is only its icon, and says what it is to
 * the pointer that rests on it.
 *
 * The row has a title to fit beside its controls, so these are drawn as icons;
 * `etiqueta` is then the only place the action is named — the tooltip for
 * whoever is looking, and the accessible name for whoever is not.
 *
 * The tooltip hangs from a wrapper and not from the button: a disabled button
 * fires no pointer events, and «Guardar» is disabled whenever nothing has
 * changed, which is exactly when somebody wonders what it is.
 */
export function BotonIcono({ etiqueta, children, ...props }: Omit<ComponentProps<typeof Button>, "aria-label" | "size"> & {
  etiqueta: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          {/* Below `sm` the word is drawn beside the icon: a phone has no
              hover, and a tooltip is the only place the name was. */}
          <Button size="icon-sm" aria-label={etiqueta} {...props} className={cn("max-sm:w-auto max-sm:gap-1.5 max-sm:px-2.5", props.className)}>
            {children}
            <span aria-hidden className="sm:hidden">{etiqueta}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}

/** A labelled value or control. `accion` sits on the label's row, to its right. */
export function Campo({ etiqueta, accion, children }: { etiqueta: string; accion?: ReactNode; children: ReactNode }) {
  const rotulo = <span className="block text-[11px] text-muted-foreground font-medium">{etiqueta}</span>;
  return (
    <div className="space-y-1">
      {accion ? (
        <div className="flex items-center justify-between gap-2">
          {rotulo}
          {accion}
        </div>
      ) : rotulo}
      {children}
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-sm">
      {children}
    </p>
  );
}

export function Pista({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
