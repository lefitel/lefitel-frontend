import {
  ActivityIcon, AlertCircleIcon, AtSignIcon, CheckCircle2Icon, ClockIcon,
  DownloadIcon, KeyRoundIcon, LockIcon, LogInIcon, LogOutIcon, MailIcon,
  MapPinIcon, PencilIcon, PlusIcon, RotateCcwIcon, ShieldOffIcon, Trash2Icon,
  UnlockIcon, UserPlusIcon, WrenchIcon, ZapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BitacoraInterface } from "../interfaces/interfaces";

export interface AccionVisual {
  Icon: LucideIcon;
  /** Tailwind text colour for the icon. */
  color: string;
  /** Tailwind background for the disc behind it. */
  bg: string;
}

/**
 * What a bitácora line looks like, decided by rule instead of by list.
 *
 * **Why this is not a lookup table.** `UsuarioDetallePage` carried one, with
 * thirteen entries. The API writes seventy-seven distinct actions. So sixty-four
 * of them — every parameter edited, every report exported, every account locked,
 * every session revoked — came out as the same grey dot, and the table had no
 * way of ever catching up: adding an action server-side is one line there and
 * silence here.
 *
 * Rules instead. The families (`CREATE_`, `UPDATE_`, `DELETE_`, `RESTORE_`)
 * cover most of the seventy-seven by shape, and the named cases below are the
 * ones where the family answer would be wrong or where the line deserves to
 * stand out — the security events, which are the whole reason somebody reads
 * their own bitácora.
 *
 * `severity` from the server wins over both when it says `critical`. That field
 * is the API's own judgement about the line and it is more current than
 * anything guessed from a prefix here.
 */

const rojo = { color: "text-destructive", bg: "bg-destructive/10" };
const ambar = { color: "text-amber-600", bg: "bg-amber-500/10" };
const verde = { color: "text-green-600", bg: "bg-green-500/10" };
const azul = { color: "text-blue-500", bg: "bg-blue-500/10" };
const violeta = { color: "text-violet-600", bg: "bg-violet-500/10" };
const primario = { color: "text-primary", bg: "bg-primary/10" };
const neutro = { color: "text-muted-foreground", bg: "bg-muted" };

/** The lines whose family answer would be wrong, or that should stand out. */
const NOMBRADAS: Record<string, AccionVisual> = {
  LOGIN:                   { Icon: LogInIcon, ...primario },
  LOGIN_FAILED:            { Icon: ShieldOffIcon, ...ambar },
  LOGOUT:                  { Icon: LogOutIcon, ...neutro },
  LOGOUT_ALL:              { Icon: LogOutIcon, ...ambar },
  SESSION_REVOKED:         { Icon: ShieldOffIcon, ...ambar },
  ACCOUNT_LOCKED:          { Icon: LockIcon, ...rojo },
  ACCOUNT_UNLOCKED:        { Icon: UnlockIcon, ...verde },
  CHANGE_PASSWORD:         { Icon: KeyRoundIcon, ...ambar },
  CHANGE_USERNAME:         { Icon: AtSignIcon, ...azul },
  PASSWORD_CONFIRM_FAILED: { Icon: ShieldOffIcon, ...ambar },
  PASSWORD_FORGOT:         { Icon: KeyRoundIcon, ...ambar },
  PASSWORD_RESET:          { Icon: KeyRoundIcon, ...ambar },
  EMAIL_SEND:              { Icon: MailIcon, ...neutro },
  EMAIL_CHANGED:           { Icon: MailIcon, ...azul },
  EMAIL_VERIFIED:          { Icon: MailIcon, ...verde },
  ROLE_CHANGE_DENIED:      { Icon: ShieldOffIcon, ...rojo },

  CREATE_EVENTO:           { Icon: ZapIcon, ...ambar },
  RESOLVE_EVENTO:          { Icon: CheckCircle2Icon, ...verde },
  REABRIR_EVENTO:          { Icon: RotateCcwIcon, ...ambar },
  ADD_REVISION:            { Icon: ClockIcon, ...violeta },
  CREATE_SOLUCION:         { Icon: WrenchIcon, ...primario },
  CREATE_POSTE:            { Icon: MapPinIcon, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  CREATE_USUARIO:          { Icon: UserPlusIcon, ...primario },

  EXPORT_REPORTE:          { Icon: DownloadIcon, ...neutro },
  RUN_REPORTE:             { Icon: ActivityIcon, ...neutro },
};

/** The family rules, applied in order when no named case matched. */
const FAMILIAS: [prefijo: string, visual: AccionVisual][] = [
  ["CREATE_",  { Icon: PlusIcon, ...primario }],
  ["UPDATE_",  { Icon: PencilIcon, ...azul }],
  ["DELETE_",  { Icon: Trash2Icon, ...rojo }],
  ["RESTORE_", { Icon: RotateCcwIcon, ...verde }],
  ["CLEAR_",   { Icon: Trash2Icon, ...ambar }],
];

const POR_DEFECTO: AccionVisual = { Icon: ActivityIcon, ...neutro };

/** What to draw beside one bitácora line. */
export function accionVisual(entry: Pick<BitacoraInterface, "action" | "severity">): AccionVisual {
  if (entry.severity === "critical") {
    return { Icon: AlertCircleIcon, ...rojo };
  }

  const nombrada = NOMBRADAS[entry.action];
  if (nombrada) return nombrada;

  for (const [prefijo, visual] of FAMILIAS) {
    if (entry.action.startsWith(prefijo)) return visual;
  }

  return POR_DEFECTO;
}
