import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { KeyIcon } from "lucide-react";
import { EditorBlock, EditorField } from "../perfil/perfilRows";
import { RecoveryCodesRevealDialog } from "./RecoveryCodesRevealDialog";
import { SeccionFactor } from "./SeccionFactor";
import { useFilaDePerfil, type FilaDePerfil } from "./useFilaDePerfil";
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
 *
 * **Two shapes, one section**: a card on `/app/segundo-factor`, a row of
 * "Acceso y seguridad" in the profile when `fila` is passed. See
 * `SeccionFactor`.
 */
const RecoveryCodesSection = ({ fila }: { fila?: FilaDePerfil }) => {
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

  useFilaDePerfil(fila, formAbierto && password !== "", cancelarForm);

  const dialogos = (
    <>
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
      {/* La misma hoja que enseña `TotpSection` al confirmar el primer
          factor. Una sola copia: cuando esto vivía aquí duplicado, cada
          arreglo —el aviso del portapapeles de Windows, la ventana de
          impresión que no se cerraba sola— había que hacerlo dos veces, y la
          segunda es la que se olvida. */}
      <RecoveryCodesRevealDialog
        codigos={codigos}
        onAcknowledge={cerrarRevelacion}
        contexto="Cada código sirve una sola vez. Cuando se te acaben, genera un juego nuevo desde esta misma pantalla."
      />
    </>
  );

  return (
    <SeccionFactor
      titulo="Códigos de recuperación"
      icon={KeyIcon}
      fila={fila}
      etiqueta="Códigos de recuperación"
      resumen={badge()}
      abrirLabel="Gestionar códigos de recuperación"
      dialogos={dialogos}
    >
      <div className="space-y-4">
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
      </div>
    </SeccionFactor>
  );
};

export default RecoveryCodesSection;
