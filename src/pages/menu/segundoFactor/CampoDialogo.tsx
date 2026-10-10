import { Label } from "@/components/ui/label";

/**
 * A labelled control inside one of the dialogs of the profile and its
 * second-factor sections: label above, as in every other `FormDialog` in the
 * application.
 *
 * `htmlFor`/`id` rather than wrapping the input — the tests reach every field
 * through `getByLabelText`.
 *
 * `error` is drawn under the field with `role="alert"`. The input is the
 * caller's, so it carries the two attributes that tie it to that message
 * itself, spread from `ariaCampo` with the same `id` and `error`.
 */
export function CampoDialogo({
  id,
  label,
  requerido,
  ayuda,
  error,
  children,
}: {
  id: string;
  label: string;
  requerido?: boolean;
  ayuda?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {requerido && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
