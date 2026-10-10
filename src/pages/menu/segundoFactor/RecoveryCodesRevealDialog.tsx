import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CopyIcon, PrinterIcon } from "lucide-react";
import { enWindows } from "./portapapeles";

/** Groups of four, the same width `codigo_recuperacion.prefijo` cuts at —
 *  purely a display choice, since `recoveryCodeStore.ts`'s own `normalizar`
 *  strips whatever separators a person re-types, dashes included.
 *
 *  Copied from `RecoveryCodesSection.tsx` rather than imported: that file is
 *  not exported as a library of pieces today, only as one default component,
 *  and this one line was the smallest surface worth duplicating rather than
 *  reaching into a sibling file's internals. */
function formatearCodigo(codigo: string): string {
  return codigo.match(/.{1,4}/g)?.join("-") ?? codigo;
}

export interface RecoveryCodesRevealDialogProps {
  /** `null` keeps the dialog closed — either there is nothing to reveal yet,
   *  or the caller already cleared it after `onAcknowledge` fired. */
  codigos: string[] | null;
  /** The *only* way this dialog closes — no `AlertDialogCancel`, and Escape
   *  is swallowed below. Mirrors the rule `RecoveryCodesSection.tsx` already
   *  applies to its own reveal: reading the warning and pressing the one
   *  button on screen is the acknowledgement, not an incidental side effect
   *  of clicking away. */
  onAcknowledge: () => void;
  /** One sentence of context shown above the "solo se ven una vez" warning —
   *  what just happened to produce these ten codes. The warning alone
   *  already covers *why it matters*; this covers *why they are here*. */
  contexto: string;
}

/**
 * The reveal sheet for a fresh set of ten recovery codes: shown exactly
 * once, by whichever screen just minted them.
 *
 * **Extracted out of `RecoveryCodesSection.tsx`'s own reveal dialog**
 * (2026-09-02), so that every screen that can mint ten codes — that section,
 * `TotpSection.tsx` on confirming a factor, `PasskeysSection.tsx` on a first
 * key — shows them with the exact same presentation instead of independently
 * drifting copies.
 */
export const RecoveryCodesRevealDialog = ({ codigos, onAcknowledge, contexto }: RecoveryCodesRevealDialogProps) => {
  const copiarTodos = async () => {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.map(formatearCodigo).join("\n"));
      // Hallazgo E-13/F15: these ten codes just went into a system clipboard,
      // which on Windows 11 keeps a 25-entry history (Win+V), synced to the
      // Microsoft account when that sync is on — a browser has no way to
      // mark a clipboard write "sensitive", so the only lever left is
      // saying so, and saying the Windows part only where it is true.
      toast.success(
        enWindows()
          ? "Códigos copiados. Bórralos del historial del portapapeles (Win+V) apenas termines de guardarlos."
          : "Códigos copiados. Bórralos del portapapeles apenas termines de guardarlos.",
      );
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  };

  const imprimir = () => {
    if (!codigos) return;
    const ventana = window.open("", "_blank", "width=480,height=640");
    if (!ventana) {
      toast.error("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.");
      return;
    }
    const filas = codigos.map((c) => `<li>${formatearCodigo(c)}</li>`).join("");
    ventana.document.write(
      `<html><head><title>Códigos de recuperación</title></head>` +
        `<body style="font-family: sans-serif;">` +
        `<h1 style="font-size: 18px;">Códigos de recuperación</h1>` +
        `<p style="font-size: 12px;">Cada código sirve una sola vez. Guarda esta hoja en un lugar seguro.</p>` +
        `<ol style="font-family: monospace; font-size: 16px; line-height: 1.8;">${filas}</ol>` +
        `</body></html>`,
    );
    ventana.document.close();
    // Hallazgo E-13/F15: this window used to never close, left sitting on
    // screen with the ten codes in the clear until somebody closed it by
    // hand. `close()` right after `print()` is not used here on purpose —
    // `print()`'s blocking behaviour while the native dialog is open is not
    // guaranteed the same way across browsers, and closing too early would
    // tear the window down before that dialog even paints. `afterprint`
    // fires once the dialog is dismissed either way (printed or cancelled),
    // on every desktop browser that can print a popup at all, so it is the
    // one signal this can wait on without guessing at timing.
    ventana.onafterprint = () => ventana.close();
    ventana.focus();
    ventana.print();
  };

  return (
    <AlertDialog open={codigos !== null}>
      {/*
        No `onOpenChange` on the `AlertDialog` above, on purpose: Radix's
        `useControllableState` treats a component whose `open` prop is ever
        defined as *fully* controlled, so `context.onOpenChange(false)` — what
        Escape, an outside click, or this content's own dismiss layer all
        call — reaches nothing today and the dialog cannot close except
        through `onAcknowledge`. `onEscapeKeyDown`'s `preventDefault()` below
        is the second, independent layer for the day somebody adds an
        `onOpenChange` here (the idiomatic Radix shape, and a plausible
        future "cleanup"): without it, that one addition would let Escape
        silently skip the mandatory acknowledgement this dialog exists to
        force. `TotpSection.test.tsx`'s "does not close on Escape" test
        pins exactly that combination.
      */}
      <AlertDialogContent size="lg" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Tus códigos de recuperación</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{contexto}</p>
              <p className="text-amber-600 dark:text-amber-500 font-medium">
                Esta es la única vez que vas a ver estos códigos. Guárdalos ahora — cópialos o
                imprímelos — antes de cerrar esta ventana.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted/50 rounded-lg p-4">
          {(codigos ?? []).map((c) => (
            <li key={c}>{formatearCodigo(c)}</li>
          ))}
        </ul>

        <AlertDialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copiarTodos} className="gap-2">
              <CopyIcon className="h-3.5 w-3.5" />
              Copiar todos
            </Button>
            <Button variant="outline" size="sm" onClick={imprimir} className="gap-2">
              <PrinterIcon className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>
          <AlertDialogAction onClick={onAcknowledge}>Ya los guardé, cerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RecoveryCodesRevealDialog;
