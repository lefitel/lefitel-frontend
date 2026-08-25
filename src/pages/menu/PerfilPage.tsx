import { useContext, useState, useEffect, useRef } from "react";
import { SesionContext } from "../../context/SesionContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserIcon, KeyIcon, PhoneIcon, FingerprintIcon,
  ShieldCheckIcon, Loader2Icon, SaveIcon, MailIcon, SendIcon,
  MailCheckIcon, MailWarningIcon,
} from "lucide-react";
import { editUsuario, editUserName, editUserPass, searchUsuario } from "../../api/Usuario.api";
import { sendVerificationEmail, verifyEmailToken } from "../../api/Login.api";
import { passwordLengthError } from "../../lib/password";
import { UsuarioInterface } from "../../interfaces/interfaces";

/**
 * The same loose, non-RFC shape check `email.controller.ts` runs server-side
 * (`EMAIL_SHAPE` there). Copied rather than shared — the two repositories
 * cannot import from each other — and kept deliberately loose for the same
 * reason the server's is: this is a cheap filter against an obvious typo, not
 * a security boundary. The server is still the one that decides whether an
 * address is acceptable; this only saves a round trip, a rate-limit charge,
 * and a `pc:<id>` confirmation-budget slot on a string that was never going
 * to pass.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One place to turn a `{status, message}` from `sendVerificationEmail` or
 * `verifyEmailToken` into what the person reads.
 *
 * The 429 branch exists because of a trap specific to this pair of calls: a
 * rate limit reaching this card can come from three different buckets
 * (`passwordConfirmLimiter`, `emailSendLimiter`, or `emailVerifyLimiter` — see
 * `auth.routes.ts`), each with its own wording, and none of that wording says
 * "wait" as plainly as this screen needs it to. Overriding it here rather
 * than showing whichever sentence happened to come back keeps the message
 * this card gives stable even if a limiter's own text changes.
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

const PerfilPage = () => {
  const { sesion, setSesion } = useContext(SesionContext);
  const user = sesion.usuario;

  const [formData, setFormData] = useState({
    name: user.name || "",
    lastname: user.lastname || "",
    phone: "",
    birthday: "",
  });

  /**
   * `userPass` is the current password the *rename* has to carry, and it is a
   * field of its own rather than a reuse of `oldPass` below.
   *
   * They are two forms on one screen. Sharing one value would mean typing the
   * password into the "cambiar contraseña" card and finding the "nombre de
   * usuario" card already filled in — or worse, sending a rename with whatever
   * happened to be left in a box the person had been using for something else.
   */
  const [accountData, setAccountData] = useState({
    user: user.user || "",
    userPass: "",
    oldPass: "",
    pass: "",
    confirmPass: "",
  });

  /**
   * The recovery address as the server currently has it, kept apart from
   * `emailForm` below the same way `accountData.user` is kept apart from the
   * box that renames it: one is "what is saved", the other is "what is being
   * typed". `email: null` and `verifiedAt: null` is the true starting shape —
   * not "no address yet" as an empty string, which would be indistinguishable
   * from somebody who cleared the input by hand.
   *
   * Seeded from nothing here and filled in by the profile-loading effect
   * below, together with `formData`: the whole email card sits behind the
   * same `loadingProfile` skeleton as the rest of this page, so there is no
   * window where it could flash "sin configurar" for an account that has a
   * verified address and just hasn't heard back from the server yet.
   */
  const [recovery, setRecovery] = useState<{ email: string | null; verifiedAt: string | null }>({
    email: null,
    verifiedAt: null,
  });
  const [emailForm, setEmailForm] = useState({ email: "", pass: "" });

  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [confirmGeneral, setConfirmGeneral] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    if (!user.id) return;
    setLoadingProfile(true);
    searchUsuario(user.id)
      .then((data: UsuarioInterface) => {
        setFormData({
          name: data.name || "",
          lastname: data.lastname || "",
          phone: data.phone || "",
          birthday: data.birthday ? String(data.birthday).slice(0, 10) : "",
        });
        setEmailForm((prev) => ({ ...prev, email: data.email ?? "" }));
        setRecovery((prev) => ({
          email: data.email ?? null,
          // `data.email_verified_at ?? prev.verifiedAt`, not a flat overwrite:
          // the hash-verification effect below can resolve *before* this GET
          // does (both fire on mount, and neither request waits for the
          // other), and if this one happened to be reading the database a
          // moment before that UPDATE committed, a flat assignment here would
          // silently put a just-verified address back to "sin verificar" the
          // instant this `.then` ran. Nothing else in this component ever
          // moves `verifiedAt` from a real timestamp back to `null` except
          // `sendEmail` explicitly starting a new verification, so trusting
          // whichever source has already reported "verified" is always safe.
          verifiedAt: data.email_verified_at ?? prev.verifiedAt,
        }));
      })
      .catch(() => toast.error("No se pudieron cargar los datos del perfil."))
      .finally(() => setLoadingProfile(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.id]: e.target.value });
  };

  const handleEmailFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailForm({ ...emailForm, [e.target.id]: e.target.value });
  };

  const saveGeneralInfo = async () => {
    setLoadingGeneral(true);
    try {
      const payload: UsuarioInterface = {
        ...user,
        name: formData.name,
        lastname: formData.lastname,
        phone: formData.phone,
        birthday: formData.birthday as unknown as Date,
      };
      const status = await editUsuario(payload);
      if (status === 200) {
        setSesion((prev) => ({ ...prev, usuario: payload }));
        toast.success("Información general actualizada.");
      } else {
        toast.error("Error al actualizar la información.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingGeneral(false);
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
   * been retired, for exactly this reason. One path: the
   * credential that authorises an operation rides on the request that performs
   * it, the way `editUserPass` beside it always has.
   *
   * The password is left in the box on failure and cleared only on success, so
   * a 429 or a mistyped name does not cost it twice.
   */
  const saveUsername = async () => {
    setLoadingAccount(true);
    try {
      const payload: UsuarioInterface = { ...user, user: accountData.user };
      const response = await editUserName({ ...payload, oldPass: accountData.userPass });
      if (response.status === 200) {
        setSesion((prev) => ({ ...prev, usuario: payload }));
        setAccountData((prev) => ({ ...prev, userPass: "" }));
        toast.success("Nombre de usuario modificado.");
      } else {
        toast.error(response.message || "Error al actualizar el usuario. Podría estar en uso.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingAccount(false);
  };

  const savePassword = async () => {
    setLoadingPass(true);
    try {
      const payload = { ...user, pass: accountData.pass, oldPass: accountData.oldPass };
      const response = await editUserPass(payload);
      if (response.status === 200) {
        toast.success("Contraseña actualizada con éxito.");
        setAccountData({ ...accountData, oldPass: "", pass: "", confirmPass: "" });
      } else {
        toast.error(response.message || "Error al actualizar la contraseña.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingPass(false);
  };

  const handleSaveGeneralClick = () => {
    if (!formData.name || !formData.lastname) {
      return toast.warning("Nombre y apellidos son obligatorios.");
    }
    setConfirmGeneral(true);
  };

  const handleSaveUsernameClick = () => {
    if (!accountData.user) return toast.warning("El nombre de usuario no puede estar vacío");
    // Nothing leaves the browser without it. Not a security check — the server
    // refuses an empty one anyway — but an empty attempt would spend one of the
    // five confirmations the account is allowed in a quarter of an hour.
    if (!accountData.userPass) return toast.warning("Debe confirmar su contraseña actual.");
    setConfirmUsername(true);
  };

  const handleSavePassClick = () => {
    if (!accountData.oldPass) return toast.warning("Debe proporcionar su contraseña actual.");
    if (!accountData.pass || !accountData.confirmPass) return toast.warning("Debe rellenar ambos campos de nueva contraseña.");
    if (accountData.pass !== accountData.confirmPass) return toast.warning("Las contraseñas no coinciden.");
    /**
     * The server's own rule, taken from the one place it lives on this side —
     * `lib/password.ts` — and not a number typed in here.
     *
     * This line said `< 6` while the server demanded twelve, and the gap was
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
    const demasiadoCorta = passwordLengthError(accountData.pass);
    if (demasiadoCorta) return toast.warning(demasiadoCorta);
    setConfirmPass(true);
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
  const sendEmail = async () => {
    setLoadingEmail(true);
    try {
      const direccion = emailForm.email.trim();
      const response = await sendVerificationEmail(direccion, emailForm.pass);
      if (response.status === 200) {
        toast.success(response.message || "Se envió un enlace de verificación.");
        setEmailForm((prev) => ({ ...prev, pass: "" }));
        setRecovery({ email: direccion, verifiedAt: null });
      } else {
        toast.error(describeEmailError(response.status, response.message));
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingEmail(false);
  };

  const handleSendEmailClick = () => {
    const direccion = emailForm.email.trim();
    if (!direccion) return toast.warning("Debe indicar una dirección de correo.");
    if (!EMAIL_SHAPE.test(direccion)) return toast.warning("Debe indicar una dirección de correo válida.");
    // Same reasoning as `accountData.userPass` above: an attempt with no
    // password is refused by the server anyway, and letting it leave the
    // browser would spend one of the five confirmations this account gets
    // per quarter of an hour for nothing.
    if (!emailForm.pass) return toast.warning("Debe proporcionar su contraseña actual.");
    setConfirmEmail(true);
  };

  const emailVerificado = recovery.verifiedAt !== null;
  // Whether the box still reads exactly what the server has on file. Used
  // only to pick the button's label and the confirmation dialog's wording —
  // the request itself is identical either way, see `sendEmail`'s comment.
  const emailSinCambios = emailForm.email.trim() !== "" && emailForm.email.trim() === (recovery.email ?? "");
  // None of these three strings may contain "actualizar": `renombrar()` in
  // `PerfilPage.test.tsx` reaches the username card's own button with
  // `getByRole("button", { name: /actualizar/i })`, unanchored, so a second
  // button whose label merely *contains* that word makes the query ambiguous
  // and throws — same trap as the label text above, different query.
  const emailButtonLabel = !recovery.email
    ? "Verificar correo"
    : !emailVerificado && emailSinCambios
      ? "Reenviar verificación"
      : "Guardar y verificar";

  return (
    <div className="p-6 md:p-8 w-full mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administra tu información personal y credenciales de acceso.
        </p>
      </div>

      {loadingProfile ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {[1, 2, 3].map((j) => <Skeleton key={j} className="h-9 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Columna izquierda */}
          <div className="space-y-6">

            {/* Información Personal */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombres <span className="text-destructive">*</span></Label>
                    <Input id="name" value={formData.name} onChange={handleGeneralChange} placeholder="Ej: Juan" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastname">Apellidos <span className="text-destructive">*</span></Label>
                    <Input id="lastname" value={formData.lastname} onChange={handleGeneralChange} placeholder="Ej: Pérez" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input id="phone" value={formData.phone} onChange={handleGeneralChange} className="pl-8" placeholder="+591 77777777" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Fecha de Nacimiento</Label>
                  <DatePicker
                    value={formData.birthday ? new Date(formData.birthday + "T00:00:00") : undefined}
                    onSelect={(d) => setFormData((prev) => ({ ...prev, birthday: d ? d.toISOString().slice(0, 10) : "" }))}
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button onClick={handleSaveGeneralClick} disabled={loadingGeneral} className="gap-2">
                    {loadingGeneral ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                    Guardar cambios
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Rol */}
            <Card className="shadow-sm border-muted/60 py-0">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                  <ShieldCheckIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Permisos de sistema</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rol asignado a esta cuenta</p>
                </div>
                <Badge variant="outline" className="shrink-0">{user.rol?.name || "Administrador"}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">

            {/* Correo de recuperación */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <MailIcon className="h-4 w-4 text-muted-foreground" />
                    Correo de recuperación
                  </span>
                  {/*
                    The one thing this card exists to make obvious without
                    reading anything else on it: a saved-but-unverified
                    address is exactly as useless as none at all, because
                    `/password/forgot` only ever acts on a verified one. Three
                    states, three unmistakably different badges — colour and
                    text both — rather than one line of fine print under the
                    input that only the careful would read.
                  */}
                  {!recovery.email ? (
                    <Badge variant="outline" className="text-muted-foreground shrink-0 font-normal">
                      Sin configurar
                    </Badge>
                  ) : emailVerificado ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shadow-none shrink-0 gap-1 font-normal">
                      <MailCheckIcon className="h-3 w-3" />
                      Verificado
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none shrink-0 gap-1 font-normal">
                      <MailWarningIcon className="h-3 w-3" />
                      Sin verificar
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {recovery.email && !emailVerificado && (
                  <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                    Todavía no confirmaste esta dirección: mientras tanto, no sirve para recuperar tu cuenta.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Dirección de correo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={emailForm.email}
                    onChange={handleEmailFormChange}
                    placeholder="tu.correo@ejemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se usa únicamente para recuperar tu cuenta si olvidas tu contraseña.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {/*
                    Deliberately not "Confirma tu contraseña" (the username
                    card's own label, a few lines down) or "Contraseña
                    actual" (the password card's): `PerfilPage.test.tsx`
                    already uses `getByLabelText(/confirma tu contraseña/i)`
                    and `getByLabelText(/contraseña actual/i)` to reach those
                    two fields specifically, and `getByLabelText` throws on an
                    ambiguous match rather than picking one. A third field on
                    the same page answering to either phrase would have broken
                    every one of those tests without changing anything they
                    are actually about.
                  */}
                  <Label htmlFor="emailPass">Confirma con tu contraseña <span className="text-destructive">*</span></Label>
                  <Input
                    id="emailPass"
                    type="password"
                    value={emailForm.pass}
                    onChange={(e) => setEmailForm((prev) => ({ ...prev, pass: e.target.value }))}
                    className="font-mono"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-muted-foreground">
                    Registrar o cambiar tu correo de recuperación exige confirmar que eres tú.
                  </p>
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={handleSendEmailClick} disabled={loadingEmail} variant="outline" className="gap-2">
                    {loadingEmail ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                    {emailButtonLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Nombre de usuario */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FingerprintIcon className="h-4 w-4 text-muted-foreground" />
                  Nombre de usuario
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="user">Usuario</Label>
                  <div className="flex gap-2">
                    <Input id="user" value={accountData.user} onChange={handleAccountChange} className="font-mono" />
                    <Button onClick={handleSaveUsernameClick} disabled={loadingAccount} variant="outline" className="shrink-0">
                      {loadingAccount ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Actualizar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Usado en los registros de auditoría y para hacer login.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userPass">Confirma tu contraseña <span className="text-destructive">*</span></Label>
                  <Input id="userPass" type="password" value={accountData.userPass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                  <p className="text-xs text-muted-foreground">
                    Cambiar tu usuario cambia con qué nombre entras, así que hay que confirmar que eres tú.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contraseña */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                  Contraseña
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oldPass">Contraseña actual <span className="text-destructive">*</span></Label>
                  <Input id="oldPass" type="password" value={accountData.oldPass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pass">Nueva contraseña</Label>
                  <Input id="pass" type="password" value={accountData.pass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPass">Confirmar nueva contraseña</Label>
                  <Input id="confirmPass" type="password" value={accountData.confirmPass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">Almacenada con Bcrypt en el servidor.</p>
                  <Button onClick={handleSavePassClick} disabled={loadingPass} variant="destructive" className="gap-2">
                    {loadingPass ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                    Cambiar clave
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Confirm: información general */}
      <AlertDialog open={confirmGeneral} onOpenChange={(o) => !o && setConfirmGeneral(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios serán reflejados inmediatamente en todo el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmGeneral(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmGeneral(false); saveGeneralInfo(); }}>Actualizar</AlertDialogAction>
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
            <AlertDialogAction onClick={() => { setConfirmUsername(false); saveUsername(); }}>Sí, cambiar</AlertDialogAction>
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
              onClick={() => { setConfirmPass(false); savePassword(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
            <AlertDialogAction onClick={() => { setConfirmEmail(false); sendEmail(); }}>
              Sí, enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PerfilPage;
