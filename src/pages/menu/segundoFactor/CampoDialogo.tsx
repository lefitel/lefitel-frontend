import { Label } from "@/components/ui/label";

/**
 * A labelled control inside one of this folder's dialogs: label above, as in
 * every other `FormDialog` in the application.
 *
 * `htmlFor`/`id` rather than wrapping the input — the tests of these sections
 * reach every field through `getByLabelText`.
 */
export function CampoDialogo({
  id,
  label,
  requerido,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  requerido?: boolean;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {requerido && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
