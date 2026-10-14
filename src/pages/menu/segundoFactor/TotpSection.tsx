import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CopyIcon, Loader2Icon, PlusIcon, ShieldOffIcon, SmartphoneIcon } from "lucide-react";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "./CampoDialogo";
import {
  setupTotp,
  confirmTotp,
  deleteTotp,
  describeStepUpError,
  CODIGO_STEP_UP,
} from "../../../api/Mfa.api";
import { comprobarToken } from "../../../api/Login.api";
import { SesionContext } from "../../../context/SesionContext";
import { renderTotpQr } from "./totpQr";
import { RecoveryCodesRevealDialog } from "./RecoveryCodesRevealDialog";
import { SeccionFactor } from "./SeccionFactor";
import type { FilaDePerfil } from "./filaDePerfil";
import { enWindows } from "./portapapeles";
import { touchTarget } from "@/components/ui/touch-target";

type FaseAlta = "reposo" | "qr";

/**
 * TOTP setup, confirmation and removal — Task 19 of the 4B plan.
 *
 * **"Quitar" is the first thing in this component's JSX, and that is the
 * whole point, not an accident of layout.** Hallazgo A5, measured with a
 * clock: somebody who lost their phone still has a *confirmed* TOTP row —
 * dead, but registered — so `tieneAlgunFactor` keeps answering `true` and
 * `requireStepUp` keeps demanding a fresh proof of a factor they can no
 * longer produce, on every route that would let them register a new one.
 * The one door that stays open is deleting the dead factor **while a proof
 * from the last few minutes is still fresh** — a recovery code they just
 * spent to log in, most often — which is a window that closes the moment
 * they wander off to do something else first, like verifying an email
 * `setup` is about to demand anyway. A screen that shows "Añadir" above
 * "Quitar" invites exactly that detour: press Añadir, get the 409 that says
 * a factor is already on file, and come back to "Quitar" with the window
 * gone. Every trip around that loop costs one more recovery code. Putting
 * "Quitar" first is the fix a re-ordered sentence cannot express on its own;
 * `TotpSection.test.tsx` pins the DOM order itself, not merely that both
 * buttons exist.
 *
 * **None of the three requests below carries a password.** Until 2026-10-10
 * all three demanded it on every request, so this component asked for it in a
 * form of its own before showing anything. Since that day the routes take the
 * ten-minute window like every other gated one (Isaias): when something has
 * to be proved the step-up dialog asks, once, and the request repeats itself.
 * "Configurar aplicación" therefore goes straight to the QR.
 *
 * **`SesionContext` is read here now, for exactly one write.** Hallazgo
 * E-3/F12: `confirmTotp`'s 200 promotes the session on the server —
 * `totp.controller.ts`'s own comment on that handler spells out why a
 * confirmed-but-not-promoted session is worse than not confirming at all —
 * and this component used to stop at a toast, leaving `SesionContext` (and
 * therefore the sidebar and `HomeRoute`) holding the *old* `estado`. Day 15,
 * that meant: verify, get told "listo", press "Inicio", and land right back
 * on the day-15 redirect with the same expired-grace toast, because
 * `HomeRoute` reads `sesion.estado` and nothing here had told it to change —
 * fixed only by a manual reload nothing on screen suggests. `comprobarToken`
 * + `setSesion` below is the exact pair `pages/login/SegundoFactorPage.tsx`
 * already uses for the same reason, and reads no `estado` guessed from this
 * response's own body: `/auth/me` is the one authority for that shape, same
 * as everywhere else in this codebase that touches it.
 *
 * **Confirming can also hand back the account's first ten recovery codes**
 * (Isaias, 2026-09-02): `Mfa.api.ts`'s `confirmTotp` now carries a `codigos`
 * field, non-`null` exactly when the server decided nothing was already
 * outstanding to invalidate — see `totp.controller.ts`'s own comment on that
 * decision. When it is non-`null`, `RecoveryCodesRevealDialog` shows them
 * right here, with a mandatory acknowledgement, instead of the old toast
 * that only ever *suggested* a trip to `RecoveryCodesSection.tsx` — a trip
 * nothing forced anyone to actually take.
 *
 * **Two shapes, one section**: a card on `/app/segundo-factor`, a row of
 * "Acceso y seguridad" in the profile when `fila` is passed. See
 * `SeccionFactor`. The row carries no status, unlike its two neighbours:
 * nothing the server answers to a full session says whether a TOTP is
 * registered, and this component has never needed to know. Its two buttons sit
 * on the row itself, in the same order as the card's and for the same reason,
 * and the paragraph about a lost phone stays on the card: the order of the two
 * buttons already says "remove first".
 */
