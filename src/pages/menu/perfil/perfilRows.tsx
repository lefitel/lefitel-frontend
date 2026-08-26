import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";

/**
 * The three shapes every section of the profile is built from.
 *
 * The page has one interaction repeated six times — a fact sits there being
 * read until somebody presses the button beside it, and then it becomes a small
 * form with its own Cancel and Save. Written once here so all six behave the
 * same, and so the difference between "information" and "credential" is only
 * ever which props get passed, never a different structure.
 */

/**
 * A fact in read mode, and the control that opens its editor.
 *
 * `accion` is optional: "Nombre" and "Teléfono" are edited together by the
 * section's own Edit button, so their rows carry no control of their own,
 * whereas each of the three credentials opens separately and carries one.
 *
 * **Plain `div`/`span`, not `dl`/`dt`/`dd`,** which is what this started as.
 * The credentials section interleaves these rows with editors — one row is
 * replaced by a `<form>` when it opens — and `<form>` is not a permitted child
 * of `<dl>`. The alternatives were a separate one-pair `<dl>` per row, which
 * makes the dividers a puzzle for no gain, or invalid markup. This also matches
 * `InfoRow` in `UsuarioDetallePage`, which has always been plain elements.
 */
export function ReadRow({
  label,
  children,
  accion,
}: {
  label: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3.5 border-b border-border/60 last:border-b-0">
      <span className="text-sm text-muted-foreground col-start-1">{label}</span>
      <span className="text-sm flex flex-wrap items-center gap-2 min-w-0 col-start-1 sm:col-start-2">
        {children}
      </span>
      {accion && <div className="col-start-2 sm:col-start-3 row-start-1 justify-self-end">{accion}</div>}
    </div>
  );
}

/**
 * One fact opened for editing, in place of its row.
 *
 * The footer is always Cancel then Save, in that order and never reversed:
 * every other confirmation in this application puts the way out on the left
 * (`AlertDialogCancel` does), and a person who has learned where "get me out of
 * here" lives should not have to check on this screen.
 *
 * `onSubmit` on a real `<form>`, so Enter saves. The editors are small enough
 * that reaching for the mouse to commit three characters is the kind of
 * friction nobody reports and everybody feels.
 */
export function EditorBlock({
  titulo,
  icon,
  guardando,
  guardarLabel,
  onGuardar,
  onCancelar,
  children,
  pie,
  destructivo,
}: {
  titulo: string;
  icon?: React.ReactNode;
  guardando: boolean;
  guardarLabel: string;
  onGuardar: () => void;
  onCancelar: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
  destructivo?: boolean;
}) {
  return (
    <form
      className="rounded-lg bg-muted/50 border border-border/60 p-4 my-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <span className="text-sm font-medium">{titulo}</span>
      </div>

      <div className="space-y-3">{children}</div>

      <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
        {pie && <p className="text-xs text-muted-foreground mr-auto">{pie}</p>}
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando} variant={destructivo ? "destructive" : "default"} className="gap-2">
          {guardando && <Loader2Icon className="h-4 w-4 animate-spin" />}
          {guardarLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * A labelled control inside an editor.
 *
 * `htmlFor`/`id` rather than wrapping the input, because `PerfilPage.test.tsx`
 * reaches every field on this page through `getByLabelText` and has done since
 * before this redesign. The label strings themselves are load-bearing for the
 * same reason and are documented where they are passed in.
 */
export function EditorField({
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
    <div className="grid sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-center gap-x-4 gap-y-1.5">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label} {requerido && <span className="text-destructive">*</span>}
      </Label>
      <div className="min-w-0">
        {children}
        {ayuda && <p className="text-xs text-muted-foreground mt-1.5">{ayuda}</p>}
      </div>
    </div>
  );
}
