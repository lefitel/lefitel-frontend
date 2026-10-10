import React, { useContext, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Col } from "../../../components/table/tableFeatures";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { EventoInterface } from "../../../interfaces/interfaces";
import {
  editUserName, editUserPass, searchUsuario_user,
  resetMfaUsuario, desbloquearUsuario,
} from "../../../api/Usuario.api";
import { passwordLengthError } from "../../../lib/password";
import { can } from "../../../lib/permissions";
import { imageUrl } from "../../../lib/imageUrl";
import { useUsuarioDetalleData } from "./useUsuarioDetalleData";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import FormDialog from "../../../components/dialogs/FormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import DataTable from "../../../components/table/DataTable";
import UsuarioSheet from "../../../components/dialogs/upsert/UsuarioSheet";
import { nombreDeRol } from "../../../lib/roles";
import {
  CalendarIcon, PhoneIcon, UserIcon, ShieldIcon, MailIcon,
  PencilIcon, RefreshCwIcon, ActivityIcon, CheckCircle2Icon,
  ClockIcon, ZapIcon, KeyRoundIcon, AtSignIcon,
  TrendingUpIcon, AlertCircleIcon, LogInIcon, Trash2Icon,
  WrenchIcon, MapPinIcon, UserPlusIcon, MoreVerticalIcon,
  ShieldOffIcon, LockOpenIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { BitacoraInterface } from "../../../interfaces/interfaces";
import { enlaceDeFila, nombreDeEntidad } from "../../../constants/bitacora";

// ─── Bitácora config ───────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  LOGIN:            { icon: <LogInIcon className="h-3.5 w-3.5 text-primary" />,          bg: "bg-primary/10" },
  CREATE_EVENTO:    { icon: <ZapIcon className="h-3.5 w-3.5 text-amber-600" />,          bg: "bg-amber-500/10" },
  RESOLVE_EVENTO:   { icon: <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />, bg: "bg-green-500/10" },
  UPDATE_EVENTO:    { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,        bg: "bg-blue-500/10" },
  DELETE_EVENTO:    { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,     bg: "bg-destructive/10" },
  ADD_REVISION:     { icon: <ClockIcon className="h-3.5 w-3.5 text-violet-600" />,       bg: "bg-violet-500/10" },
  CREATE_SOLUCION:  { icon: <WrenchIcon className="h-3.5 w-3.5 text-primary" />,         bg: "bg-primary/10" },
  CREATE_POSTE:     { icon: <MapPinIcon className="h-3.5 w-3.5 text-emerald-600" />,     bg: "bg-emerald-500/10" },
  DELETE_POSTE:     { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,     bg: "bg-destructive/10" },
  CREATE_USUARIO:   { icon: <UserPlusIcon className="h-3.5 w-3.5 text-primary" />,       bg: "bg-primary/10" },
  DELETE_USUARIO:   { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,     bg: "bg-destructive/10" },
  CHANGE_USERNAME:  { icon: <AtSignIcon className="h-3.5 w-3.5 text-blue-500" />,        bg: "bg-blue-500/10" },
  CHANGE_PASSWORD:  { icon: <KeyRoundIcon className="h-3.5 w-3.5 text-orange-500" />,    bg: "bg-orange-500/10" },
  DEFAULT:          { icon: <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />, bg: "bg-muted" },
};

