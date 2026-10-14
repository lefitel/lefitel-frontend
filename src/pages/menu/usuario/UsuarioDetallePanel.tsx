import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { BitacoraInterface } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { nombreDeRol } from "../../../lib/roles";
import { enlaceDeFila, nombreDeEntidad } from "../../../constants/bitacora";
import { accionVisual } from "../../../lib/bitacoraAcciones";
import type { UsuarioDetalleData } from "./useUsuarioDetalleData";
import Dato from "../../../components/Dato";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import {
  PencilIcon, KeyRoundIcon, ShieldOffIcon, LockOpenIcon, PhoneIcon, MailIcon,
  CopyIcon, AlertCircleIcon, ChevronRightIcon, ArchiveIcon, AtSignIcon, CakeIcon,
  CalendarIcon, ActivityIcon,
} from "lucide-react";

export type VistaUsuario = "resumen" | "bitacora";

function calcEdad(birthday: Date | string): number {
  return Math.floor((Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

const fecha = (v: Date | string) => new Date(v).toLocaleDateString("es-ES");

interface Props {
  vista: VistaUsuario;
  d: UsuarioDetalleData;
  isOwnProfile: boolean;
  /** Rename, password, profile: this account's own session, or `seguridad.editar`. */
  puedeGestionar: boolean;
  /** Unlock and second-factor reset: `seguridad.editar`, whoever the account is. */
  puedeRescatar: boolean;
  onEditar: () => void;
  onRenombrar: () => void;
  onPassword: () => void;
  onDesbloquear: () => void;
  onRestablecerMfa: () => void;
  /** `seguridad.archivar`, and never on your own account. */
  puedeArchivar: boolean;
  onArchivar: () => void;
}

/**
 * What the card beside the events table holds, one view at a time: the account
 * itself, and its log. Which of the two is showing — and whether a session may
 * open the second — is the page's business.
 */
export default function UsuarioDetallePanel({
  vista, d, isOwnProfile, puedeGestionar, puedeRescatar,
  onEditar, onRenombrar, onPassword, onDesbloquear, onRestablecerMfa,
  puedeArchivar, onArchivar,
}: Props) {
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const [lightboxSrc, setLightboxSrc]   = useState<string | null>(null);
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  // Not while it merely reloads: a save would blank the whole card and draw it
  // again a moment later.
  const cargando = d.loading && !d.usuario;
  const sinCuenta = d.loading || !d.usuario;

  if (vista === "bitacora") {
    return (
      <div>
        <h2 className="px-3 pt-2.5 text-sm font-semibold">Bitácora</h2>
        <p className="px-3 pb-2.5 text-xs text-muted-foreground">
          Lo que hizo esta persona y lo que se le hizo a su cuenta.
        </p>
        <div className="px-3 pb-3">
          {cargando ? (
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
          ) : (
            <>
              {/* Said, not swallowed: without it the list below reads as the
                  whole record, and half of it was never received. */}
              {d.bitacoraIncompleta && (
                <p className="text-xs text-muted-foreground mb-3">
                  No se pudo cargar lo que otros hicieron a esta cuenta. Se muestra solo lo que hizo esta persona.
                </p>
              )}
              {d.bitacora.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin actividad registrada</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-3 bottom-3 w-px bg-border" />
                  <div className="space-y-4">
                    {d.bitacora.map((entry, i) => (
                      <BitacoraRow
                        key={entry.id ?? i}
                        entry={entry}
                        autor={autorAjeno(entry, d.usuario?.id)}
                        enlace={enlaceDeFila(sesion.usuario, entry)}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const pendientes    = d.eventos.filter((e) => !e.state).length;
  const resueltos     = d.eventos.length - pendientes;
  const altaPrioridad = d.eventos.filter((e) => e.priority).length;
  const pctResolucion = d.eventos.length > 0
    ? Math.round((resueltos / d.eventos.length) * 100)
    : 0;
  const ultimoEvento = d.eventos.reduce<number | null>((max, e) => {
    const t = new Date(e.date).getTime();
    return max === null || t > max ? t : max;
  }, null);

  const initials = d.usuario
    ? `${d.usuario.name[0] ?? ""}${d.usuario.lastname[0] ?? ""}`.toUpperCase()
    : "??";

  const copiar = (texto: string, queEs: string) => {
    navigator.clipboard.writeText(texto).then(
      () => toast.success(`${queEs} copiado`),
      () => toast.error("No se pudo copiar"),
    );
  };

  return (
    <>
      {/* The photo on the left and who they are beside it. Centred, with the
          photo above the name, it left half the card's width empty on both
          sides. */}
      <div className="flex items-center gap-3 p-3">
        {cargando ? (
          <>
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </>
        ) : (
          <>
            <Avatar
              className={`h-16 w-16 shrink-0 border-2 border-border shadow${avatarLoaded ? " cursor-zoom-in" : ""}`}
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
            <div className="min-w-0 flex-1">
              {/* Two lines at most: a full name is often longer than what is
                  left beside the photo. */}
              <h1 className="text-lg font-bold tracking-tight leading-tight line-clamp-2 break-words">
                {d.usuario?.name} {d.usuario?.lastname}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-sm text-muted-foreground truncate">@{d.usuario?.user}</span>
                {d.usuario?.rol && (
                  <Badge variant="outline" className="text-xs shrink-0">{nombreDeRol(d.usuario.rol)}</Badge>
                )}
                {isOwnProfile && (
                  <Badge className="text-xs shrink-0 bg-primary/10 text-primary border-primary/20 shadow-none">Tú</Badge>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <section aria-label="Eventos atendidos" className="px-3 pb-3">
        {cargando ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : (
          <div className="rounded-lg bg-muted/60 px-3 py-3">
            <dl className="grid grid-cols-3 text-center">
              <Cifra label="Total" value={d.eventos.length} />
              <Cifra label="Pendientes" value={pendientes} valueClass={pendientes > 0 ? "text-amber-600" : undefined} />
              <Cifra label="Resueltos" value={resueltos} valueClass="text-primary" />
            </dl>
            {/* A share of a whole, so it is drawn as one: as a fourth number
                it sat beside the three it is made of. */}
            <div className="mt-3 flex items-center gap-2.5">
              <div
                role="progressbar"
                aria-label="Resolución"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pctResolucion}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
              >
                <div className="h-full rounded-full bg-primary-fill" style={{ width: `${pctResolucion}%` }} />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {pctResolucion}% resuelto
              </span>
            </div>
            {/* Only when there is one: on most accounts it was a cell that
                said zero. */}
            {altaPrioridad > 0 && (
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500">
                <AlertCircleIcon className="h-3.5 w-3.5" />
                {altaPrioridad} de alta prioridad
              </p>
            )}
          </div>
        )}
      </section>

      {/* What can be done to the account as a whole, on a row of its own:
          under who the person is and what they have attended, and above the
          details. Said in a word: a pencil alone, beside the name, read as
          part of the name. Its full name is still what it is called aloud. */}
      {(puedeGestionar || puedeArchivar) && (
        <div className="flex gap-2 px-3 pb-4">
          {puedeGestionar && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              aria-label="Editar datos"
              title="Editar datos"
              disabled={sinCuenta}
              onClick={onEditar}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          {puedeArchivar && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-destructive hover:text-destructive"
              disabled={sinCuenta}
              onClick={onArchivar}
            >
              <ArchiveIcon className="h-3.5 w-3.5" />
              Archivar
            </Button>
          )}
        </div>
      )}

      {/* Both blocks in the one row the incident's sheet uses: an icon, a small
          label and the value right under it. They were two shapes side by
          side, and in the second the label and its value sat at opposite
          edges of the card. */}
      <section className="px-3 pb-4">
        <h2 className="text-sm font-semibold mb-2">Contacto</h2>
        {cargando ? (
          <FilasEnCarga n={2} />
        ) : (
          <dl className="space-y-2.5">
            {/* Pressing a value uses it — the phone dials, the address opens a
                message — and the button beside it takes it elsewhere. */}
            <Dato
              icon={<PhoneIcon />}
              label="Teléfono"
              accion={d.usuario?.phone
                ? <Copiar label="Copiar teléfono" onClick={() => copiar(d.usuario!.phone, "Teléfono")} />
                : undefined}
            >
              {d.usuario?.phone
                ? <a href={`tel:${d.usuario.phone}`} className="hover:underline underline-offset-2">{d.usuario.phone}</a>
                : <SinDato>Sin teléfono</SinDato>}
            </Dato>
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
            <Dato
              icon={<MailIcon />}
              label="Correo de recuperación"
              sub={d.usuario?.email
                ? d.usuario.email_verified_at
                  ? <span className="text-green-600">Verificado</span>
                  : <span className="text-amber-600">Sin verificar: no sirve para recuperar la cuenta</span>
                : undefined}
              accion={d.usuario?.email
                ? <Copiar label="Copiar correo" onClick={() => copiar(d.usuario!.email!, "Correo")} />
                : undefined}
            >
              {d.usuario?.email
                ? <a href={`mailto:${d.usuario.email}`} title={d.usuario.email} className="hover:underline underline-offset-2">{d.usuario.email}</a>
                : <SinDato>Sin configurar</SinDato>}
            </Dato>
          </dl>
        )}
      </section>

      <section className="px-3 pb-3">
        <h2 className="text-sm font-semibold mb-2">Cuenta</h2>
        {cargando ? (
          <FilasEnCarga n={4} />
        ) : (
          <dl className="space-y-2.5">
            <Dato
              icon={<AtSignIcon />}
              label="Nombre de usuario"
              accion={puedeGestionar ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label="Cambiar usuario"
                  title="Cambiar usuario"
                  disabled={sinCuenta}
                  onClick={onRenombrar}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Button>
              ) : undefined}
            >
              {d.usuario?.user}
            </Dato>
            <Dato icon={<CakeIcon />} label="Fecha de nacimiento">
              {d.usuario?.birthday
                ? `${fecha(d.usuario.birthday)} · ${calcEdad(d.usuario.birthday)} años`
                : undefined}
            </Dato>
            <Dato icon={<CalendarIcon />} label="Miembro desde">
              {d.usuario?.createdAt ? fecha(d.usuario.createdAt) : undefined}
            </Dato>
            <Dato icon={<ActivityIcon />} label="Último evento">
              {ultimoEvento !== null ? fecha(new Date(ultimoEvento)) : <SinDato>Sin actividad</SinDato>}
            </Dato>
          </dl>
        )}
      </section>

      {(puedeGestionar || puedeRescatar) && (
        <>
          {/* Inset, not from edge to edge: a rule across the whole card cut it
              in two. */}
          <div role="separator" className="mx-3 h-px rounded-full bg-border/60" />
          <section className="p-3">
            <h2 className="text-sm font-semibold mb-1.5">Acceso</h2>
            <div className="-mx-2 flex flex-col">
              {puedeGestionar && (
                <Accion icon={<KeyRoundIcon />} disabled={sinCuenta} onClick={onPassword}>
                  Contraseña
                </Accion>
              )}
              {puedeRescatar && (
                <Accion icon={<LockOpenIcon />} disabled={sinCuenta} onClick={onDesbloquear}>
                  Desbloquear cuenta
                </Accion>
              )}
              {/* Never on your own profile: resetting your own second factor is
                  refused by the server (see `resetMfaUsuario`), and a button that
                  exists only to draw a 403 is a promise this screen does not make. */}
              {puedeRescatar && !isOwnProfile && (
                <Accion icon={<ShieldOffIcon />} disabled={sinCuenta} onClick={onRestablecerMfa} destructive>
                  Restablecer 2FA
                </Accion>
              )}
            </div>
          </section>
        </>
      )}

      <ImageLightbox src={lightboxSrc ?? ""} open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}

/**
 * Who did it, when it was not the person whose sheet this is. Every other line
 * is theirs, and saying so fifty times would bury the few that are not.
 *
 * A rescue — a second factor reset, an unlock from the server's console — is
 * written against the account it was done to, on purpose: the console has no
 * account of its own to write it against (`api/src/auth/rescueCore.ts`). Who
 * ran it travels in `metadata.actor`, as the sentence the server composed.
 */
function autorAjeno(entry: BitacoraInterface, idCuenta: number | null | undefined): string | null {
  const actor = entry.metadata?.actor;
  if (typeof actor === "string" && actor) return actor;
  if (entry.id_usuario !== idCuenta && entry.usuario) return `${entry.usuario.name} ${entry.usuario.lastname}`;
  return null;
}

function BitacoraRow({ entry, autor, enlace, navigate }: {
  entry: BitacoraInterface; autor: string | null; enlace: string | null; navigate: (path: string) => void;
}) {
  const { Icon, color, bg } = accionVisual(entry);
  return (
    <div className="flex gap-4 relative">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${bg}`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
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
          {autor && <>{autor} <span className="opacity-40">-</span> </>}
          {entry.createdAt ? new Date(entry.createdAt).toLocaleString("es-ES") : "—"}
        </p>
      </div>
    </div>
  );
}

function Cifra({ label, value, valueClass }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-[11px] text-muted-foreground font-medium leading-tight truncate">{label}</dt>
      <dd className={`text-2xl font-semibold leading-tight tabular-nums ${valueClass ?? ""}`}>{value}</dd>
    </div>
  );
}

/** Where a value would be and is not: said, and said quietly. */
function SinDato({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>;
}

function Copiar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <CopyIcon className="h-3.5 w-3.5" />
    </Button>
  );
}

function FilasEnCarga({ n }: { n: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One thing that can be done to the account's access, on a line of its own. */
function Accion({ icon, children, onClick, disabled, destructive }: {
  icon: React.ReactNode; children: React.ReactNode; onClick: () => void;
  disabled: boolean; destructive?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className={`h-9 w-full justify-start gap-2 px-2 font-medium [&>svg]:h-4 [&>svg]:w-4 ${
        destructive ? "text-destructive hover:text-destructive" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
      <ChevronRightIcon className="ml-auto text-muted-foreground/60" />
    </Button>
  );
}
