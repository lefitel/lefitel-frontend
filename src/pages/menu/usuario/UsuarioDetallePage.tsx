import React, { useContext, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { EventoInterface } from "../../../interfaces/interfaces";
import { editUserName, editUserPass, searchUsuario_user } from "../../../api/Usuario.api";
import { loginUsuario } from "../../../api/Login.api";
import { url } from "../../../api/url";
import { useUsuarioDetalleData } from "./useUsuarioDetalleData";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../../../components/ui/sheet";
import DataTable from "../../../components/table/DataTable";
import UsuarioSheet from "../../../components/dialogs/upsert/UsuarioSheet";
import {
  CalendarIcon, PhoneIcon, UserIcon, ShieldIcon,
  PencilIcon, RefreshCwIcon, ActivityIcon, CheckCircle2Icon,
  ClockIcon, ZapIcon, KeyRoundIcon, AtSignIcon,
  TrendingUpIcon, AlertCircleIcon, LogInIcon, Trash2Icon,
  WrenchIcon, MapPinIcon, UserPlusIcon, MoreVerticalIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { BitacoraInterface } from "../../../interfaces/interfaces";

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

const ENTITY_ROUTES: Partial<Record<string, (id: number) => string>> = {
  "Evento":   (id) => `/eventos/${id}`,
  "Revisión": (id) => `/eventos/${id}`,
  "Solución": (id) => `/eventos/${id}`,
  "Poste":    (id) => `/postes/${id}`,
};

function calcEdad(birthday: Date | string): number {
  return Math.floor((Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function UsuarioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const d = useUsuarioDetalleData(Number(id));

  const [openEdit, setOpenEdit]         = useState(false);
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [openUsername, setOpenUsername] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);

  // username form
  const [newUser, setNewUser]       = useState("");
  const [currentPassUser, setCurrentPassUser] = useState("");
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

  const isOwnProfile = sesion.usuario.id === d.usuario?.id;
  const rol     = sesion.usuario.id_rol;
  const isAdmin = can(rol, "seguridad", "editar");

  const handleSaveUsername = async () => {
    if (!newUser.trim()) return toast.warning("El nombre de usuario no puede estar vacío");
    if (!d.usuario?.id) return;
    if (isOwnProfile && !currentPassUser.trim()) return toast.warning("Ingresa tu contraseña actual para confirmar");

    setSavingUser(true);

    if (isOwnProfile) {
      const auth = await loginUsuario({ ...sesion.usuario, pass: currentPassUser });
      if (auth.status === 500) {
        toast.error(auth.message ?? "Contraseña incorrecta");
        setSavingUser(false);
        return;
      }
    }

    try {
      await searchUsuario_user(newUser.trim(), sesion.token);
      toast.warning("Ese nombre de usuario ya está en uso");
      setSavingUser(false);
      return;
    } catch { /* no existe, se puede continuar */ }

    const res = await editUserName({ ...d.usuario, user: newUser }, sesion.token);
    if (res.status === 200) {
      toast.success("Nombre de usuario actualizado");
      setOpenUsername(false);
      setNewUser("");
      setCurrentPassUser("");
      d.load();
    } else {
      toast.error(res.message ?? "No se pudo actualizar");
    }
    setSavingUser(false);
  };

  const handleSavePassword = async () => {
    if (!newPass.trim()) return toast.warning("Ingresa la nueva contraseña");
    if (newPass !== newPass2) return toast.warning("Las contraseñas no coinciden");
    if (!isAdmin && !oldPass.trim()) return toast.warning("Ingresa tu contraseña actual");
    if (!d.usuario?.id) return;
    setSavingPass(true);
    const res = await editUserPass(
      { ...d.usuario, pass: newPass, oldPass: isAdmin ? undefined : oldPass },
      sesion.token
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

  const columns = useMemo<ColumnDef<EventoInterface>[]>(() => [
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
    <div className="@container/card pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-6 animate-in fade-in duration-500">

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
                onClick={avatarLoaded ? () => setLightboxSrc(url + d.usuario!.image) : undefined}
              >
                {d.usuario?.image && (
                  <AvatarImage
                    src={url + d.usuario.image}
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
          <Button variant="outline" className="gap-1.5"
            disabled={d.loading || !d.usuario}
            onClick={() => { setNewUser(d.usuario?.user ?? ""); setOpenUsername(true); }}>
            <AtSignIcon className="h-3.5 w-3.5" />
            Cambiar usuario
          </Button>
          <Button variant="outline" className="gap-1.5"
            disabled={d.loading || !d.usuario}
            onClick={() => setOpenPassword(true)}>
            <KeyRoundIcon className="h-3.5 w-3.5" />
            Contraseña
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            disabled={d.loading || !d.usuario}
            onClick={() => setOpenEdit(true)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
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
                label="Rol" value={d.usuario?.rol?.name ?? "—"} />
              <InfoRow icon={<PhoneIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted"
                label="Teléfono" value={d.usuario?.phone || "—"} />
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
                    <BitacoraRow key={entry.id ?? i} entry={entry} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ImageLightbox src={lightboxSrc ?? ""} open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* Sheet: editar datos generales */}
      <UsuarioSheet usuario={d.usuario} open={openEdit} setOpen={setOpenEdit} onSuccess={d.load} />

      {/* Sheet: cambiar nombre de usuario */}
      <Sheet open={openUsername} onOpenChange={(v) => { if (!v) { setOpenUsername(false); setNewUser(""); setCurrentPassUser(""); } }}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Cambiar nombre de usuario</SheetTitle>
            <SheetDescription>El usuario utiliza este nombre para iniciar sesión.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-user">Nuevo usuario</Label>
              <Input id="new-user" value={newUser} onChange={(e) => setNewUser(e.target.value)}
                placeholder="ej. jperez" />
            </div>
            {isOwnProfile && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cu-pass">Contraseña actual</Label>
                <Input id="cu-pass" type="password" value={currentPassUser}
                  onChange={(e) => setCurrentPassUser(e.target.value)} />
              </div>
            )}
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setOpenUsername(false)} disabled={savingUser}>Cancelar</Button>
            <Button onClick={handleSaveUsername} disabled={savingUser}>
              {savingUser ? "Guardando..." : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet: cambiar contraseña */}
      <Sheet open={openPassword} onOpenChange={(v) => {
        if (!v) { setOpenPassword(false); setOldPass(""); setNewPass(""); setNewPass2(""); }
      }}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Cambiar contraseña</SheetTitle>
            <SheetDescription>
              {isAdmin
                ? "Como administrador puedes cambiar la contraseña sin necesitar la actual."
                : "Ingresa la contraseña actual y la nueva."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-6">
            {!isAdmin && (
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
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setOpenPassword(false)} disabled={savingPass}>Cancelar</Button>
            <Button onClick={handleSavePassword} disabled={savingPass}>
              {savingPass ? "Guardando..." : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}

function BitacoraRow({ entry, navigate }: { entry: BitacoraInterface; navigate: (path: string) => void }) {
  const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.DEFAULT;
  const route = ENTITY_ROUTES[entry.entity];
  return (
    <div className="flex gap-4 relative">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${config.bg}`}>
        {config.icon}
      </div>
      <div className="flex-1 py-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm">{entry.detail}</p>
          {route && entry.entity_id && (
            <button
              className="text-xs text-primary hover:underline font-medium"
              onClick={() => navigate(route(entry.entity_id!))}
            >
              {entry.entity} #{entry.entity_id}
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
