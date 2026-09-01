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
import { passwordLengthError } from "../../../lib/password";
import type { SesionActivaInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { usePerfilData } from "./usePerfilData";
import PerfilHeader from "./PerfilHeader";
import PerfilPersonal, { type DatosPersonales } from "./PerfilPersonal";
import PerfilAcceso, { type DatosCuenta, type EditorAcceso } from "./PerfilAcceso";
import PerfilSesiones from "./PerfilSesiones";
import PerfilActividad from "./PerfilActividad";
import PerfilPanel from "./PerfilPanel";

/**
 * The same loose, non-RFC shape check `email.controller.ts` runs server-side
 * (`EMAIL_SHAPE` there). Copied rather than shared — the two repositories
 * cannot import from each other — and kept deliberately loose for the same
 * reason the server's is: this is a cheap filter against an obvious typo, not
 * a security boundary. The server is still the one that decides whether an
 * address is acceptable; this only saves a round trip, a rate-limit charge,
 * and a confirmation dialog the person would have to dismiss.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Which editor is open. Exactly one, or none. */
type Editor = "personal" | EditorAcceso;

const CUENTA_VACIA: DatosCuenta = { user: "", userPass: "", oldPass: "", pass: "", confirmPass: "" };

/**
 * "Mi perfil": who you are, how you get in, and where you are already in.
 *
 * **The shape of this screen, and why it changed.** It used to be four cards of
 * always-open forms in a two-column grid, all weighted the same, so "teléfono"
 * looked exactly as consequential as "cambiar contraseña" and three separate
 * boxes asked for the current password without explaining why there were three.
 * There was no photo, no way to set one, and nothing at all about the account
 * itself — while `UsuarioDetallePage`, the screen an administrator uses to look
 * at *somebody else*, had a face, statistics and a history. Your own profile was
 * the poorer of the two.
 *
 * Now: an identity header, then facts that are read until you open one, one at a
 * time. The three consequential ones keep their confirmation dialogs; the purely
 * informational one lost its, because "Editar → Guardar" already is the
 * confirmation and the data can be typed back.
 *
 * **One editor at a time** is not a stylistic choice. Two open forms on one
 * screen is what produced the three-password-boxes problem in the first place,
 * and with a Save button per form it is genuinely unclear which one Enter
 * commits. Opening a second editor over a dirty one asks first, rather than
 * silently discarding what was typed.
 *
 * The state below is deliberately still held here rather than inside each
 * section: the dirty check that guards editor switching has to see every form's
 * value, and a component that owns its own draft cannot be asked about it.
 */
const PerfilPage = () => {
  const { sesion, setSesion, logout } = useContext(SesionContext);
  const user = sesion.usuario;
  const d = usePerfilData(user.id);

  const [editor, setEditor] = useState<Editor | null>(null);
  /** Where to go once the person agrees to discard what is open. */
  const [pendiente, setPendiente] = useState<Editor | null>(null);

  const [datos, setDatos] = useState<DatosPersonales>({ name: "", lastname: "", phone: "", birthday: "" });
  /** What the server has, to compare a draft against. Never edited. */
  const [datosGuardados, setDatosGuardados] = useState<DatosPersonales>(datos);

  /**
   * `userPass` is the current password the *rename* has to carry, and it is a
   * field of its own rather than a reuse of `oldPass` below.
   *
   * They are two forms. Sharing one value would mean typing the password to
   * change your password and finding the rename already armed with it — or
   * worse, sending a rename carrying whatever was left in a box somebody had
   * been using for something else. Only one of the two is ever on screen now,
   * which makes the confusion impossible rather than merely unlikely, but the
   * separation is what the tests actually pin.
   */
  const [cuenta, setCuenta] = useState<DatosCuenta>(CUENTA_VACIA);

  /**
   * The recovery address as the server currently has it, kept apart from
   * `emailForm` the same way `cuenta.user` is kept apart from the box that
   * renames it: one is "what is saved", the other is "what is being typed".
   * `email: null` and `verifiedAt: null` is the true starting shape — not "no
   * address yet" as an empty string, which would be indistinguishable from
   * somebody who cleared the input by hand.
   */
  const [recovery, setRecovery] = useState<{ email: string | null; verifiedAt: string | null }>({
    email: null,
    verifiedAt: null,
  });
  const [emailForm, setEmailForm] = useState({ email: "", pass: "" });

  const [guardandoPersonal, setGuardandoPersonal] = useState(false);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const [cerrando, setCerrando] = useState<string | null>(null);
  const [cerrandoTodas, setCerrandoTodas] = useState(false);

  const [confirmUsername, setConfirmUsername] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [confirmCerrarTodas, setConfirmCerrarTodas] = useState(false);

  /**
   * Seed every form from the record, **once**, when it first lands.
   *
   * Once, and guarded by a ref rather than left to re-run on every change to
   * `d.usuario`, because of one path that is easy to miss: the photo button
   * lives in the header and works no matter which editor is open. Saving a
   * photo folds the new `image` into the loaded record, and a seeding effect
   * that re-ran on that would reach straight into an open editor and put its
   * boxes back to what the server has — somebody typing a new recovery address,
   * changing their photo, and watching the address they had just typed revert.
   *
   * Nothing is lost by seeding once. Every save handler already updates what it
   * changed (`datosGuardados` after personal details, `recovery` after a send),
   * and `limpiar` reads the current record rather than this snapshot.
   */
  const sembradoRef = useRef(false);
  useEffect(() => {
    if (!d.usuario || sembradoRef.current) return;
    sembradoRef.current = true;
    const cargados: DatosPersonales = {
      name: d.usuario.name || "",
      lastname: d.usuario.lastname || "",
      phone: d.usuario.phone || "",
      birthday: d.usuario.birthday ? String(d.usuario.birthday).slice(0, 10) : "",
    };
    setDatos(cargados);
    setDatosGuardados(cargados);
    setCuenta((prev) => ({ ...prev, user: d.usuario!.user || "" }));
    setEmailForm((prev) => ({ ...prev, email: d.usuario!.email ?? "" }));
    setRecovery((prev) => ({
      email: d.usuario!.email ?? null,
      // `?? prev.verifiedAt`, not a flat overwrite: the hash-verification
      // effect below can resolve *before* this record does (both start on
      // mount, and neither waits for the other), and if this read of the
      // database happened a moment before that UPDATE committed, a flat
      // assignment would silently put a just-verified address back to "sin
      // verificar" the instant it arrived. Nothing else here ever moves
      // `verifiedAt` from a real timestamp back to `null` except `sendEmail`
      // explicitly starting a new verification, so trusting whichever source
      // already reported "verified" is always safe.
      verifiedAt: d.usuario!.email_verified_at ?? prev.verifiedAt,
    }));
  }, [d.usuario]);

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
        setRecovery((prev) => ({ ...prev, verifiedAt: new Date().toISOString() }));
      } else {
        toast.error(describeEmailError(response.status, response.message));
      }
    });
    // Once, on mount: this reads a one-shot credential out of the address the
    // browser was opened with, which does not reappear while the tab stays open.
  }, []);

  const emailVerificado = recovery.verifiedAt !== null;

  // ── Abrir y cerrar editores ────────────────────────────────────────────────

  /** Whether the open editor holds something that would be lost. */
  const hayCambios = (cual: Editor | null): boolean => {
    if (cual === "personal") {
      return (Object.keys(datos) as (keyof DatosPersonales)[]).some((k) => datos[k] !== datosGuardados[k]);
    }
    if (cual === "usuario") return cuenta.user !== (d.usuario?.user ?? "") || cuenta.userPass !== "";
    if (cual === "password") return cuenta.oldPass !== "" || cuenta.pass !== "" || cuenta.confirmPass !== "";
    if (cual === "email") return emailForm.email.trim() !== (recovery.email ?? "") || emailForm.pass !== "";
    return false;
  };

  /**
   * Put an editor back the way the server has it.
   *
   * Every password box is emptied rather than restored, in all three cases:
   * there is nothing on the server to restore them to, and a cancelled editor
   * that kept a typed password would leave a credential sitting in a detached
   * form's state for the rest of the session.
   */
  const limpiar = (cual: Editor) => {
    if (cual === "personal") setDatos(datosGuardados);
    if (cual === "usuario") setCuenta((prev) => ({ ...prev, user: d.usuario?.user ?? "", userPass: "" }));
    if (cual === "password") setCuenta((prev) => ({ ...prev, oldPass: "", pass: "", confirmPass: "" }));
    if (cual === "email") setEmailForm({ email: recovery.email ?? "", pass: "" });
  };

  const abrir = (cual: Editor) => {
    if (editor === cual) return;
    if (editor && hayCambios(editor)) return setPendiente(cual);
    if (editor) limpiar(editor);
    setEditor(cual);
  };

  const cancelar = () => {
    if (editor) limpiar(editor);
    setEditor(null);
  };

  /** Close the editor after a save that worked, without wiping what was saved. */
  const cerrarTrasGuardar = (cual: Editor) => {
    if (editor === cual) setEditor(null);
  };

  const descartarYSeguir = () => {
    if (editor) limpiar(editor);
    setEditor(pendiente);
    setPendiente(null);
  };

  // ── Guardar ────────────────────────────────────────────────────────────────

  const base = (): UsuarioInterface => d.usuario ?? user;

  const guardarPersonal = async () => {
    if (!datos.name.trim() || !datos.lastname.trim()) {
      return toast.warning("Nombre y apellidos son obligatorios.");
    }
    setGuardandoPersonal(true);
    try {
      const payload: UsuarioInterface = {
        ...base(),
        name: datos.name,
        lastname: datos.lastname,
        phone: datos.phone,
        birthday: datos.birthday as unknown as Date,
      };
      if (await editUsuario(payload) === 200) {
        setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, ...payload } }));
        d.actualizarUsuario(payload);
        setDatosGuardados(datos);
        cerrarTrasGuardar("personal");
        toast.success("Información actualizada.");
      } else {
        toast.error("Error al actualizar la información.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setGuardandoPersonal(false);
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
    if (await editUsuario(payload) !== 200) {
      toast.error("No se pudo guardar la foto.");
      return false;
    }
    setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, image: path } }));
    d.actualizarUsuario({ image: path });
    return true;
  };

  /**
   * Renaming this account sends the current password with the change.
   *
   * **The hole this closes.** This screen changed the username having asked for
   * nothing at all, while `UsuarioDetallePage` — the other screen that renames
   * the same account — asked for a password. Same operation, same account, two
   * screens: whoever did not want to type it used this one. And a username is
   * half the credential, so what that bought was locking somebody out of their
   * own account without ever knowing their password — the unattended machine in
   * the office, or the shared field laptop.
   *
   * **Sent with the change, not confirmed before it.** `updateUserName` demands
   * it server-side now, so a prior call to `POST /api/auth/confirm-password`
   * could not stand in for this: it would only add a second comparison, out of a
   * second budget, in a second place the rule can drift. That endpoint has since
   * been retired, for exactly this reason.
   *
   * The password is left in the box on failure and cleared only on success, so
   * a 429 or a mistyped name does not cost it twice.
   */
  const guardarUsuario = async () => {
    setGuardandoUsuario(true);
    try {
      const payload: UsuarioInterface = { ...base(), user: cuenta.user };
      const response = await editUserName({ ...payload, oldPass: cuenta.userPass });
      if (response.status === 200) {
        setSesion((prev) => ({ ...prev, usuario: { ...prev.usuario, user: cuenta.user } }));
        d.actualizarUsuario({ user: cuenta.user });
        setCuenta((prev) => ({ ...prev, userPass: "" }));
        cerrarTrasGuardar("usuario");
        toast.success("Nombre de usuario modificado.");
      } else {
        toast.error(response.message || "Error al actualizar el usuario. Podría estar en uso.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setGuardandoUsuario(false);
  };

  const guardarPassword = async () => {
    setGuardandoPassword(true);
    try {
      const response = await editUserPass({ ...base(), pass: cuenta.pass, oldPass: cuenta.oldPass });
      if (response.status === 200) {
        setCuenta((prev) => ({ ...prev, oldPass: "", pass: "", confirmPass: "" }));
        cerrarTrasGuardar("password");
        toast.success("Contraseña actualizada con éxito.");
      } else {
        toast.error(response.message || "Error al actualizar la contraseña.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setGuardandoPassword(false);
  };

  /**
   * `email_verified_at` is never set from here — it comes back only from the
   * server, on the next load or from the verification effect above — because
   * this call always sends the address off unverified, whatever it was
   * before. That is not a client choice: the server nulls it on every
   * successful `/auth/email/send`, even when the address typed in is byte for
   * byte the one already on file, so a "reenviar" click and a genuine change
   * of address are the same request and this function does not need to tell
   * them apart.
   */
  const enviarEmail = async () => {
    setGuardandoEmail(true);
    try {
      const direccion = emailForm.email.trim();
      const response = await sendVerificationEmail(direccion, emailForm.pass);
      if (response.status === 200) {
        toast.success(response.message || "Se envió un enlace de verificación.");
        setEmailForm((prev) => ({ ...prev, pass: "" }));
        setRecovery({ email: direccion, verifiedAt: null });
        cerrarTrasGuardar("email");
      } else {
        toast.error(describeEmailError(response.status, response.message));
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setGuardandoEmail(false);
  };

  // ── Puertas antes de cada diálogo ──────────────────────────────────────────

  const pedirGuardarUsuario = () => {
    if (!cuenta.user) return toast.warning("El nombre de usuario no puede estar vacío");
    // Nothing leaves the browser without it. Not a security check — the server
    // refuses an empty one anyway — but an empty attempt would spend one of the
    // five confirmations the account is allowed in a quarter of an hour.
    if (!cuenta.userPass) return toast.warning("Debe confirmar su contraseña actual.");
    setConfirmUsername(true);
  };

  const pedirGuardarPassword = () => {
    if (!cuenta.oldPass) return toast.warning("Debe proporcionar su contraseña actual.");
    if (!cuenta.pass || !cuenta.confirmPass) return toast.warning("Debe rellenar ambos campos de nueva contraseña.");
    if (cuenta.pass !== cuenta.confirmPass) return toast.warning("Las contraseñas no coinciden.");
    /**
     * The server's own rule, taken from the one place it lives on this side —
     * `lib/password.ts` — and not a number typed in here.
     *
     * This check said `< 6` while the server demanded twelve, and the gap was
     * declared harmless because "the server rejects correctly, so no weak
     * password gets in". What that reasoning missed is the price of the
     * rejection: the refusal costs one of the five password confirmations this
     * account gets per quarter of an hour, the token is taken *before* the
     * server looks at the new password, and the same ration also pays for
     * renaming yourself. So somebody who reacts to "at least 12 characters" the
     * way people do — nine, then ten, then eleven — is told to wait fifteen
     * minutes for having corrected their own typing, and cannot change their
     * username either.
     */
    const demasiadoCorta = passwordLengthError(cuenta.pass);
    if (demasiadoCorta) return toast.warning(demasiadoCorta);
    setConfirmPass(true);
  };

  const pedirEnviarEmail = () => {
    const direccion = emailForm.email.trim();
    if (!direccion) return toast.warning("Debe indicar una dirección de correo.");
    if (!EMAIL_SHAPE.test(direccion)) return toast.warning("Debe indicar una dirección de correo válida.");
    // Same reasoning as `cuenta.userPass` above: an attempt with no password is
    // refused by the server anyway, and letting it leave the browser would spend
    // one of the five confirmations this account gets per quarter of an hour.
    if (!emailForm.pass) return toast.warning("Debe proporcionar su contraseña actual.");
    setConfirmEmail(true);
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

  const abrirCorreo = () => abrir("email");

  return (
    <div className="pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

      <PerfilHeader usuario={d.usuario} loading={d.loading} onCambiarFoto={cambiarFoto} />

      {d.loading ? (
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
            usuario={null} bitacora={[]} eventos={0} emailVerificado={false}
            loading onConfigurarCorreo={abrirCorreo}
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
            read.
          */}
          {!emailVerificado && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <MailWarningIcon className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm m-0 flex-1 min-w-[16rem]">
                {recovery.email
                  ? "Todavía no confirmaste esta dirección: mientras tanto, no sirve para recuperar tu cuenta."
                  : "No tienes un correo de recuperación. Si olvidas tu contraseña, no habrá forma de volver a entrar."}
              </p>
              {editor !== "email" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/30 bg-transparent hover:bg-amber-500/10 text-amber-700 dark:text-amber-500"
                  onClick={abrirCorreo}
                >
                  {recovery.email ? "Verificar ahora" : "Configurar"}
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-6 items-start">
            <div className="space-y-6 min-w-0">
              <PerfilPersonal
                datos={datos}
                editando={editor === "personal"}
                guardando={guardandoPersonal}
                onCampo={(campo, valor) => setDatos((prev) => ({ ...prev, [campo]: valor }))}
                onAbrir={() => abrir("personal")}
                onCancelar={cancelar}
                onGuardar={guardarPersonal}
              />

              <PerfilAcceso
                cuenta={cuenta}
                emailForm={emailForm}
                recovery={recovery}
                abierto={editor === "personal" ? null : editor}
                guardando={{
                  usuario: guardandoUsuario,
                  password: guardandoPassword,
                  email: guardandoEmail,
                }}
                onCuenta={(campo, valor) => setCuenta((prev) => ({ ...prev, [campo]: valor }))}
                onEmailForm={(campo, valor) => setEmailForm((prev) => ({ ...prev, [campo]: valor }))}
                onAbrir={abrir}
                onCancelar={cancelar}
                onGuardarUsuario={pedirGuardarUsuario}
                onGuardarPassword={pedirGuardarPassword}
                onGuardarEmail={pedirEnviarEmail}
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
              eventos={d.eventos.length}
              emailVerificado={emailVerificado}
              loading={false}
              onConfigurarCorreo={abrirCorreo}
            />
          </div>
        </>
      )}

      {/* Confirm: descartar un editor a medias */}
      <AlertDialog open={pendiente !== null} onOpenChange={(o) => !o && setPendiente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. Si abres otra sección, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendiente(null)}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={descartarYSeguir}>Sí, descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: nombre de usuario */}
      <AlertDialog open={confirmUsername} onOpenChange={(o) => !o && setConfirmUsername(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar nombre de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Deberás ingresar al sistema con este nuevo nombre a partir de tu próxima sesión.
              Tu contraseña no cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmUsername(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmUsername(false); guardarUsuario(); }}>Sí, cambiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: contraseña */}
      <AlertDialog open={confirmPass} onOpenChange={(o) => !o && setConfirmPass(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu sesión estará atada a esta nueva clave a partir del siguiente inicio de sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPass(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmPass(false); guardarPassword(); }}
              className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
            >
              Sí, cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: correo de recuperación */}
      <AlertDialog open={confirmEmail} onOpenChange={(o) => !o && setConfirmEmail(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar verificación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un enlace de verificación a esa dirección. Hasta que lo confirmes desde tu
              correo, no podrás usarla para recuperar tu cuenta.
              {emailVerificado && (
                <>
                  {" "}Tu dirección actual, ya verificada, quedará sin verificar y se avisará a esa
                  misma casilla del cambio.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmEmail(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmEmail(false); enviarEmail(); }}>
              Sí, enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