const TotpSection = ({
  fila,
  onCodigosEmitidos,
}: {
  fila?: FilaDePerfil;
  /** Confirming just minted the ten codes: whoever shows their count should read it again. */
  onCodigosEmitidos?: () => void;
}) => {
  const { sesion, setSesion } = useContext(SesionContext);
  // ── Quitar ───────────────────────────────────────────────────────────────
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [confirmBajaAbierto, setConfirmBajaAbierto] = useState(false);

  // Failures go to a toast: there is no form left to hang them under.
  const quitarFactor = async () => {
    setConfirmBajaAbierto(false);
    setEnviandoBaja(true);
    try {
      const res = await deleteTotp();
      if (res.status === 200) {
        toast.success(res.message || "Se quitó tu factor de autenticación.");
      } else if (res.status === 404) {
        // "Nothing to remove" is news, not a failure — see MENSAJE_SIN_FACTOR
        // in totp.controller.ts. A red toast here would tell somebody they
        // did something wrong when they did not.
        toast.info(res.message || "No tienes ningún factor de autenticación registrado.");
      } else if (res.code === CODIGO_STEP_UP) {
        toast.error(describeStepUpError(res.motivo, res.message));
      } else {
        toast.error(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    }
    setEnviandoBaja(false);
  };

  // ── Añadir ───────────────────────────────────────────────────────────────
  const [fase, setFase] = useState<FaseAlta>("reposo");
  const [enviandoSetup, setEnviandoSetup] = useState(false);

  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviandoConfirm, setEnviandoConfirm] = useState(false);
  const [errorConfirm, setErrorConfirm] = useState<string | null>(null);
  // `null` = nothing to show. Set the instant `confirmTotp` hands back a
  // non-null `codigos`, and cleared only by the dialog's own mandatory
  // acknowledgement — see this component's own docstring.
  const [codigosRecuperacion, setCodigosRecuperacion] = useState<string[] | null>(null);

  // Renders the QR the moment a fresh otpauth:// URI lands, and clears it the
  // moment the attempt is abandoned. `vigente` rather than an
  // AbortController: `renderTotpQr` has no way to be cancelled, and the only
  // thing that can go wrong is applying a stale render after the person
  // already cancelled or the confirm already succeeded.
  useEffect(() => {
    if (!otpauth) {
      setQrSvg(null);
      return;
    }
    let vigente = true;
    renderTotpQr(otpauth).then((svg) => {
      if (vigente) setQrSvg(svg);
    });
    return () => {
      vigente = false;
    };
  }, [otpauth]);

  /** Abandon the whole attempt. Safe at any point: an unconfirmed row left
   *  behind on the server is replaced, not accumulated, the next time
   *  `setupTotp` is called — see that function's own comment. */
  const cancelarAlta = () => {
    setFase("reposo");
    setOtpauth(null);
    setSecreto(null);
    setCodigo("");
    setErrorConfirm(null);
  };

  /**
   * "Configurar aplicación": ask the server for a secret and open the QR.
   *
   * Nothing opens until the answer is in. A refusal here is one of two 409s
   * — the address is not verified yet, or a confirmed factor already exists —
   * and the server's own sentence says which and what to do about it, so it
   * goes in a toast that stays long enough to be read.
   */
  const pedirSetup = async () => {
    setEnviandoSetup(true);
    try {
      const res = await setupTotp();
      if (res.status === 200 && res.otpauth && res.secreto) {
        setOtpauth(res.otpauth);
        setSecreto(res.secreto);
        setFase("qr");
      } else if (res.code === CODIGO_STEP_UP) {
        toast.error(describeStepUpError(res.motivo, res.message));
      } else {
        toast.error(res.message || "Ocurrió un error en el servidor.", { duration: 10000 });
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    }
    setEnviandoSetup(false);
  };

  const confirmarAlta = async () => {
    if (!codigo.trim()) return toast.warning("Escribe el código de seis dígitos.");
    setEnviandoConfirm(true);
    setErrorConfirm(null);
    try {
      const res = await confirmTotp(codigo.trim());
      if (res.status === 200) {
        toast.success("Tu segundo factor quedó configurado correctamente.");
        cancelarAlta();
        // Hallazgo E-3/F12 — see this component's own docstring. The server
        // already promoted the session; this is what tells this browser.
        const yo = await comprobarToken();
        if (yo.status === 200 && yo.usuario) {
          setSesion({
            usuario: yo.usuario,
            permisos: yo.permisos,
            estado: yo.estado,
            autenticado: yo.estado !== "parcial",
          });
        }
        // Isaias, 2026-09-02: only non-null when the server decided this
        // confirmation is what should mint the account's first ten recovery
        // codes — see this component's own docstring. `null` means an
        // outstanding sheet already existed, so there is nothing to reveal.
        if (res.codigos) {
          setCodigosRecuperacion(res.codigos);
          onCodigosEmitidos?.();
        }
      } else if (res.code === CODIGO_STEP_UP) {
        // The window `setupTotp` opened ran out while the QR was on screen
        // and the person cancelled the dialog that asked again. The secret is
        // still good: they can press Confirmar once more.
        setErrorConfirm(describeStepUpError(res.motivo, res.message));
      } else {
        setErrorConfirm(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      setErrorConfirm("No se pudo conectar con el servidor.");
    }
    setEnviandoConfirm(false);
  };

  const copiarSecreto = async () => {
    if (!secreto) return;
    try {
      await navigator.clipboard.writeText(secreto);
      // Hallazgo E-13/F15: this secret is the second factor itself, and it
      // just went into a system clipboard. On Windows 11 that keeps a 25-entry
      // history (Win+V), synced to the Microsoft account when that sync is on.
      // There is no way to mark a clipboard write "sensitive" from a browser,
      // so the only lever left is saying so — and saying the Windows part only
      // where it is true.
      toast.success(
        enWindows()
          ? "Código copiado. Bórralo del historial del portapapeles (Win+V) apenas termines de pegarlo."
          : "Código copiado. Bórralo del portapapeles apenas termines de pegarlo.",
      );
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    }
  };

  const dialogos = (
    <>
      <FormDialog
        open={fase === "qr"}
        onClose={cancelarAlta}
        size="md"
        title="Configurar la aplicación de autenticación"
        description="Escanea el código con tu aplicación y escribe los seis dígitos que te muestre."
        // Always: abandoning this step throws away a secret the person may
        // already have scanned.
        dirty
        saving={enviandoConfirm}
        submitLabel="Confirmar"
        savingLabel="Comprobando…"
        onSubmit={() => void confirmarAlta()}
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* `bg-white` is deliberate and not a theme miss: a QR code
              has to stay dark-on-light to stay scannable in every
              phone camera, whatever theme this page is drawn in. */}
          <div
            className="inline-block rounded-lg border bg-white p-3 shrink-0"
            role="img"
            aria-label="Código QR para configurar el segundo factor"
            dangerouslySetInnerHTML={{ __html: qrSvg ?? "" }}
          />
          <div className="space-y-2 min-w-0">
            <p className="text-sm text-muted-foreground">
              Si no puedes escanearlo, escribe este código a mano en tu aplicación:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-background border rounded px-2 py-1 break-all">
                {secreto}
              </code>
              <Button variant="ghost" size="icon" className={`h-7 w-7 shrink-0 ${touchTarget}`} onClick={copiarSecreto} aria-label="Copiar código">
                <CopyIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <CampoDialogo id="totp-confirmar-codigo" label="Código de 6 dígitos" requerido>
          <Input
            id="totp-confirmar-codigo"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            // Hallazgo E-12/F14: Google Authenticator and Authy both
            // display the code as "123 456", with a space in the
            // middle. Pasting that verbatim into a bare `maxLength={6}`
            // field truncates to "123 45" — six characters, none of
            // them the code — and the person reads "código incorrecto"
            // while looking at a correct one. Same sanitizer
            // `pages/login/SegundoFactorPage.tsx` already uses for the
            // same paste.
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="font-mono tracking-widest w-32"
            placeholder="000000"
            maxLength={6}
          />
        </CampoDialogo>
        {errorConfirm && <p role="alert" className="text-sm text-destructive">{errorConfirm}</p>}
      </FormDialog>

      {/* Confirm: quitar el factor */}
      <AlertDialog open={confirmBajaAbierto} onOpenChange={(o) => !o && setConfirmBajaAbierto(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar tu segundo factor?</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Plan 4E: a verified address is a full factor, so an account
                  with one does not fall back to the password alone — and
                  telling it so would be false. */}
              {sesion?.usuario?.email_verified_at
                ? "Se eliminará la aplicación de autenticación registrada en esta cuenta. Tu correo verificado sigue siendo tu segundo factor: entrarás con un código enviado a él. Los códigos de recuperación no cuentan como un factor."
                : "Se eliminará la aplicación de autenticación registrada en esta cuenta. Si no tienes ningún otro factor, a partir de ahora volverás a entrar solo con tu contraseña — los códigos de recuperación no cuentan como un factor y no evitan esto."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmBajaAbierto(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={quitarFactor}
              className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Isaias, 2026-09-02: the account's first ten recovery codes, shown
          the instant confirming this factor is what minted them. See this
          component's own docstring and `RecoveryCodesRevealDialog`'s. */}
      <RecoveryCodesRevealDialog
        codigos={codigosRecuperacion}
        onAcknowledge={() => setCodigosRecuperacion(null)}
        contexto="Tu segundo factor ya está activo. Estos diez códigos son tu única forma de entrar si alguna vez pierdes el acceso a tu aplicación de autenticación."
      />
    </>
  );

  return (
    <SeccionFactor
      titulo="Aplicación de autenticación"
      icon={SmartphoneIcon}
      fila={fila}
      etiqueta="Aplicación"
      resumen={<span className="text-muted-foreground">Códigos de seis dígitos desde tu teléfono</span>}
      accionesFila={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Quitar aplicación de autenticación"
            onClick={() => setConfirmBajaAbierto(true)}
            disabled={enviandoBaja}
          >
            Quitar
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Configurar aplicación de autenticación"
            onClick={() => void pedirSetup()}
            disabled={enviandoSetup}
          >
            Configurar
          </Button>
        </div>
      }
      dialogos={dialogos}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Códigos de seis dígitos desde Google Authenticator, Microsoft Authenticator, Authy,
          1Password, Bitwarden o cualquier otra aplicación compatible.
        </p>

        {/*
          "Quitar" first in the markup — see this component's own docstring
          for why the order, not merely the presence, is the fix for
          hallazgo A5. Two buttons on one line and nothing else: each used to
          sit under a heading that repeated its own label.
        */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmBajaAbierto(true)} disabled={enviandoBaja}>
            <ShieldOffIcon className="h-4 w-4 mr-1.5" aria-hidden />
            Quitar aplicación
          </Button>
          <Button variant="outline" size="sm" onClick={() => void pedirSetup()} disabled={enviandoSetup}>
            {enviandoSetup ? (
              <Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" aria-hidden />
            ) : (
              <PlusIcon className="h-4 w-4 mr-1.5" aria-hidden />
            )}
            Configurar aplicación
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          ¿Perdiste el teléfono o cambiaste de aplicación? Quita primero la que tienes registrada:
          mientras siga ahí, el sistema te la seguirá pidiendo aunque ya no puedas usarla.
        </p>
      </div>
    </SeccionFactor>
  );
};

export default TotpSection;
