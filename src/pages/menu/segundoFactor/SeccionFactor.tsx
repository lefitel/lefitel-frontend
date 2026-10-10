import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReadRow } from "../perfil/perfilRows";
import type { FilaDePerfil } from "./filaDePerfil";

interface Props {
  /** The card's title, and the open panel's. */
  titulo: string;
  icon: LucideIcon;
  /** Absent on `/app/segundo-factor`, where each section is a card. */
  fila?: FilaDePerfil;
  /** The row's label in the profile. */
  etiqueta: string;
  /** What the row says about the account. */
  resumen: React.ReactNode;
  /**
   * The row's own buttons. When given, the row has no "Gestionar" and no
   * panel: everything the section does is already one click away.
   */
  accionesFila?: React.ReactNode;
  /** Accessible name of the button that opens the panel; the visible text is "Gestionar". */
  abrirLabel?: string;
  /** Buttons in the open panel's header, beside "Cerrar". */
  accionesPanel?: React.ReactNode;
  /** The open panel's body, when it is not the card's `children`. */
  panel?: React.ReactNode;
  /** The card's body. */
  children?: React.ReactNode;
  /** Dialogs, kept apart from `children` so they stay mounted while the row is collapsed. */
  dialogos: React.ReactNode;
}

/**
 * One section of the second-factor settings, drawn as a card or as a profile row.
 *
 * The same three sections serve two screens. `/app/segundo-factor` is the one
 * an `onboarding` session can reach — the profile answers 403 to it — and
 * there they are cards. In the profile they are rows of "Acceso y seguridad":
 * either with their buttons on the row (`accionesFila`), or, when there is a
 * list to see, with a "Gestionar" that opens a panel in place.
 */
export function SeccionFactor({
  titulo, icon: Icon, fila, etiqueta, resumen, accionesFila, abrirLabel,
  accionesPanel, panel, children, dialogos,
}: Props) {
  if (!fila) {
    return (
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {titulo}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">{children}</CardContent>
        {dialogos}
      </Card>
    );
  }

  const panelFila = fila.panel;

  if (accionesFila || !panelFila?.abierto) {
    return (
      <>
        <ReadRow
          label={etiqueta}
          accion={
            accionesFila ?? (panelFila && (
              <Button variant="outline" size="sm" aria-label={abrirLabel} onClick={panelFila.onAbrir}>
                Gestionar
              </Button>
            ))
          }
        >
          {resumen}
        </ReadRow>
        {dialogos}
      </>
    );
  }

  return (
    <>
      <section aria-label={titulo} className="rounded-lg border border-border/60 p-4 my-1.5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{titulo}</span>
          <div className="ml-auto flex items-center gap-2">
            {accionesPanel}
            <Button type="button" variant="ghost" size="sm" onClick={panelFila.onCerrar}>
              Cerrar
            </Button>
          </div>
        </div>
        {panel ?? children}
      </section>
      {dialogos}
    </>
  );
}
