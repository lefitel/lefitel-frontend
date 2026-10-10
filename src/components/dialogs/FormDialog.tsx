import { useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";

interface Props {
  open: boolean;
  /** Closes for good: the screen resets its fields here. Never called behind the user's back. */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "wide";
  /** Whether closing now would throw away something the user typed. */
  dirty?: boolean;
  /** The required fields still empty, by the name the form shows for them. */
  missing?: string[];
  saving?: boolean;
  /** What the main button does, as a verb: "Crear poste", "Guardar cambios". */
  submitLabel?: string;
  /** Omitted for a form opened read-only: the footer is then a single "Cerrar". */
  onSubmit?: () => void;
  submitDisabled?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** "Falta 1 campo: Material" / "Faltan 2 campos: Nombre y Material". */
function faltan(campos: string[]): string {
  const lista = campos.length > 1
    ? `${campos.slice(0, -1).join(", ")} y ${campos[campos.length - 1]}`
    : campos[0];
  return campos.length === 1 ? `Falta 1 campo: ${lista}` : `Faltan ${campos.length} campos: ${lista}`;
}

/** The inputs Enter must not submit from: it already means something else there. */
const NO_ENVIAN = new Set(["checkbox", "radio", "file", "button", "submit", "reset"]);

/**
 * The frame every form in the application opens in.
 *
 * It exists so that four things are written once and not in fourteen screens:
 *
 * - **Leaving does not lose work.** A dialog closes on Escape and on a click
 *   outside it, and on a form half filled that is the whole of it gone. With
 *   `dirty` set, every way out asks first. While `saving`, none of them does
 *   anything: closing then would hide the answer to a request already sent.
 * - **What is missing is said beside the button.** An error under a field is
 *   invisible once the field has scrolled away. After the first attempt the
 *   footer names what `missing` lists, for as long as it lists anything.
 * - **Enter saves**, from a text field of this form and from nowhere else — not
 *   from a textarea, where it is a new line, and not from a field in a popover,
 *   which is not inside the body at all.
 * - **The cursor starts in the first field**, except on a touch screen, where
 *   that raises the keyboard over the form before anyone has read it.
 *
 * It does not validate. `onSubmit` is called every time, so the screen's own
 * checks still run and still paint their own field errors; `missing` is only
 * what the footer repeats.
 */
export default function FormDialog({
  open, onClose, title, description, size, dirty = false, missing = [], saving = false,
  submitLabel = "Guardar cambios", onSubmit, submitDisabled = false, bodyClassName, children,
}: Props) {
  const cuerpo = useRef<HTMLDivElement>(null);
  const [intentado, setIntentado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // A form opened again starts clean: no stale "faltan campos" from last time.
  const [abierto, setAbierto] = useState(open);
  if (open !== abierto) {
    setAbierto(open);
    if (open) { setIntentado(false); setConfirmando(false); }
  }

  const pedirCierre = () => {
    if (saving) return;
    if (dirty) setConfirmando(true);
    else onClose();
  };

  const enviar = () => {
    if (!onSubmit || saving || submitDisabled) return;
    setIntentado(true);
    onSubmit();
  };

  const alPulsar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const campo = e.target;
    if (!(campo instanceof HTMLInputElement) || !e.currentTarget.contains(campo)) return;
    if (NO_ENVIAN.has(campo.type) || campo.getAttribute("role") === "combobox") return;
    if (campo.closest("[data-no-submit]")) return;
    e.preventDefault();
    enviar();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) pedirCierre(); }}>
        <DialogContent
          size={size}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const tactil = window.matchMedia?.("(pointer: coarse)").matches;
            const primero = tactil ? null : cuerpo.current?.querySelector<HTMLElement>(
              "input:not([type=hidden]):not([disabled]):not([data-no-autofocus]), textarea:not([disabled])",
            );
            (primero ?? (e.currentTarget as HTMLElement)).focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <DialogBody ref={cuerpo} className={bodyClassName} onKeyDown={alPulsar}>
            {children}
          </DialogBody>

          <DialogFooter>
            {intentado && missing.length > 0 && (
              <p role="alert" className="mr-auto text-sm text-destructive">{faltan(missing)}</p>
            )}
            <Button variant="outline" onClick={pedirCierre} disabled={saving}>
              {onSubmit ? "Cancelar" : "Cerrar"}
            </Button>
            {onSubmit && (
              <Button onClick={enviar} disabled={saving || submitDisabled}>
                {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : submitLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo que has escrito en este formulario no se ha guardado y se perderá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              onClick={() => { setConfirmando(false); onClose(); }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
