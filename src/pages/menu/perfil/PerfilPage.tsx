import { useContext, useState, useEffect, useRef } from "react";
import { SesionContext } from "../../../context/SesionContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MailWarningIcon } from "lucide-react";
import { editUsuario, editUserName, editUserPass } from "../../../api/Usuario.api";
import { sendVerificationEmail, verifyEmailToken, endSession, logoutAllSessions } from "../../../api/Login.api";
import { uploadImage } from "../../../api/Upload.api";
import { mensajeDeError } from "../../../api/descarga";
import type { SesionActivaInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { usePerfilData } from "./usePerfilData";
import PerfilHeader from "./PerfilHeader";
import PerfilPersonal from "./PerfilPersonal";
import { datosPersonalesDe, type DatosPersonales } from "./datosPersonales";
import PerfilAcceso from "./PerfilAcceso";
import PerfilSesiones from "./PerfilSesiones";
import PerfilActividad from "./PerfilActividad";
import PerfilPanel from "./PerfilPanel";
import PersonalDialog from "./PersonalDialog";
import UsuarioDialog from "./UsuarioDialog";
import PasswordDialog, { type DatosPassword } from "./PasswordDialog";
import CorreoDialog from "./CorreoDialog";

/**
 * One place to turn a `{status, message}` from `sendVerificationEmail` or
 * `verifyEmailToken` into what the person reads.
 *
 * The 429 branch exists because of a trap specific to this pair of calls: a
 * rate limit reaching this screen can come from three different buckets
 * (`passwordConfirmLimiter`, `emailSendLimiter`, or `emailVerifyLimiter` — see
 * `auth.routes.ts`), each with its own wording, and none of that wording says
 * "wait" as plainly as this screen needs it to. Overriding it here rather
 * than showing whichever sentence happened to come back keeps the message
 * this screen gives stable even if a limiter's own text changes.
 *
 * Every other status shows the server's own sentence verbatim, which is what
 * actually keeps a 401 for "your password is wrong" apart from a 401 for
 * "your account is no longer active" — the two share a status code, but the
 * server already worded them as two different sentences, so passing `message`
 * through unmodified is the whole fix. Hard-coding one generic sentence for
 * every 401 here would silently re-merge them.
 */
const describeEmailError = (status: number, message: string | null): string => {
  if (status === 429) return "Has pedido demasiados correos. Espera un rato antes de volver a intentarlo.";
  return message || "Ocurrió un error en el servidor.";
};

/** Which dialog is open. One, or none. */
type Dialogo = "personal" | "usuario" | "password" | "correo";

/**
 * "Mi perfil": who you are, how you get in, and where you are already in.
 *
 * **The shape of this screen.** An identity header, then facts that are only
 * read: each credential has a button that opens a small dialog, and the dialog
 * owns everything typed in it. This page keeps three things and nothing else —
 * which dialog is open, the API calls with the session and record updates that
 * follow them, and the toasts for what the server answers.
 *
 * That is also why there is no "discard your changes?" bookkeeping here: a
 * dialog is modal, so there is never a second form to switch to, and
 * `FormDialog` already asks before throwing away what a dirty one holds. Each
 * dialog seeds its draft from the record every time it opens, so a photo saved
 * from the header while one is open folds into the record without touching it.
 *
 * Nothing on the page is drawn without the record. If the profile itself does
 * not arrive, the page says so in one card with a retry, rather than showing
 * empty cards and a banner claiming there is no recovery address.
 *
 * The three second-factor rows hold none of this: they type in dialogs of
 * their own.
 */
const PerfilPage = () => {
  const { sesion, setSesion, logout } = useContext(SesionContext);
  const user = sesion.usuario;
  const d = usePerfilData(user.id);

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  /**
   * What the summary panel says about security, and the one thing it can ask
   * for. The counts belong to the second-factor rows of the access card, which
   * load them; they report here so the panel and the rows cannot disagree.
   * `pedirCodigos` is a counter because the confirmation it opens lives in
   * that card: moving it is how the panel's "Generar" presses the same button.
   */
  const [llaves, setLlaves] = useState<number | null>(null);
  const [codigos, setCodigos] = useState<number | null>(null);
  const [pedirCodigos, setPedirCodigos] = useState(0);
  const cerrarDialogo = () => setDialogo(null);

  const [cerrando, setCerrando] = useState<string | null>(null);
  const [cerrandoTodas, setCerrandoTodas] = useState(false);
  const [confirmCerrarTodas, setConfirmCerrarTodas] = useState(false);

  /**
   * Set when the address is verified from the link in the page's own URL.
   *
   * Kept apart from the record because the verification below can resolve
   * *before* the record does (both start on mount, and neither waits for the
   * other), and if the read of the database happened a moment before that
   * UPDATE committed, the record would then say "sin verificar" for an address
   * that was just verified. `recovery` below trusts whichever source reports it
   * verified; only `enviarEmail`, which starts a new verification, clears this.
   */
  const [verificadoAqui, setVerificadoAqui] = useState<string | null>(null);

  /**
   * Redeeming the token from a verification link, if this page was opened
   * from one.
   *
   * `{origin}/perfil#verify_email=TOKEN` — the API puts the token in the URL
   * *fragment*, never the query string, because a fragment is the one part of
   * a URL that never leaves the browser: it does not reach this server, any
   * proxy in between, or the `Referer` header of wherever the link might have
   * been opened from. Reading it and stripping it out of the address bar is
   * this effect's whole job, and the two rules that make that actually hold:
   *
   * - The fragment is cleared *before* the network call, not after. Waiting
   *   for the response would leave a single-use, opaque credential sitting in
   *   the address bar (and in the browser's own history) for as long as the
   *   request takes — including forever, if the tab is closed first.
   * - The token is never logged, never put in a toast, never re-inserted into
   *   the URL on failure. The one thing shown to the person is
   *   `describeEmailError`'s sentence, which only ever contains the server's
   *   own wording, not the token itself.
   *
   * `hashConsumedRef` guards against React 18 StrictMode's deliberate double
   * invocation of effects in development: the token is single-use, so a
   * second call in the same mount would redeem it once and then report
   * "enlace ya no es válido" for the second — a false alarm nowhere near a
   * real failure.
   */
  const hashConsumedRef = useRef(false);
  useEffect(() => {
    const match = /^#verify_email=(.+)$/.exec(window.location.hash);
    if (!match || hashConsumedRef.current) return;
    hashConsumedRef.current = true;

    const token = decodeURIComponent(match[1]);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    verifyEmailToken(token).then((response) => {
      if (response.status === 200) {
        toast.success(response.message || "Correo verificado.");
        setVerificadoAqui(new Date().toISOString());
      } else {
        toast.error(describeEmailError(response.status, response.message));
      }
    });
    // Once, on mount: this reads a one-shot credential out of the address the
    // browser was opened with, which does not reappear while the tab stays open.
  }, []);

  /**
   * The recovery address as the record has it. `email: null` and
   * `verifiedAt: null` is "no address", not an empty string — which would be
   * indistinguishable from somebody who cleared the box by hand.
   */
  const recovery = {
    email: d.usuario?.email ?? null,
    verifiedAt: d.usuario?.email_verified_at ?? verificadoAqui,
  };
  const emailVerificado = recovery.verifiedAt !== null;

  // ── Guardar ────────────────────────────────────────────────────────────────
  //
  // Each of these answers whether it worked, and the dialog that called it
  // closes itself on `true`. A refusal is a toast with the server's own
  // sentence and a `false`, so the dialog stays open with what was typed.

  const base = (): UsuarioInterface => d.usuario ?? user;

  const guardarPersonal = async (datos: DatosPersonales): Promise<boolean> => {
    try {
      const payload: UsuarioInterface = {
        ...base(),
        name: datos.name,
        lastname: datos.lastname,
        phone: datos.phone,
        birthday: datos.birthday as unknown as Date,
      };
      await editUsuario(payload);
      setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, ...payload } }));
      d.actualizarUsuario(payload);
      toast.success("Información actualizada.");
      return true;
    } catch (error) {
      toast.error(mensajeDeError(error, "Error al actualizar la información."));
      return false;
    }
  };

  /**
   * Changing your own photo, which this screen could not do until now.
   *
   * `image` has always been on `usuario.controller.ts`'s `EDITABLE_FIELDS` and
   * `UsuarioSheet` has always written it, so an administrator could change
   * anybody's photo and nobody could change their own without the Seguridad
   * permission that screen sits behind.
   *
   * `uploadImage` used to answer the string `"500"` for every failure, and the
   * warning that stood here was about what a caller who forgot to compare
   * against it would save: `image` set to `"500"`, and every avatar in the
   * application asking the server for a file called 500. That shape is gone —
   * a failure is now `{ ok: false }` and cannot be mistaken for a path — and
   * the message it carries is the server's own, so "la imagen supera el máximo
   * de 5 MB" reaches the person instead of being flattened into "no se pudo".
   */
  const cambiarFoto = async (file: File): Promise<boolean> => {
    const subida = await uploadImage(file);
    if (!subida.ok) {
      toast.error(subida.message);
      return false;
    }
    const path = subida.path;
    const payload: UsuarioInterface = { ...base(), image: path };
    try {
      await editUsuario(payload);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo guardar la foto."));
      return false;
    }
    setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, image: path } }));
    d.actualizarUsuario({ image: path });
    return true;
  };

  /**
   * Renaming this account sends the new name and no password at all.
   *
   * **What is still being protected.** This screen once changed the username
   * having asked for nothing, while `UsuarioDetallePage` — the other screen
   * that renames the same account — asked for a password. Same operation, same
   * account, two screens: whoever did not want to type it used this one. And a
   * username is half the credential, so what that bought was locking somebody
   * out of their own account without ever knowing their password.
   *
   * **Who asks now.** The step-up gate in front of `PUT /usuario/username/:id`,
   * answered by `stepUpInterceptor.ts` from a dialog. That is a stronger check
   * than a box here ever was — it takes a recently proved *factor* from an
   * account that has one, which no password field can — and a cheaper one to
   * live with, because one confirmation covers ten minutes of editing instead
   * of one per request.
   *
   * **So no password field, and putting one back would not tighten anything.**
   * The server ignores it; the gate asks anyway; the person types the same
   * secret twice for one rename. That double prompt is the complaint this work
   * exists to answer.
   */
  const guardarUsuario = async (nuevo: string): Promise<boolean> => {
    try {
      const response = await editUserName({ ...base(), user: nuevo });
      if (response.status === 200) {
        setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, user: nuevo } }));
        d.actualizarUsuario({ user: nuevo });
        toast.success("Nombre de usuario modificado.");
        return true;
      }
      toast.error(response.message || "Error al actualizar el usuario. Podría estar en uso.");
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    return false;
  };

  const guardarPassword = async ({ oldPass, pass }: DatosPassword): Promise<boolean> => {
    try {
      const response = await editUserPass({ ...base(), pass, oldPass });
      if (response.status === 200) {
        toast.success("Contraseña actualizada con éxito.");
        return true;
      }
      toast.error(response.message || "Error al actualizar la contraseña.");
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    return false;
  };

  /**
   * `email_verified_at` is only ever cleared from here, never set — a
   * verified address comes back from the server, on the next load or from the
   * verification effect above — because this call always sends the address off
   * unverified, whatever it was before. That is not a client choice: the server nulls it on every
   * successful `/auth/email/send`, even when the address typed in is byte for
   * byte the one already on file, so a "reenviar" click and a genuine change
   * of address are the same request and this function does not need to tell
   * them apart.
   */
  const enviarEmail = async (direccion: string): Promise<boolean> => {
    try {
      const response = await sendVerificationEmail(direccion);
      if (response.status === 200) {
        toast.success(response.message || "Se envió un enlace de verificación.");
        d.actualizarUsuario({ email: direccion, email_verified_at: null });
        setVerificadoAqui(null);
        return true;
      }
      toast.error(describeEmailError(response.status, response.message));
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    return false;
  };

  // ── Sesiones ───────────────────────────────────────────────────────────────

  /**
   * Closing one session. No confirmation dialog, deliberately: the device
   * simply logs in again, so the worst outcome of a misclick is somebody
   * typing their password once. `logoutAllSessions` below does get one, because
   * that one ends this session too and cannot be taken back.
   */
  const cerrarSesion = async (s: SesionActivaInterface) => {
    setCerrando(s.id);
    const response = await endSession(s.id);
    if (response.status === 200) {
      toast.success("Sesión cerrada.");
      await d.recargarSesiones();
    } else {
      // 404 answers both "no such session" and "not yours", on purpose, so this
      // endpoint cannot be used to find out who is logged in. The screen says
      // the only thing it is entitled to know.
      toast.error(response.status === 404 ? "Esa sesión ya no existe." : (response.message ?? "No se pudo cerrar la sesión."));
      await d.recargarSesiones();
    }
    setCerrando(null);
  };

  const cerrarTodas = async () => {
    setCerrandoTodas(true);
    const response = await logoutAllSessions();
    if (response.status === 200) {
      toast.success(response.message || "Se cerraron todas tus sesiones.");
      // The server already cleared this browser's cookie, so the session here is
      // over whether or not the application notices. Saying so out loud keeps
      // the interface and the truth in step instead of leaving a page that
      // answers 401 to everything the person touches next.
      logout();
    } else {
      toast.error(response.message ?? "No se pudieron cerrar las sesiones.");
    }
    setCerrandoTodas(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const abrirCorreo = () => setDialogo("correo");

  // Loading ended and there is still no record: the profile did not arrive.
  if (!d.loading && !d.usuario) {
    return (
      <div className="p-page w-full space-y-page animate-in fade-in duration-500">
        <Card className="shadow-sm border-muted/60">
          <CardContent className="p-5 flex flex-wrap items-center gap-3">
            <p className="text-sm m-0 flex-1 min-w-[16rem]">No se pudo cargar tu perfil.</p>
            <Button variant="outline" size="sm" onClick={d.recargar}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-page w-full space-y-page animate-in fade-in duration-500">

      <PerfilHeader usuario={d.usuario} loading={d.loading} onCambiarFoto={cambiarFoto} />

      {d.loading || !d.usuario ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-6 items-start">
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <Card key={i} className="shadow-sm border-muted/60">
                <CardContent className="p-5 space-y-4">
                  {[1, 2, 3].map((j) => <Skeleton key={j} className="h-9 w-full" />)}
                </CardContent>
              </Card>
            ))}
          </div>
          <PerfilPanel
            usuario={null} bitacora={[]} eventos={null} emailVerificado={false}
            llaves={null} codigos={null} loading onGenerarCodigos={() => {}}
          />
        </div>
      ) : (
        <>
          {/*
            The one thing on this page that can leave somebody permanently
            locked out, said at full width above everything else rather than as
            fine print inside a card. It sits here, before the two-column split,
            so that on a phone — where the right-hand panel falls to the very
            bottom — the only actionable thing in it is still the first thing
            read. It says what the next step is, and its button opens the same
            dialog as the row below.
          */}
          {!emailVerificado && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <MailWarningIcon className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm m-0 flex-1 min-w-[16rem]">
                {recovery.email
                  ? `Te enviamos un enlace a ${recovery.email}. Ábrelo desde tu correo para confirmarla; hasta entonces no sirve para recuperar tu cuenta.`
                  : "No tienes un correo de recuperación. Si olvidas tu contraseña, no habrá forma de volver a entrar."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 bg-transparent hover:bg-amber-500/10 text-amber-700 dark:text-amber-500"
                onClick={abrirCorreo}
              >
                {recovery.email ? "Reenviar enlace" : "Añadir correo"}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-6 items-start">
            <div className="space-y-6 min-w-0">
              <PerfilPersonal datos={datosPersonalesDe(d.usuario)} onEditar={() => setDialogo("personal")} />

              <PerfilAcceso
                usuario={d.usuario.user || ""}
                recovery={recovery}
                onAbrir={(cual) => setDialogo(cual)}
                onLlaves={setLlaves}
                onCodigos={setCodigos}
                pedirCodigos={pedirCodigos}
              />

              <PerfilSesiones
                sesiones={d.sesiones}
                cerrando={cerrando}
                cerrandoTodas={cerrandoTodas}
                onCerrar={cerrarSesion}
                onCerrarTodas={() => setConfirmCerrarTodas(true)}
              />

              <PerfilActividad bitacora={d.bitacora} />
            </div>

            <PerfilPanel
              usuario={d.usuario}
              bitacora={d.bitacora}
              eventos={d.eventos?.length ?? null}
              emailVerificado={emailVerificado}
              llaves={llaves}
              codigos={codigos}
              loading={false}
              onGenerarCodigos={() => setPedirCodigos((n) => n + 1)}
            />
          </div>

          <PersonalDialog
            open={dialogo === "personal"}
            onClose={cerrarDialogo}
            datos={datosPersonalesDe(d.usuario)}
            onGuardar={guardarPersonal}
          />
          <UsuarioDialog
            open={dialogo === "usuario"}
            onClose={cerrarDialogo}
            usuario={d.usuario.user || ""}
            onGuardar={guardarUsuario}
          />
          <PasswordDialog
            open={dialogo === "password"}
            onClose={cerrarDialogo}
            usuario={d.usuario.user || ""}
            onGuardar={guardarPassword}
          />
          <CorreoDialog
            open={dialogo === "correo"}
            onClose={cerrarDialogo}
            email={recovery.email}
            verificado={emailVerificado}
            onGuardar={enviarEmail}
          />
        </>
      )}

      {/* Confirm: cerrar todas las sesiones */}
      <AlertDialog open={confirmCerrarTodas} onOpenChange={(o) => !o && setConfirmCerrarTodas(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar todas las sesiones?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrarán todos los dispositivos donde tengas la sesión abierta, incluido este.
              Tendrás que volver a entrar con tu usuario y contraseña.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCerrarTodas(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmCerrarTodas(false); cerrarTodas(); }}
              className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
            >
              Sí, cerrar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PerfilPage;
