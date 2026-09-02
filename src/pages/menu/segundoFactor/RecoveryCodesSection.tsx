import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyIcon, KeyIcon, PrinterIcon } from "lucide-react";
import { EditorBlock, EditorField } from "../perfil/perfilRows";
import {
  generateRecoveryCodes,
  getRecoveryCodesRemaining,
  describeStepUpError,
  CODIGO_STEP_UP,
} from "../../../api/Mfa.api";

/** How many left counts as "running low" — the point at which this section
 *  switches its badge from neutral to a warning colour, before the count
 *  reaches the day somebody actually needs one. */
const UMBRAL_BAJO = 2;

/** Groups of four, the same width `codigo_recuperacion.prefijo` cuts at —
 *  purely a display choice, since `recoveryCodeStore.ts`'s own `normalizar`
 *  strips whatever separators a person re-types, dashes included. */
function formatearCodigo(codigo: string): string {
  return codigo.match(/.{1,4}/g)?.join("-") ?? codigo;
}

/**
 * Recovery codes — Task 20 of the 4B plan.
 *
 * **Shown once, and this component never asks the server for them a second
 * time.** `GET /auth/recovery-codes` only ever answers with a count; the
 * only response this screen will ever see the codes in is the one
 * `generateRecoveryCodes` returns the instant they are minted. Closing the
 * reveal dialog without saving them is not recoverable from here — the only
 * way back is generating a fresh ten, which is also what the dialog itself
 * says before it ever shows a code.
 */
const RecoveryCodesSection = () => {
  const [restantes, setRestantes] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarRestantes = async () => {
    setCargando(true);
    const res = await getRecoveryCodesRemaining();
    setRestantes(res.restantes);
    setCargando(false);
  };

  useEffect(() => {
    cargarRestantes();
    // Once, on mount.
  }, []);

  // ── Generar / regenerar ─────────────────────────────────────────────────
  const [formAbierto, setFormAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAbierto, setConfirmAbierto] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);

  const abrirForm = () => {
    setFormAbierto(true);
    setError(null);
  };

  const cancelarForm = () => {
    setFormAbierto(false);
    setPassword("");
    setError(null);
  };

  const pedirGenerar = () => {
    if (!password) return toast.warning("Debes escribir tu contraseña actual.");
    setConfirmAbierto(true);
  };

  const generar = async () => {
    setConfirmAbierto(false);
    setEnviando(true);
    setError(null);
    try {
      const res = await generateRecoveryCodes(password);
      if (res.status === 200 && res.codigos) {
        setCodigos(res.codigos);
        setRestantes(res.codigos.length);
        cancelarForm();
      } else if (res.code === CODIGO_STEP_UP) {
        setError(describeStepUpError(res.motivo, res.message));
      } else {
        setError(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setEnviando(false);
  };

  // ── La hoja con los diez códigos, mostrada una sola vez ─────────────────
  const cerrarRevelacion = () => setCodigos(null);

  const copiarTodos = async () => {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.map(formatearCodigo).join("\n"));
      // Hallazgo E-13/F15: these ten codes just went into a system clipboard
      // Windows 11 keeps a 25-entry history of (Win+V), synced to the
      // Microsoft account when that sync is on — a browser has no way to
      // mark a clipboard write "sensitive", so the only lever left is
      // saying so.
      toast.success(
        "Códigos copiados. Bórralos del historial del portapapeles (Win+V) apenas termines de guardarlos.",
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

  const badge = () => {
    if (cargando || restantes === null) return <Skeleton className="h-5 w-24 inline-block" />;
    if (restantes === 0) {
      return (
        <Badge className="bg-destructive-fill/10 text-destructive border-destructive/20 shadow-none font-normal">
          Sin códigos disponibles
        </Badge>
      );
    }
    if (restantes <= UMBRAL_BAJO) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none font-normal">
          Quedan {restantes} de 10
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground font-normal">
        {restantes} de 10 sin usar
      </Badge>
    );
  };

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyIcon className="h-4 w-4 text-muted-foreground" />
          Códigos de recuperación
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Diez códigos de un solo uso para entrar si pierdes el acceso a tu aplicación de
          autenticación. Guárdalos impresos o en un lugar seguro — no son un factor por sí solos,
          pero sí la única forma de recuperar el acceso sin tu aplicación.
        </p>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Códigos sin usar:</span>
          {badge()}
        </div>

        {formAbierto ? (
          <EditorBlock
            titulo="Confirma tu contraseña para generar los códigos"
            icon={<KeyIcon className="h-4 w-4 text-muted-foreground" />}
            guardando={enviando}
            guardarLabel="Generar códigos"
            onGuardar={pedirGenerar}
            onCancelar={cancelarForm}
          >
            <EditorField id="recovery-codes-password" label="Contraseña actual" requerido>
              <Input
                id="recovery-codes-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </EditorField>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </EditorBlock>
        ) : (
          <Button variant="outline" size="sm" onClick={abrirForm} disabled={cargando}>
            Generar códigos nuevos
          </Button>
        )}
      </CardContent>

      {/* Confirm: antes de generar, las dos cosas que hay que saber antes,
          no después. */}
      <AlertDialog open={confirmAbierto} onOpenChange={(o) => !o && setConfirmAbierto(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar diez códigos nuevos?</AlertDialogTitle>
            <AlertDialogDescription>
              Si ya tenías códigos, los anteriores dejarán de servir de inmediato. Los nuevos solo se
              muestran una vez, en esta misma pantalla: cópialos o imprímelos antes de cerrar, porque
              no podrás volver a verlos — tu única salida después sería generar otro juego.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAbierto(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={generar}>Sí, generar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* La hoja de códigos. Sin AlertDialogCancel y sin cierre por Escape:
          la única salida es el botón, después de leer la advertencia de
          arriba. */}
      <AlertDialog open={codigos !== null}>
        <AlertDialogContent size="lg" onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Tus códigos de recuperación</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-amber-600 dark:text-amber-500 font-medium">
                Esta es la única vez que vas a ver estos códigos. Guárdalos ahora — cópialos o
                imprímelos — antes de cerrar esta ventana.
              </p>
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
            <AlertDialogAction onClick={cerrarRevelacion}>Ya los guardé, cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default RecoveryCodesSection;
