import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { BitacoraInterface } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { nombreDeRol } from "../../../lib/roles";
import { enlaceDeFila, nombreDeEntidad } from "../../../constants/bitacora";
import { accionVisual } from "../../../lib/bitacoraAcciones";
import type { UsuarioDetalleData } from "./useUsuarioDetalleData";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { ImageLightbox } from "../../../components/ui/image-viewer";
import { PencilIcon, KeyRoundIcon, ShieldOffIcon, LockOpenIcon } from "lucide-react";

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
}

/**
 * What the card beside the events table holds, one view at a time: the account
 * itself, and its log. Which of the two is showing — and whether a session may
 * open the second — is the page's business.
 */
export default function UsuarioDetallePanel({
  vista, d, isOwnProfile, puedeGestionar, puedeRescatar,
  onEditar, onRenombrar, onPassword, onDesbloquear, onRestablecerMfa,
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

  const correo = !d.usuario?.email
    ? "Sin configurar"
    : d.usuario.email_verified_at
      ? `${d.usuario.email} (verificado)`
      : `${d.usuario.email} (sin verificar)`;

  return (
    <>
      <div className="p-3">
        {cargando ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              className={`h-14 w-14 shrink-0 border-2 border-border shadow${avatarLoaded ? " cursor-zoom-in" : ""}`}
              onClick={avatarLoaded ? () => setLightboxSrc(imageUrl(d.usuario!.image)) : undefined}
            >
              {d.usuario?.image && (
                <AvatarImage
                  src={imageUrl(d.usuario.image) ?? undefined}
                  onLoad={() => setAvatarLoaded(true)}
                  onError={() => setAvatarLoaded(false)}
                />
              )}
              <AvatarFallback className="text-base font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {/* The pencil shows when the pointer is on the name's row, and on
                  focus for the keyboard; a touch screen always has it. */}
              <div className="group/nombre flex items-center gap-1 min-w-0">
                <h1 className="min-w-0 text-lg font-bold tracking-tight leading-tight truncate">
                  {d.usuario?.name} {d.usuario?.lastname}
                </h1>
                {puedeGestionar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground transition-opacity mouse:opacity-0 mouse:group-hover/nombre:opacity-100 mouse:focus-visible:opacity-100"
                    aria-label="Editar datos"
                    title="Editar datos"
                    disabled={sinCuenta}
                    onClick={onEditar}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="text-sm text-muted-foreground truncate">@{d.usuario?.user}</span>
                {d.usuario?.rol?.name && (
                  <Badge variant="outline" className="text-xs shrink-0">{d.usuario.rol.name}</Badge>
                )}
                {isOwnProfile && (
                  <Badge className="text-xs shrink-0 bg-primary/10 text-primary border-primary/20 shadow-none">Tú</Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* No rule above it and no title of its own: what precedes is only the
          person's name, and these are simply the rest of the account. */}
      <section aria-label="Ficha" className="px-3 pb-3">
        {cargando ? (
          <div className="grid grid-cols-6 gap-2 mb-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="col-span-2 h-14 rounded-lg" />)}
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="col-span-3 h-14 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2 mb-3">
            <Celda label="Total eventos" className="col-span-2" value={d.eventos.length} />
            <Celda label="Pendientes" className="col-span-2" value={pendientes}
              valueClass={pendientes > 0 ? "text-amber-600" : undefined} />
            <Celda label="Resueltos" className="col-span-2" value={resueltos} valueClass="text-primary" />
            <Celda label="% Resolución" className="col-span-3" value={`${pctResolucion}%`} />
            <Celda label="Alta prioridad" className="col-span-3" value={altaPrioridad}
              valueClass={altaPrioridad > 0 ? "text-red-500" : undefined} />
          </div>
        )}

        {cargando ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <dl className="space-y-2.5">
            <Row label="Nombre de usuario" value={d.usuario?.user}>
              {puedeGestionar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="-my-1 h-7 w-7 shrink-0 text-muted-foreground"
                  aria-label="Cambiar usuario"
                  title="Cambiar usuario"
                  disabled={sinCuenta}
                  onClick={onRenombrar}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Button>
              )}
            </Row>
            <Row label="Rol" value={d.usuario?.rol ? nombreDeRol(d.usuario.rol) : undefined} />
            <Row label="Teléfono" value={d.usuario?.phone || undefined} />
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
            <Row label="Correo de recuperación" value={correo} />
            <Row
              label="Fecha de nacimiento"
              value={d.usuario?.birthday
                ? `${fecha(d.usuario.birthday)} (${calcEdad(d.usuario.birthday)} años)`
                : undefined}
            />
            <Row label="Miembro desde" value={d.usuario?.createdAt ? fecha(d.usuario.createdAt) : undefined} />
            <Row label="Último evento" value={ultimoEvento !== null ? fecha(new Date(ultimoEvento)) : "Sin actividad"} />
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

function Celda({ label, value, className, valueClass }: {
  label: string; value: number | string; className?: string; valueClass?: string;
}) {
  return (
    <div className={`rounded-lg bg-muted/60 px-2.5 py-2 min-w-0 ${className ?? ""}`}>
      <div className="text-[11px] text-muted-foreground font-medium leading-tight truncate" title={label}>
        {label}
      </div>
      <div className={`text-xl font-semibold leading-tight tabular-nums ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}

/** A line of the account. `children` is what changes it, when something does. */
function Row({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dt className="text-xs text-muted-foreground font-medium shrink-0">{label}</dt>
      <dd className="flex items-center gap-1 min-w-0">
        <span className="text-sm font-medium truncate text-right" title={value ?? undefined}>{value ?? "—"}</span>
        {children}
      </dd>
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
    </Button>
  );
}
