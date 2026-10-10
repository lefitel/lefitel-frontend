/**
 * A fact in the profile, and the control that acts on it.
 *
 * The page is facts that sit there being read until somebody presses the button
 * beside one, which opens a dialog. This is the one row they are all drawn
 * with, so the credentials, the second-factor rows and the personal details
 * look the same.
 *
 * `accion` is optional: "Nombre" and "Teléfono" are edited together by the
 * card's own Editar button, so their rows carry no control of their own,
 * whereas each credential has one.
 *
 * **Plain `div`/`span`, not `dl`/`dt`/`dd`.** The access card interleaves these
 * rows with the second-factor sections, which draw their own markup (an open
 * passkeys panel is a `section`), and none of that is a permitted child of a
 * `<dl>`. This also matches `InfoRow` in `UsuarioDetallePage`, which has always
 * been plain elements.
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
      {/* On a touch screen the row's buttons grow to 40px: at their desktop
          32px a thumb lands on the row above as often as on them. */}
      {accion && (
        <div className="col-start-2 sm:col-start-3 row-start-1 justify-self-end [@media(pointer:coarse)]:[&_button]:min-h-10">
          {accion}
        </div>
      )}
    </div>
  );
}