function calcEdad(birthday: Date | string): number {
  return Math.floor((Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function UsuarioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  // The same rule the server applies to `/usuario/:id/bitacora`: your own
  // activity always, somebody else's with `bitacora.ver`. Read from the address
  // and not from the loaded account, because the hook needs it before anything
  // has loaded. Without it the sheet does not ask for the log and does not draw
  // the block.
  const verBitacora =
    sesion.usuario.id === Number(id) || can(sesion.usuario.id_rol, "bitacora", "ver");
  const d = useUsuarioDetalleData(Number(id), { verBitacora });

  const [openEdit, setOpenEdit]         = useState(false);
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [openUsername, setOpenUsername] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [openUnlock, setOpenUnlock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [openResetMfa, setOpenResetMfa] = useState(false);
  const [resettingMfa, setResettingMfa] = useState(false);

  // username form
  const [newUser, setNewUser]       = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // password form
  const [oldPass, setOldPass]   = useState("");
  const [newPass, setNewPass]   = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  const pendientes   = d.eventos.filter((e) => !e.state);
  const resueltos    = d.eventos.filter((e) => e.state);
  const altaPrioridad = d.eventos.filter((e) => e.priority);
  const pctResolucion = d.eventos.length > 0
    ? Math.round((resueltos.length / d.eventos.length) * 100)
    : 0;
  const ultimoEvento = d.eventos.length > 0 ? d.eventos[0].date : null;

  const initials = d.usuario
    ? `${d.usuario.name[0] ?? ""}${d.usuario.lastname[0] ?? ""}`.toUpperCase()
    : "??";

  /**
   * Whose account this page is showing, and the only question either credential
   * form asks.
   *
   * `can(rol, "seguridad", "editar")` used to be read here as well, under the
   * name `isAdmin`, and the password form branched on it. It is gone rather
   * than left unused: the permission decides whether this page may act on
   * *somebody else's* account at all, which the server settles on every
   * request, and reading it here only ever produced the wrong answer to "must
   * the current password be typed" — see `handleSavePassword`.
   */
  const isOwnProfile = sesion.usuario.id === d.usuario?.id;

  /** Whether this session may act on somebody else's account at all — the
   * permission the server checks on both rescue routes below. */
  const rol = sesion.usuario.id_rol;
  /**
   * Whether this session may change this account at all: its own, always, and
   * anybody else's with `seguridad.editar`. It is the server's rule for the
   * three writes behind the buttons it guards — rename, password, profile —
   * each of which sits behind `requireSelfOrPermission("seguridad", "editar")`.
   * The screen opens on `seguridad.ver`, and offered all three to somebody who
   * could only look: each one opened its form, took what was typed, and ended
   * in a 403.
   */
  const puedeGestionar = isOwnProfile || can(rol, "seguridad", "editar");

  const handleSaveUsername = async () => {
    if (!newUser.trim()) return toast.warning("El nombre de usuario no puede estar vacío");
    if (!d.usuario?.id) return;
    setSavingUser(true);

    try {
      await searchUsuario_user(newUser.trim());
      toast.warning("Ese nombre de usuario ya está en uso");
      setSavingUser(false);
      return;
    } catch { /* no existe, se puede continuar */ }

    /**
     * The rename carries a name and no credential of its own. The step-up gate
     * in front of `PUT /usuario/username/:id` is what proves who is asking.
     *
     * **What this replaced, three times over.** First this screen called
     * `loginUsuario` and read `auth.status === 500`: that opened a second
     * session, and the rotation on the way in revoked the one this very tab was
     * using; it wrote "Inició sesión" into the bitácora for a login nobody
     * performed; a mistyped password counted as a failed login attempt, so
     * trying a few times here **locked the account out of the ERP**; and the
     * comparison itself was only accidentally right.
     *
     * Then it asked `confirmarPassword` — an endpoint that issued nothing and
     * answered with a field, since retired — and, having been told yes, sent
     * the rename **with no password on it at all**, which is why that gate was
     * worth nothing: `PerfilPage` renamed the same account asking for nothing,
     * and the server accepted it. A confirmation that lives only in the client
     * is optional by definition.
     *
     * Then the password rode along with the change as `oldPass`, and the server
     * compared it. That was right about *where* the check belongs and wrong
     * about how often to ask: the step-up gate was already asking for the same
     * secret on the same request, through its own dialog, so a self-rename
     * prompted twice for one password. Now the gate is the only asker — and it
     * asks once per ten minutes, and takes a recently proved factor instead
     * from an account that has one, which no box on this screen could.
     *
     * **So there is nothing here about `isOwnProfile` any more.** Renaming
     * yourself and renaming somebody else send the identical request; the gate
     * and the permission guard on the route are what tell them apart.
     */
    const res = await editUserName({ ...d.usuario, user: newUser });
    if (res.status === 200) {
      toast.success("Nombre de usuario actualizado");
      setOpenUsername(false);
      setNewUser("");
      d.load();
    } else {
      toast.error(res.message ?? "No se pudo actualizar");
    }
    setSavingUser(false);
  };

  const handleSavePassword = async () => {
    if (!newPass.trim()) return toast.warning("Ingresa la nueva contraseña");
    if (newPass !== newPass2) return toast.warning("Las contraseñas no coinciden");
    /**
     * The length the server demands, checked here because the refusal is not
     * free.
     *
     * This screen validated the length not at all, which was worse than the
     * profile page's stale `6` in one respect: there was no number to be wrong,
     * so a two-character password was pressable. Every such attempt spends one
     * of the five confirmations the account gets per quarter of an hour — the
     * same ration that pays for renaming itself — and it is spent before the
     * server has looked at the password at all.
     *
     * Only the length, and from `lib/password.ts` rather than a digit typed
     * here. The rest of the policy stays the server's, and its sentence is what
     * the toast below shows.
     */
    const demasiadoCorta = passwordLengthError(newPass);
    if (demasiadoCorta) return toast.warning(demasiadoCorta);
    /**
     * The current password is asked for when the account is your own, and the
     * permission has nothing to do with it.
     *
     * **What this replaced.** The condition was `isAdmin`, so anybody who could
     * manage accounts got no field to type it in — their own account included —
     * and the request went out with no password on it. The server agreed, which
     * is the hole: on an unattended machine with an administrator's session
     * open, whoever sits down sets a new password, keeps the session already
     * there and ends every other one in the same write. `updateUserPass`
     * demands it now, so a screen that cannot send it would answer 400 to a
     * request the person has no way of completing.
     *
     * `isOwnProfile` and not `!isAdmin`, which are different questions: the
     * exemption is for resetting *somebody else's* password, because there is
     * none the caller could be expected to know. Exactly the line the rename
     * above already draws, and the same one the server draws — see
     * `requiresOwnPassword` there.
     */
    if (isOwnProfile && !oldPass.trim()) return toast.warning("Ingresa tu contraseña actual");
    if (!d.usuario?.id) return;
    setSavingPass(true);
    const res = await editUserPass(
      { ...d.usuario, pass: newPass, oldPass: isOwnProfile ? oldPass : undefined }
    );
    if (res.status === 200) {
      toast.success("Contraseña actualizada");
      setOpenPassword(false);
      setOldPass(""); setNewPass(""); setNewPass2("");
    } else {
      toast.error(res.message ?? "No se pudo actualizar");
    }
    setSavingPass(false);
  };

  /**
   * A 401 from either rescue route below is left unreported here on purpose.
   *
   * Both routes sit behind the server's step-up gate — see
   * `docs/specs/2026-08-21-autenticacion-mfa-design.md` §8 — which is meant to
   * ask for nothing heavier than a fresh confirmation good for about ten
   * minutes. But `web` does not know that distinction yet: the response
   * interceptor in `SesionProvider.tsx` treats *every* 401 that is not
   * `LOGOUT_URL`'s own as a dead session, and reacts by showing "Tu sesión se
   * cerró. Volvé a iniciar sesión." and calling `logout()` — before this
   * handler's own `.catch` even runs. Adding a second, different message here
   * ("hace falta confirmar de nuevo") would just contradict the one already on
   * screen, and by the time it rendered `logout()` may already have unmounted
   * this page. Building the real fix — a client that can tell a step-up
   * challenge apart from an expired session — is out of scope for these two
   * buttons; see the task's report.
   */
  const handleRescueError = (status: number, message: string | undefined, fallback: string) => {
    if (status === 401) return;
    toast.error(message ?? fallback);
  };

  const handleUnlock = async () => {
    if (!d.usuario?.id) return;
    setUnlocking(true);
    const res = await desbloquearUsuario(d.usuario.id);
    // Cualquier 2xx, y no un número concreto. Desde C4 esta ruta contesta 204
    // en vez de 200, y las dos orillas no se despliegan a la vez: fijar el
    // número nuevo diría «no se pudo desbloquear» sobre una cuenta que el
    // servidor acaba de desbloquear, en la única pantalla cuyo trabajo es
    // rescatar a alguien que no puede entrar. Fijar el viejo diría lo mismo al
    // revés. Un rango no puede equivocarse en ninguna de las dos direcciones.
    if (res.status >= 200 && res.status < 300) {
      toast.success("Cuenta desbloqueada. Ya puede volver a intentar iniciar sesión.");
      setOpenUnlock(false);
      d.load();
    } else {
      handleRescueError(res.status, res.message, "No se pudo desbloquear la cuenta");
    }
    setUnlocking(false);
  };

  const handleResetMfa = async () => {
    if (!d.usuario?.id) return;
    setResettingMfa(true);
    const res = await resetMfaUsuario(d.usuario.id);
    if (res.status === 200) {
      toast.success(
        "Ya puede entrar solo con su contraseña. Avísale: la próxima vez que inicie sesión tendrá que configurar el segundo factor de nuevo."
      );
      setOpenResetMfa(false);
      d.load();
    } else {
      handleRescueError(res.status, res.message, "No se pudo restablecer el segundo factor");
    }
    setResettingMfa(false);
  };

  const columns = useMemo<Col<EventoInterface>[]>(() => [
    {
      accessorKey: "state",
      header: "Estado",
      enableColumnFilter: false,
      cell: ({ row }) => row.original.state
        ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shadow-none">Resuelto</Badge>
        : <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none">Pendiente</Badge>,
    },
    {
      accessorKey: "priority",
      header: "Prioridad",
      enableColumnFilter: false,
      cell: ({ row }) => row.original.priority
        ? <Badge className="bg-red-500/10 text-red-600 border-red-500/20 shadow-none">Alta</Badge>
        : <Badge variant="outline" className="text-muted-foreground shadow-none">Normal</Badge>,
    },
    {
      accessorKey: "description",
      header: "Descripción",
      cell: ({ row }) => (
        <span className="text-sm max-w-64 truncate block">{row.original.description}</span>
      ),
    },
    {
      id: "poste",
      header: "Poste",
      cell: ({ row }) => row.original.poste?.name
        ? (
          <button
            className="text-sm text-primary hover:underline"
            onClick={(e) => { e.stopPropagation(); navigate(`/app/postes/${row.original.id_poste}`); }}
          >
            {row.original.poste.name}
          </button>
        )
        : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      accessorKey: "date",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(row.original.date).toLocaleDateString("es-ES")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
              <MoreVerticalIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => navigate(`/app/eventos/${row.original.id}`)}>
                Ver detalle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [navigate]);

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {d.loading ? (
            <>
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-28" />
              </div>
            </>
          ) : (
            <>
              <Avatar
                className={`h-16 w-16 border-2 border-border shadow${avatarLoaded ? " cursor-zoom-in" : ""}`}
                onClick={avatarLoaded ? () => setLightboxSrc(imageUrl(d.usuario!.image)) : undefined}
              >
                {d.usuario?.image && (
                  <AvatarImage
                    src={imageUrl(d.usuario.image) ?? undefined}
                    onLoad={() => setAvatarLoaded(true)}
                    onError={() => setAvatarLoaded(false)}
                  />
                )}
                <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {d.usuario?.name} {d.usuario?.lastname}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">@{d.usuario?.user}</span>
                  {d.usuario?.rol?.name && (
                    <Badge variant="outline" className="text-xs">{d.usuario.rol.name}</Badge>
                  )}
                  {isOwnProfile && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shadow-none">Tú</Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {puedeGestionar && (
            <Button variant="outline" className="gap-1.5"
              disabled={d.loading || !d.usuario}
              onClick={() => { setNewUser(d.usuario?.user ?? ""); setOpenUsername(true); }}>
              <AtSignIcon className="h-3.5 w-3.5" />
              Cambiar usuario
            </Button>
          )}
          {puedeGestionar && (
            <Button variant="outline" className="gap-1.5"
              disabled={d.loading || !d.usuario}
              onClick={() => setOpenPassword(true)}>
              <KeyRoundIcon className="h-3.5 w-3.5" />
              Contraseña
            </Button>
          )}
          {can(rol, "seguridad", "editar") && (
            <Button variant="outline" className="gap-1.5"
              disabled={d.loading || !d.usuario}
              onClick={() => setOpenUnlock(true)}>
              <LockOpenIcon className="h-3.5 w-3.5" />
              Desbloquear cuenta
            </Button>
          )}
          {/* Never on your own profile: resetting your own second factor is
              refused by the server (see `resetMfaUsuario`), and a button that
              exists only to draw a 403 is a promise this screen does not make. */}
          {can(rol, "seguridad", "editar") && !isOwnProfile && (
            <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive"
              disabled={d.loading || !d.usuario}
              onClick={() => setOpenResetMfa(true)}>
              <ShieldOffIcon className="h-3.5 w-3.5" />
              Restablecer 2FA
            </Button>
          )}
          {puedeGestionar && (
            <Button variant="outline" size="icon" className="h-8 w-8"
              aria-label="Editar datos" title="Editar datos"
              disabled={d.loading || !d.usuario}
              onClick={() => setOpenEdit(true)}>
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8"
            aria-label="Refrescar" title="Refrescar"
            disabled={d.loading} onClick={d.load}>
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard loading={d.loading} label="Total eventos" value={d.eventos.length}
          icon={<ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />} />
        <KpiCard loading={d.loading} label="Pendientes" value={pendientes.length}
          icon={<ClockIcon className="h-3.5 w-3.5 text-amber-600" />}
          valueClass={pendientes.length > 0 ? "text-amber-600" : undefined} />
        <KpiCard loading={d.loading} label="Resueltos" value={resueltos.length}
          icon={<CheckCircle2Icon className="h-3.5 w-3.5 text-primary" />} accent />
        <KpiCard loading={d.loading} label="% Resolución" value={`${pctResolucion}%`}
          icon={<TrendingUpIcon className="h-3.5 w-3.5 text-muted-foreground" />} small />
        <KpiCard loading={d.loading} label="Alta prioridad" value={altaPrioridad.length}
          icon={<AlertCircleIcon className="h-3.5 w-3.5 text-red-500" />}
          valueClass={altaPrioridad.length > 0 ? "text-red-500" : undefined} />
        <KpiCard loading={d.loading} label="Miembro desde"
          value={d.usuario?.createdAt ? new Date(d.usuario.createdAt).toLocaleDateString("es-ES") : "—"}
          icon={<ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />} small />
      </div>

      {/* Perfil */}
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {d.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<UserIcon className="h-4 w-4 text-primary" />} bg="bg-primary/10"
                label="Nombre completo" value={`${d.usuario?.name} ${d.usuario?.lastname}`} />
              <InfoRow icon={<AtSignIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Nombre de usuario" value={d.usuario?.user ?? "—"} />
              <InfoRow icon={<ShieldIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Rol" value={d.usuario?.rol ? nombreDeRol(d.usuario.rol) : "—"} />
              <InfoRow icon={<PhoneIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Teléfono" value={d.usuario?.phone || "—"} />
              {/*
                Read-only, unlike every field beside it: `email` is not on
                `usuario.controller.ts`'s `EDITABLE_FIELDS` whitelist, so this
                admin screen has no way to set it even if a box were added —
                the only write path is the account's own owner, from
                `PerfilPage.tsx`, with their current password. Shown here
                because the API already sends it back (only `pass` is
                excluded from this response) and an administrator looking at
                somebody's account benefits from seeing whether their way
                back in is actually usable — a saved-but-unverified address
                is not, `/password/forgot` ignores it.
              */}
              <InfoRow icon={<MailIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Correo de recuperación"
                value={
                  !d.usuario?.email
                    ? "Sin configurar"
                    : d.usuario.email_verified_at
                      ? `${d.usuario.email} (verificado)`
                      : `${d.usuario.email} (sin verificar)`
                } />
              <InfoRow icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Fecha de nacimiento"
                value={d.usuario?.birthday
                  ? `${new Date(d.usuario.birthday).toLocaleDateString("es-ES")} (${calcEdad(d.usuario.birthday)} años)`
                  : "—"} />
              <InfoRow icon={<ActivityIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Último evento"
                value={ultimoEvento ? new Date(ultimoEvento).toLocaleDateString("es-ES") : "Sin actividad"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eventos */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Eventos atendidos</h2>
          <p className="text-sm text-muted-foreground">Ordenados por prioridad y fecha descendente.</p>
        </div>
        <DataTable
          data={d.loading ? null : d.eventos}
          loading={d.loading}
          columns={columns}
          actions={<></>}
        />
      </div>

      {/* Bitácora */}
      {verBitacora && (
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Actividad reciente</h2>
          <p className="text-sm text-muted-foreground">Últimas 50 acciones registradas del usuario.</p>
        </div>
        <Card className="shadow-sm border-muted/60 py-0">
          <CardContent className="p-5">
            {d.loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-0.5">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            ) : d.bitacora.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin actividad registrada</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-border" />
                <div className="space-y-4">
                  {d.bitacora.map((entry, i) => (
                    <BitacoraRow key={entry.id ?? i} entry={entry} enlace={enlaceDeFila(sesion.usuario, entry)} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <ImageLightbox src={lightboxSrc ?? ""} open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* Sheet: editar datos generales */}
      <UsuarioSheet usuario={d.usuario} open={openEdit} setOpen={setOpenEdit} onSuccess={d.load} />

      {/* Sheet: cambiar nombre de usuario */}
      <FormDialog
        open={openUsername}
        onClose={() => { setOpenUsername(false); setNewUser(""); }}
        size="sm"
        title="Cambiar nombre de usuario"
        description="El usuario utiliza este nombre para iniciar sesión. Al guardar te pediremos confirmar que eres tú."
        dirty={!!newUser.trim()}
        missing={newUser.trim() ? [] : ["Nuevo usuario"]}
        saving={savingUser}
        onSubmit={() => void handleSaveUsername()}
        bodyClassName="flex flex-col gap-4"
      >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-user">Nuevo usuario</Label>
              <Input id="new-user" value={newUser} onChange={(e) => setNewUser(e.target.value)}
                placeholder="ej. jperez" />
            </div>
      </FormDialog>

      {/* Sheet: cambiar contraseña */}
      <FormDialog
        open={openPassword}
        onClose={() => { setOpenPassword(false); setOldPass(""); setNewPass(""); setNewPass2(""); }}
        size="sm"
        title="Cambiar contraseña"
        description={isOwnProfile
          ? "Ingresa la contraseña actual y la nueva."
          : "Como administrador puedes cambiar la contraseña sin necesitar la actual."}
        dirty={!!(oldPass || newPass || newPass2)}
        missing={newPass.trim() ? [] : ["Nueva contraseña"]}
        saving={savingPass}
        submitLabel="Cambiar contraseña"
        onSubmit={() => void handleSavePassword()}
        bodyClassName="flex flex-col gap-4"
      >
            {/* Your own account, and not "whoever lacks the permission" — see
                `handleSavePassword`. Hidden here while the server demanded it
                is a form nobody can submit. */}
            {isOwnProfile && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="old-pass">Contraseña actual</Label>
                <Input id="old-pass" type="password" value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pass">Nueva contraseña</Label>
              <Input id="new-pass" type="password" value={newPass}
                onChange={(e) => setNewPass(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-pass2">Confirmar contraseña</Label>
              <Input id="new-pass2" type="password" value={newPass2}
                onChange={(e) => setNewPass2(e.target.value)} />
              {newPass2 && newPass !== newPass2 && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
      </FormDialog>

      {/* Confirm: desbloquear cuenta */}
      <AlertDialog open={openUnlock} onOpenChange={(v) => { if (!v) setOpenUnlock(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desbloquear la cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{d.usuario?.name} {d.usuario?.lastname}</strong> podrá volver a intentar
              iniciar sesión de inmediato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlocking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={unlocking} onClick={handleUnlock}>
              {unlocking ? "Desbloqueando..." : "Desbloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: restablecer segundo factor */}
      <AlertDialog open={openResetMfa} onOpenChange={(v) => { if (!v) setOpenResetMfa(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restablecer el segundo factor?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{d.usuario?.name} {d.usuario?.lastname}</strong> podrá entrar solo con su
              contraseña de inmediato, y tendrá que configurar el segundo factor otra vez la
              próxima vez que inicie sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingMfa}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              disabled={resettingMfa}
              onClick={handleResetMfa}
            >
              {resettingMfa ? "Restableciendo..." : "Restablecer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function BitacoraRow({ entry, enlace, navigate }: { entry: BitacoraInterface; enlace: string | null; navigate: (path: string) => void }) {
  const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.DEFAULT;
  return (
    <div className="flex gap-4 relative">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${config.bg}`}>
        {config.icon}
      </div>
      <div className="flex-1 py-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm">{entry.detail}</p>
          {enlace && (
            <button
              className="text-xs text-primary hover:underline font-medium"
              onClick={() => navigate(enlace)}
            >
              {nombreDeEntidad(entry)}{entry.entity_id ? ` #${entry.entity_id}` : ""}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {entry.createdAt ? new Date(entry.createdAt).toLocaleString("es-ES") : "—"}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 ${bg} rounded-full shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function KpiCard({ loading, label, value, icon, accent, small, valueClass }: {
  loading: boolean; label: string; value: number | string;
  icon: React.ReactNode; accent?: boolean; small?: boolean; valueClass?: string;
}) {
  return (
    <Card className={`shadow-sm py-0 ${accent ? "border-primary/20" : "border-muted/60"}`}>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          {loading ? <Skeleton className="h-4 w-24" /> : <p className="text-xs text-muted-foreground font-medium">{label}</p>}
          <div className={`p-2 rounded-full shrink-0 ${accent ? "bg-primary/10" : "bg-muted"}`}>{icon}</div>
        </div>
        {loading
          ? <Skeleton className="h-10 w-14" />
          : <div className={`${small ? "text-2xl" : "text-4xl"} font-bold tracking-tight ${accent ? "text-primary" : ""} ${valueClass ?? ""}`}>{value}</div>
        }
      </CardContent>
    </Card>
  );
}
