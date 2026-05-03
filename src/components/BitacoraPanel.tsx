import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SesionContext } from "../context/SesionContext";
import { getAllBitacora } from "../api/Bitacora.api";
import { BitacoraInterface } from "../interfaces/interfaces";
import { ACTION_LABELS } from "../constants/bitacora";
import { Skeleton } from "./ui/skeleton";
import {
  ActivityIcon, AtSignIcon, CheckCircle2Icon, ClockIcon, ImageIcon, InfoIcon,
  KeyRoundIcon, LogInIcon, MapPinIcon, PencilIcon, RotateCcwIcon, ShieldAlertIcon,
  Trash2Icon, UserPlusIcon, WrenchIcon, ZapIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  LOGIN:           { icon: <LogInIcon className="h-3.5 w-3.5 text-primary" />,           bg: "bg-primary/10" },
  CREATE_EVENTO:   { icon: <ZapIcon className="h-3.5 w-3.5 text-amber-600" />,           bg: "bg-amber-500/10" },
  RESOLVE_EVENTO:  { icon: <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />,  bg: "bg-green-500/10" },
  UPDATE_EVENTO:   { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,         bg: "bg-blue-500/10" },
  DELETE_EVENTO:   { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,      bg: "bg-destructive/10" },
  REABRIR_EVENTO:  { icon: <ZapIcon className="h-3.5 w-3.5 text-orange-500" />,          bg: "bg-orange-500/10" },
  ADD_REVISION:    { icon: <ClockIcon className="h-3.5 w-3.5 text-violet-600" />,        bg: "bg-violet-500/10" },
  CREATE_SOLUCION: { icon: <WrenchIcon className="h-3.5 w-3.5 text-primary" />,          bg: "bg-primary/10" },
  CREATE_POSTE:    { icon: <MapPinIcon className="h-3.5 w-3.5 text-emerald-600" />,      bg: "bg-emerald-500/10" },
  DELETE_POSTE:    { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,      bg: "bg-destructive/10" },
  CREATE_USUARIO:  { icon: <UserPlusIcon className="h-3.5 w-3.5 text-primary" />,        bg: "bg-primary/10" },
  DELETE_USUARIO:  { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,      bg: "bg-destructive/10" },
  CHANGE_USERNAME: { icon: <AtSignIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  CHANGE_PASSWORD: { icon: <KeyRoundIcon className="h-3.5 w-3.5 text-orange-500" />,      bg: "bg-orange-500/10" },
  LOGIN_FAILED:    { icon: <ShieldAlertIcon className="h-3.5 w-3.5 text-destructive" />,  bg: "bg-destructive/10" },
  RESTORE_POSTE:   { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,       bg: "bg-teal-500/10" },
  RESTORE_ADSS:    { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,       bg: "bg-teal-500/10" },
  RESTORE_USUARIO: { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,       bg: "bg-teal-500/10" },
  UPDATE_POSTE:        { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  UPDATE_ADSS_POSTE:   { icon: <WrenchIcon className="h-3.5 w-3.5 text-violet-600" />,       bg: "bg-violet-500/10" },
  RESTORE_EVENTO:      { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,      bg: "bg-teal-500/10" },
  UPDATE_OBS_EVENTO:   { icon: <WrenchIcon className="h-3.5 w-3.5 text-violet-600" />,       bg: "bg-violet-500/10" },
  ADD_OBS:             { icon: <ZapIcon className="h-3.5 w-3.5 text-amber-600" />,            bg: "bg-amber-500/10" },
  UPDATE_OBS:          { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_OBS:          { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  UPDATE_SOLUCION:     { icon: <WrenchIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_SOLUCION:     { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  UPDATE_REVISION:     { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_REVISION:     { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  UPDATE_USUARIO:      { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  CREATE_CIUDAD:       { icon: <MapPinIcon className="h-3.5 w-3.5 text-emerald-600" />,       bg: "bg-emerald-500/10" },
  UPDATE_CIUDAD:       { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_CIUDAD:       { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  RESTORE_CIUDAD:      { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,      bg: "bg-teal-500/10" },
  CREATE_MATERIAL:     { icon: <WrenchIcon className="h-3.5 w-3.5 text-emerald-600" />,       bg: "bg-emerald-500/10" },
  UPDATE_MATERIAL:     { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_MATERIAL:     { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  RESTORE_MATERIAL:    { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,      bg: "bg-teal-500/10" },
  CREATE_PROPIETARIO:  { icon: <UserPlusIcon className="h-3.5 w-3.5 text-emerald-600" />,     bg: "bg-emerald-500/10" },
  UPDATE_PROPIETARIO:  { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_PROPIETARIO:  { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  RESTORE_PROPIETARIO: { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,      bg: "bg-teal-500/10" },
  CREATE_ADSS:         { icon: <ZapIcon className="h-3.5 w-3.5 text-emerald-600" />,          bg: "bg-emerald-500/10" },
  UPDATE_ADSS:         { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_ADSS:         { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  CREATE_TIPO_OBS:     { icon: <ZapIcon className="h-3.5 w-3.5 text-emerald-600" />,          bg: "bg-emerald-500/10" },
  UPDATE_TIPO_OBS:     { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_TIPO_OBS:     { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  RESTORE_TIPO_OBS:    { icon: <RotateCcwIcon className="h-3.5 w-3.5 text-teal-600" />,      bg: "bg-teal-500/10" },
  CREATE_ROL:          { icon: <ShieldAlertIcon className="h-3.5 w-3.5 text-emerald-600" />,  bg: "bg-emerald-500/10" },
  UPDATE_ROL:          { icon: <PencilIcon className="h-3.5 w-3.5 text-blue-500" />,          bg: "bg-blue-500/10" },
  DELETE_ROL:          { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  UPLOAD_IMAGE:        { icon: <ImageIcon className="h-3.5 w-3.5 text-violet-600" />,         bg: "bg-violet-500/10" },
  DELETE_FILE:         { icon: <Trash2Icon className="h-3.5 w-3.5 text-destructive" />,       bg: "bg-destructive/10" },
  DEFAULT:             { icon: <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />, bg: "bg-muted" },
};

const SEVERITY_DOT: Record<string, string> = {
  warning:  "bg-amber-500",
  critical: "bg-destructive",
};

const ENTITY_ROUTES: Partial<Record<string, (id: number) => string>> = {
  "Evento":   (id) => `/eventos/${id}`,
  "Revisión": (id) => `/eventos/${id}`,
  "Solución": (id) => `/eventos/${id}`,
  "Poste":    (id) => `/postes/${id}`,
  "Ciudad":   (id) => `/ciudades/${id}`,
};

const fmtVal = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return Array.isArray(v) ? `[${(v as unknown[]).length} elementos]` : "[objeto]";
  const s = String(v);
  return s.length > 50 ? s.slice(0, 47) + "…" : s;
};

const isPrim = (v: unknown) => v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v);
const isRef  = (v: unknown): v is { id: unknown; name: unknown } =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "id" in (v as object) && "name" in (v as object);

function RefCell({ v }: { v: { id: unknown; name: unknown } }) {
  return (
    <span className="flex flex-col leading-tight">
      <span>{String(v.name)}</span>
      <span className="text-[10px] opacity-50">#{String(v.id)}</span>
    </span>
  );
}

function MetadataPopover({ metadata, ip }: { metadata: Record<string, unknown>; ip?: string | null }) {
  const before = metadata.before as Record<string, unknown> | undefined;
  const after  = metadata.after  as Record<string, unknown> | undefined;
  const allKeys = Object.keys(after ?? before ?? {}).filter(k => {
    if (before && after) {
      const bv = before[k], av = after[k];
      return bv !== undefined && bv !== av && (isPrim(bv) || isRef(bv)) && (isPrim(av) || isRef(av));
    }
    const v = (after ?? before)?.[k];
    return isPrim(v) || isRef(v);
  });
  const extras = Object.entries(metadata).filter(([k]) => k !== "before" && k !== "after");
  const hasContent = allKeys.length > 0 || extras.length > 0 || !!ip;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="shrink-0 inline-flex items-center text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors">
          <InfoIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {!hasContent && <p className="text-xs text-muted-foreground">Sin detalles adicionales</p>}
        {allKeys.length > 0 && (
          <div>
            {before && after && (
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                <span>Campo</span><span>Antes</span><span>Después</span>
              </div>
            )}
            <div className="space-y-1.5">
              {allKeys.map(key => {
                const bVal = before?.[key];
                const aVal = after?.[key];
                return before && after ? (
                  <div key={key} className="grid grid-cols-[1fr_1fr_1fr] gap-x-3 text-xs">
                    <span className="font-medium text-foreground/60 truncate">{key}</span>
                    <span className="text-muted-foreground/70 truncate">
                      {isRef(bVal) ? <RefCell v={bVal} /> : fmtVal(bVal)}
                    </span>
                    <span className="text-foreground truncate">
                      {isRef(aVal) ? <RefCell v={aVal} /> : fmtVal(aVal)}
                    </span>
                  </div>
                ) : (
                  <div key={key} className="flex gap-3 text-xs">
                    <span className="font-medium text-foreground/60 w-28 shrink-0 truncate">{key}</span>
                    <span className="text-foreground">
                      {isRef(aVal ?? bVal) ? <RefCell v={(aVal ?? bVal) as { id: unknown; name: unknown }} /> : fmtVal(aVal ?? bVal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {extras.length > 0 && (
          <div className={`space-y-1 ${allKeys.length > 0 ? "mt-3 pt-3 border-t border-border/40" : ""}`}>
            {extras.map(([key, val]) => (
              <div key={key} className="flex gap-3 text-xs">
                <span className="font-medium text-foreground/60 w-28 shrink-0 truncate">{key}</span>
                <span className="text-foreground flex-1 min-w-0 break-all">{fmtVal(val)}</span>
              </div>
            ))}
          </div>
        )}
        {ip && (
          <div className={`text-xs text-muted-foreground/60 ${hasContent && (allKeys.length > 0 || extras.length > 0) ? "mt-3 pt-3 border-t border-border/40" : ""}`}>
            IP: {ip}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  entity: string;
  entityId: number | null | undefined;
}

export default function BitacoraPanel({ entity, entityId }: Props) {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BitacoraInterface[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    getAllBitacora({ entity, entity_id: entityId }, sesion.token)
      .then((r) => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entity, entityId, sesion.token]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Sin actividad registrada en bitácora
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-3 bottom-3 w-px bg-border" />
      <div className="space-y-4">
        {entries.map((entry, i) => {
          const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.DEFAULT;
          const route = ENTITY_ROUTES[entry.entity];
          const severityDot = entry.severity ? SEVERITY_DOT[entry.severity] : undefined;
          return (
            <div key={entry.id ?? i} className="flex gap-4 relative">
              <div className="relative shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 ${config.bg}`}>
                  {config.icon}
                </div>
                {severityDot && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${severityDot}`} />
                )}
              </div>
              <div className="flex-1 py-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(entry.metadata || entry.ip_address) && (
                    <MetadataPopover metadata={(entry.metadata as Record<string, unknown>) ?? {}} ip={entry.ip_address} />
                  )}
                  <p className="text-sm">{entry.detail}</p>
                  {route && entry.entity_id && (
                    <button
                      className="text-xs text-primary hover:underline font-medium"
                      onClick={() => navigate(route!(entry.entity_id!))}
                    >
                      {entry.entity} #{entry.entity_id}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  {entry.usuario && (
                    <span>{entry.usuario.name} {entry.usuario.lastname}</span>
                  )}
                  {entry.usuario && <span className="opacity-40">-</span>}
                  <span className="opacity-40">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString("es-ES")
                    : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
