import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CopyIcon, KeyRoundIcon, ShieldOffIcon, SmartphoneIcon } from "lucide-react";
import { EditorBlock, EditorField } from "../perfil/perfilRows";
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

/**
 * The exact text of the two 409s `POST /auth/totp/setup` can answer with —
 * copied from `api/src/controllers/totp.controller.ts`'s
 * `MENSAJE_CORREO_NO_VERIFICADO` and `MENSAJE_FACTOR_YA_CONFIGURADO`, the
 * same way `Login.api.ts` copies `LOGOUT_URL`'s address rather than sharing
 * a constant the two repositories cannot both import.
 *
 * The server sends no `code` for either — there was never a need for one
 * until this screen existed to tell them apart — so this is matched by exact
 * text rather than a substring guess. If the server's wording ever changes,
 * this simply stops matching and the screen falls back to a plain banner
 * with whatever `message` says, rather than silently mis-filing a sentence
 * it no longer recognises under the wrong banner.
 */
const MENSAJE_CORREO_NO_VERIFICADO =
  "Debes verificar tu correo antes de configurar un segundo factor. " +
  "Solicita el enlace de verificación desde tu perfil y confírmalo desde tu bandeja de entrada; " +
  "después vuelve a intentar este registro.";
const MENSAJE_FACTOR_YA_CONFIGURADO =
  "Ya tienes un factor de autenticación configurado. Elimínalo antes de registrar uno nuevo.";

type FaseAlta = "reposo" | "password" | "qr";
type Banner409 = "correo" | "factor" | null;

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
 * "Quitar" invites exactly that detour: press Añadir, get asked for a
 * password, and — since a factor is still on file — get refused before the
 * password is even looked at. Every trip around that loop costs one more
 * recovery code. Putting "Quitar" first is the fix a re-ordered sentence
 * cannot express on its own; `TotpSection.test.tsx` pins the DOM order
 * itself, not merely that both sections exist.
 *
 * **Every one of the three requests below carries the account's current
 * password, every time — setup, confirm and delete alike.** That is not
 * this component being cautious; `api/src/routes/totp.routes.ts` mounts all
 * three behind `requireStepUp({ exigeContrasena: true })`, so a call missing
 * it is simply refused. See `Mfa.api.ts`'s header comment for why the
 * password is asked once, at the start of a registration attempt, and
 * reused for the `confirm` that follows moments later rather than asked
 * twice for one continuous action.
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
 */
