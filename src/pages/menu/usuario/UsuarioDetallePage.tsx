import { useContext, useMemo, useState } from "react";
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
import { useUsuarioDetalleData } from "./useUsuarioDetalleData";
import UsuarioDetallePanel, { type VistaUsuario } from "./UsuarioDetallePanel";
import PanelRail, { type PanelRailItem } from "../../../components/PanelRail";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import FormDialog from "../../../components/dialogs/FormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import DataTable from "../../../components/table/DataTable";
import UsuarioSheet from "../../../components/dialogs/upsert/UsuarioSheet";
import { HistoryIcon, LayoutListIcon, MoreVerticalIcon } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

const VISTA_PANEL_ID = "usuario-vista-panel";
const vistaTabId = (vista: VistaUsuario) => `usuario-vista-tab-${vista}`;

export default function UsuarioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  // The same rule the server applies to `/usuario/:id/bitacora`: your own
  // activity always, somebody else's with `bitacora.ver`. Read from the address
  // and not from the loaded account, because the hook needs it before anything
  // has loaded. Without it the sheet does not ask for the log and does not offer
  // the view.
  const verBitacora =
    sesion.usuario.id === Number(id) || can(sesion.usuario.id_rol, "bitacora", "ver");
  const d = useUsuarioDetalleData(Number(id), {
    verBitacora,
    // What others did to the account comes from the general log, which makes no
    // exception for your own record.
    verBitacoraCuenta: can(sesion.usuario.id_rol, "bitacora", "ver"),
  });

  const [vista, setVista] = useState<VistaUsuario>("resumen");

  const vistas: PanelRailItem<VistaUsuario>[] = [
    { value: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    ...(verBitacora
      ? [{ value: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  const [openEdit, setOpenEdit]         = useState(false);
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
    // The same shape as the pole's, the incident's and the city's sheets. Two
    // columns and a rail from `lg` up: the page takes exactly the height the
    // shell leaves it, the events table fills its column, and the panel beside
    // it scrolls on its own. What the panel holds is chosen on the rail. Below
    // `lg` they stack, the person first and what they attended after.
    <div className="w-full p-page grid grid-cols-1 gap-page lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_24rem_auto] lg:grid-rows-[minmax(0,1fr)] animate-in fade-in duration-500">

      <Card className="order-3 lg:order-1 shadow-sm border-muted/60 py-0 gap-0 block min-h-0 min-w-0 lg:overflow-y-auto">
        <div className="p-3 space-y-3">
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
      </Card>

      {/* One card for the whole panel, and nothing lifted inside it. `block`
          rather than the card's own column: a flex column of a fixed height
          would squeeze its parts instead of letting the panel scroll. */}
      <Card
        id={VISTA_PANEL_ID}
        role="tabpanel"
        aria-labelledby={vistaTabId(vista)}
        className="order-2 shadow-sm border-muted/60 py-0 gap-0 block min-h-0 lg:overflow-y-auto"
      >
        <UsuarioDetallePanel
          vista={vista}
          d={d}
          isOwnProfile={isOwnProfile}
          puedeGestionar={puedeGestionar}
          puedeRescatar={can(rol, "seguridad", "editar")}
          onEditar={() => setOpenEdit(true)}
          onRenombrar={() => { setNewUser(d.usuario?.user ?? ""); setOpenUsername(true); }}
          onPassword={() => setOpenPassword(true)}
          onDesbloquear={() => setOpenUnlock(true)}
          onRestablecerMfa={() => setOpenResetMfa(true)}
        />
      </Card>

      <div className="order-1 lg:order-3 min-w-0">
        <PanelRail
          label="Vistas del usuario"
          items={vistas}
          value={vista}
          onChange={setVista}
          panelId={VISTA_PANEL_ID}
          tabId={vistaTabId}
        />
      </div>


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