const TotpSection = () => {
  const { sesion, setSesion } = useContext(SesionContext);
  // ── Quitar ───────────────────────────────────────────────────────────────
  const [bajaAbierta, setBajaAbierta] = useState(false);
  const [passwordBaja, setPasswordBaja] = useState("");
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState<string | null>(null);
  const [confirmBajaAbierto, setConfirmBajaAbierto] = useState(false);

  const abrirBaja = () => {
    setBajaAbierta(true);
    setErrorBaja(null);
  };

  const cancelarBaja = () => {
    setBajaAbierta(false);
    setPasswordBaja("");
    setErrorBaja(null);
  };

  const pedirQuitar = () => {
    if (!passwordBaja) return toast.warning("Debes escribir tu contraseña actual.");
    setConfirmBajaAbierto(true);
  };

  const quitarFactor = async () => {
    setConfirmBajaAbierto(false);
    setEnviandoBaja(true);
    setErrorBaja(null);
    try {
      const res = await deleteTotp(passwordBaja);
      if (res.status === 200) {
        toast.success(res.message || "Se quitó tu factor de autenticación.");
        cancelarBaja();
      } else if (res.status === 404) {
        // "Nothing to remove" is news, not a failure — see MENSAJE_SIN_FACTOR
        // in totp.controller.ts. A red toast here would tell somebody they
        // did something wrong when they did not.
        toast.info(res.message || "No tienes ningún factor de autenticación registrado.");
        cancelarBaja();
      } else if (res.code === CODIGO_STEP_UP) {
        setErrorBaja(describeStepUpError(res.motivo, res.message));
      } else {
        setErrorBaja(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      setErrorBaja("No se pudo conectar con el servidor.");
    }
    setEnviandoBaja(false);
  };

  // ── Añadir ───────────────────────────────────────────────────────────────
  const [fase, setFase] = useState<FaseAlta>("reposo");
  const [passwordAlta, setPasswordAlta] = useState("");
  const [enviandoSetup, setEnviandoSetup] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [banner409, setBanner409] = useState<Banner409>(null);

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

  const abrirAlta = () => {
    setFase("password");
    setErrorAlta(null);
    setBanner409(null);
  };

  /** Abandon the whole attempt. Safe at any point: an unconfirmed row left
   *  behind on the server is replaced, not accumulated, the next time
   *  `setupTotp` is called — see that function's own comment. */
  const cancelarAlta = () => {
    setFase("reposo");
    setPasswordAlta("");
    setErrorAlta(null);
    setBanner409(null);
    setOtpauth(null);
    setSecreto(null);
    setCodigo("");
    setErrorConfirm(null);
  };

  const pedirSetup = async () => {
    if (!passwordAlta) return toast.warning("Debes escribir tu contraseña actual.");
    setEnviandoSetup(true);
    setErrorAlta(null);
    setBanner409(null);
    try {
      const res = await setupTotp(passwordAlta);
      if (res.status === 200 && res.otpauth && res.secreto) {
        setOtpauth(res.otpauth);
        setSecreto(res.secreto);
        setFase("qr");
      } else if (res.status === 409) {
        setErrorAlta(res.message);
        setBanner409(
          res.message === MENSAJE_CORREO_NO_VERIFICADO
            ? "correo"
            : res.message === MENSAJE_FACTOR_YA_CONFIGURADO
              ? "factor"
              : null,
        );
      } else if (res.code === CODIGO_STEP_UP) {
        setErrorAlta(describeStepUpError(res.motivo, res.message));
      } else {
        setErrorAlta(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      setErrorAlta("No se pudo conectar con el servidor.");
    }
    setEnviandoSetup(false);
  };

  const confirmarAlta = async () => {
    if (!codigo.trim()) return toast.warning("Escribe el código de seis dígitos.");
    setEnviandoConfirm(true);
    setErrorConfirm(null);
    try {
      const res = await confirmTotp(codigo.trim(), passwordAlta);
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
        }
      } else if (res.code === CODIGO_STEP_UP) {
        // Rare: the password no longer holds — most likely it was changed in
        // another tab mid-attempt. Sent back to the password step rather
        // than shown a dead-end error under the code field: retyping the
        // code will never fix a stale password.
        setFase("password");
        setOtpauth(null);
        setSecreto(null);
        setErrorAlta(describeStepUpError(res.motivo, res.message));
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
      // just went into a system clipboard that Windows 11 keeps a 25-entry
      // history of (Win+V) — synced to the Microsoft account when that sync
      // is on. There is no way to mark a clipboard write "sensitive" from a
      // browser, so the only lever left is saying so.
      toast.success(
        "Código copiado. Bórralo del historial del portapapeles (Win+V) apenas termines de pegarlo.",
      );
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    }
  };

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <SmartphoneIcon className="h-4 w-4 text-muted-foreground" />
          Aplicación de autenticación
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-4 space-y-5">
        {/*
          "Quitar" first in the markup — see this component's own docstring
          for why the order, not merely the presence, is the fix for
          hallazgo A5.
        */}
        <section className="space-y-3" aria-labelledby="totp-quitar-heading">
          <div>
            <h3 id="totp-quitar-heading" className="text-sm font-medium flex items-center gap-2">
              <ShieldOffIcon className="h-4 w-4 text-muted-foreground" />
              Quitar tu factor actual
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Si perdiste el teléfono o ya no usas tu aplicación de autenticación, quítalo aquí{" "}
              <strong>antes</strong> de intentar registrar uno nuevo. Mientras quede un factor
              registrado, el sistema seguirá pidiéndote que lo pruebes, aunque ya no puedas hacerlo.
            </p>
          </div>

          {bajaAbierta ? (
            <EditorBlock
              titulo="Confirma tu contraseña para quitar el factor"
              icon={<ShieldOffIcon className="h-4 w-4 text-muted-foreground" />}
              guardando={enviandoBaja}
              guardarLabel="Quitar factor"
              destructivo
              onGuardar={pedirQuitar}
              onCancelar={cancelarBaja}
            >
              <EditorField id="totp-quitar-password" label="Contraseña actual" requerido>
                <Input
                  id="totp-quitar-password"
                  type="password"
                  value={passwordBaja}
                  onChange={(e) => setPasswordBaja(e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </EditorField>
              {errorBaja && <p className="text-sm text-destructive">{errorBaja}</p>}
            </EditorBlock>
          ) : (
            <Button variant="outline" size="sm" onClick={abrirBaja}>
              Quitar mi factor
            </Button>
          )}
        </section>

        <div className="border-t border-border/40" />

        <section className="space-y-3" aria-labelledby="totp-anadir-heading">
          <div>
            <h3 id="totp-anadir-heading" className="text-sm font-medium flex items-center gap-2">
              <KeyRoundIcon className="h-4 w-4 text-muted-foreground" />
              Configurar un nuevo factor
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Funciona con Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden
              o cualquier otra aplicación compatible con TOTP.
            </p>
          </div>

          {fase === "reposo" && (
            <Button size="sm" onClick={abrirAlta}>
              Configurar un nuevo factor
            </Button>
          )}

          {fase === "password" && (
            <EditorBlock
              titulo="Confirma tu contraseña para empezar"
              icon={<KeyRoundIcon className="h-4 w-4 text-muted-foreground" />}
              guardando={enviandoSetup}
              guardarLabel="Continuar"
              onGuardar={pedirSetup}
              onCancelar={cancelarAlta}
            >
              <EditorField id="totp-alta-password" label="Contraseña actual" requerido>
                <Input
                  id="totp-alta-password"
                  type="password"
                  value={passwordAlta}
                  onChange={(e) => setPasswordAlta(e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </EditorField>
              {errorAlta && (
                <div className="space-y-1">
                  <p className="text-sm text-destructive">{errorAlta}</p>
                  {banner409 === "correo" && (
                    // A plain `<a>`, not `<Link>` — no `<Router>` is
                    // guaranteed around this component in every test that
                    // mounts it, and a full navigation costs nothing extra
                    // for a one-off trip to another settings screen.
                    <a href="/app/perfil" className="text-sm underline text-primary">
                      Ir a mi perfil a verificar mi correo
                    </a>
                  )}
                  {banner409 === "factor" && (
                    <p className="text-sm text-muted-foreground">
                      Usa «Quitar mi factor», arriba, y vuelve a intentarlo.
                    </p>
                  )}
                </div>
              )}
            </EditorBlock>
          )}

          {fase === "qr" && (
            <div className="rounded-lg bg-muted/50 border border-border/60 p-4 space-y-4">
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
                    Escanea el código con tu aplicación de autenticación. Si no puedes escanearlo,
                    escribe este código a mano:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-background border rounded px-2 py-1 break-all">
                      {secreto}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copiarSecreto} aria-label="Copiar código">
                      <CopyIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <EditorField id="totp-confirmar-codigo" label="Código de 6 dígitos" requerido>
                <Input
                  id="totp-confirmar-codigo"
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
              </EditorField>
              {errorConfirm && <p className="text-sm text-destructive">{errorConfirm}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={cancelarAlta} disabled={enviandoConfirm}>
                  Cancelar
                </Button>
                <Button onClick={confirmarAlta} disabled={enviandoConfirm}>
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </section>
      </CardContent>

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
    </Card>
  );
};

export default TotpSection;
