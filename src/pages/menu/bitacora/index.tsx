import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { SesionContext } from "../../../context/SesionContext";
import { getAllBitacora, BitacoraFilters } from "../../../api/Bitacora.api";
import { getUsuario } from "../../../api/Usuario.api";
import { BitacoraInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Combobox } from "../../../components/ui/combobox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { DatePicker } from "../../../components/ui/date-picker";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import DataTable from "../../../components/table/DataTable";
import { ACTION_LABELS } from "../../../constants/bitacora";

const ENTITIES = ["Evento", "Poste", "Ciudad", "Material", "Propietario", "Obs", "TipoObs", "Solución", "Revisión", "Usuario", "Adss", "Rol", "File"];

const ACTION_PREFIXES = [
  { value: "CREATE",  label: "Crear" },
  { value: "UPDATE",  label: "Actualizar" },
  { value: "DELETE",  label: "Eliminar" },
  { value: "RESTORE", label: "Restaurar" },
  { value: "RESOLVE", label: "Resolver" },
  { value: "REABRIR", label: "Reabrir" },
  { value: "ADD",     label: "Agregar" },
  { value: "LOGIN",   label: "Login" },
  { value: "CHANGE",  label: "Cambiar" },
  { value: "UPLOAD",  label: "Subir archivo" },
];

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ACTION_STYLE: Record<string, { variant: BadgeVariant; className?: string }> = {
  CREATE:   { variant: "default" },
  RESOLVE:  { variant: "outline", className: "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10" },
  UPDATE:   { variant: "secondary" },
  REABRIR:  { variant: "outline", className: "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  DELETE:   { variant: "destructive" },
  RESTORE:  { variant: "outline", className: "border-teal-500/50 text-teal-600 dark:text-teal-400 bg-teal-500/10" },
  ADD:      { variant: "secondary" },
  LOGIN:    { variant: "outline" },
  CHANGE:   { variant: "outline", className: "border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-500/10" },
  UPLOAD:   { variant: "outline", className: "border-violet-500/50 text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  CLEAR:    { variant: "outline", className: "border-sky-500/50 text-sky-600 dark:text-sky-400 bg-sky-500/10" },
};

const actionStyle = (action: string): { variant: BadgeVariant; className?: string } => {
  const prefix = Object.keys(ACTION_STYLE).find((k) => action.startsWith(k));
  return prefix ? ACTION_STYLE[prefix] : { variant: "outline" };
};

const SEVERITY_DOT: Record<string, string> = {
  warning:  "bg-amber-500",
  critical: "bg-destructive",
};

const SEVERITY_LABELS: Record<string, string> = {
  all:      "Todas",
  info:     "Info",
  warning:  "Advertencia",
  critical: "Crítico",
};

const ENTITY_ROUTE: Partial<Record<string, string>> = {
  Poste:   "/app/postes",
  Evento:  "/app/eventos",
  Ciudad:  "/app/ciudades",
  Usuario: "/app/seguridad",
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
        <button className="shrink-0 inline-flex items-center text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
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

const mkDate = (daysAgo: number, endOfDay = false) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 0);
  return d;
};

const DROPDOWN_TRIGGER_CLS =
  "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

const BitacoraPage = () => {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();

  const [usuarios,  setUsuarios]  = useState<UsuarioInterface[]>([]);
  const [from,     setFrom]     = useState<Date | undefined>(() => mkDate(7));
  const [to,       setTo]       = useState<Date | undefined>(() => mkDate(0, true));
  const [entity,   setEntity]   = useState("all");
  const [severity, setSeverity] = useState("all");
  const [action,   setAction]   = useState("all");
  const [userId,   setUserId]   = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [total,    setTotal]    = useState(0);
  const [rows,     setRows]     = useState<BitacoraInterface[] | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    getUsuario(sesion.token).then(setUsuarios).catch(() => {});
  }, [sesion.token]);

  const usuarioOptions = useMemo(() => [
    { value: "all", label: "Todos" },
    ...usuarios.map((u) => ({ value: String(u.id), label: `${u.name} ${u.lastname}` })),
  ], [usuarios]);

  // Refs so the stable fetch fn always reads current values
  const fromRef     = useRef(from);     fromRef.current     = from;
  const toRef       = useRef(to);       toRef.current       = to;
  const entityRef   = useRef(entity);   entityRef.current   = entity;
  const severityRef = useRef(severity); severityRef.current = severity;
  const actionRef   = useRef(action);   actionRef.current   = action;
  const userIdRef   = useRef(userId);   userIdRef.current   = userId;
  const pageSizeRef = useRef(pageSize); pageSizeRef.current = pageSize;

  const doFetch = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    const params: BitacoraFilters = { page: p, limit: ps };
    const f = fromRef.current, t = toRef.current;
    if (f) { const d = new Date(f); d.setHours(0, 0, 0, 0);    params.from = d.toISOString(); }
    if (t) { const d = new Date(t); d.setHours(23, 59, 59, 0); params.to   = d.toISOString(); }
    if (entityRef.current   !== "all") params.entity      = entityRef.current;
    if (severityRef.current !== "all") params.severity    = severityRef.current;
    if (actionRef.current   !== "all") params.action      = actionRef.current;
    if (userIdRef.current   !== "all") params.id_usuario  = Number(userIdRef.current);
    try {
      const r = await getAllBitacora(params, sesion.token);
      setRows(r.data);
      setTotal(r.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [sesion.token]);

  const filtersKey = useMemo(
    () => [from?.toDateString(), to?.toDateString(), entity, severity, action, userId].join("|"),
    [from, to, entity, severity, action, userId]
  );

  useEffect(() => {
    doFetch(1, pageSizeRef.current);
  }, [filtersKey, doFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = useCallback((p: number, ps: number) => {
    setPageSize(ps);
    doFetch(p, ps);
  }, [doFetch]);

  const handleReset = () => {
    setFrom(mkDate(7));
    setTo(mkDate(0, true));
    setEntity("all");
    setSeverity("all");
    setAction("all");
    setUserId("all");
  };

  const columns = useMemo<ColumnDef<BitacoraInterface>[]>(() => [
    {
      id: "num",
      header: "#",
      enableSorting: false,
      cell: ({ row, table }) => {
        const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
        const { pageIndex, pageSize: ps } = table.getState().pagination;
        return <span className="text-xs text-muted-foreground">{pageIndex * ps + visibleIndex + 1}</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleString("es-ES") : "—"}
        </span>
      ),
    },
    {
      id: "usuario",
      header: "Usuario",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {row.original.usuario
            ? `${row.original.usuario.name} ${row.original.usuario.lastname}`
            : `#${row.original.id_usuario}`}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Acción",
      cell: ({ row }) => {
        const { action: act, severity: sev } = row.original;
        const style = actionStyle(act);
        const dot   = sev ? SEVERITY_DOT[sev] : undefined;
        const label = ACTION_LABELS[act] ?? act;
        return (
          <div className="relative inline-flex">
            <Badge variant={style.variant} className={`text-xs ${style.className ?? ""}`}>
              {label}
            </Badge>
            {dot && (
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-background ${dot}`} />
            )}
          </div>
        );
      },
    },
    {
      id: "entidad",
      header: "Entidad",
      cell: ({ row }) => {
        const { entity: ent, entity_id } = row.original;
        const route = ent ? ENTITY_ROUTE[ent] : undefined;
        return route && entity_id ? (
          <button
            className="text-sm text-primary hover:underline whitespace-nowrap"
            onClick={() => navigate(`${route}/${entity_id}`)}
          >
            {ent} #{entity_id}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {ent ?? "—"}{entity_id ? ` #${entity_id}` : ""}
          </span>
        );
      },
    },
    {
      accessorKey: "detail",
      header: "Detalle",
      cell: ({ row }) => {
        const { detail, metadata, ip_address } = row.original;
        const meta    = metadata as Record<string, unknown> | null | undefined;
        const hasMeta = (meta && Object.keys(meta).length > 0) || !!ip_address;
        return (
          <div className="flex items-center gap-1.5">
            {hasMeta && <MetadataPopover metadata={meta ?? {}} ip={ip_address} />}
            <span className="text-sm">{detail}</span>
          </div>
        );
      },
    },
  ], [navigate]);

  return (
    <div className="@container/card pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-3 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bitácora</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro de acciones del sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={loading} className="shrink-0">
          Limpiar filtros
        </Button>
      </div>

      <div className="space-y-2">
        {/* Row 1: Desde, Hasta, Usuario */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <span className="text-xs text-muted-foreground">Desde</span>
            <DatePicker value={from} onSelect={setFrom} placeholder="Desde" className="w-full h-8" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <DatePicker value={to} onSelect={setTo} placeholder="Hasta" className="w-full h-8" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <span className="text-xs text-muted-foreground">Usuario</span>
            <Combobox
              options={usuarioOptions}
              value={userId}
              onValueChange={setUserId}
              placeholder="Todos"
              searchPlaceholder="Buscar usuario..."
              className="h-8"
            />
          </div>
        </div>
        {/* Row 2: Entidad, Acción, Severidad, Limpiar */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <span className="text-xs text-muted-foreground">Entidad</span>
            <DropdownMenu>
              <DropdownMenuTrigger className={DROPDOWN_TRIGGER_CLS}>
                {entity === "all" ? "Todas" : entity}
                <ChevronDownIcon className="size-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuRadioGroup value={entity} onValueChange={setEntity}>
                  <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                  {ENTITIES.map((e) => (
                    <DropdownMenuRadioItem key={e} value={e}>{e}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <span className="text-xs text-muted-foreground">Acción</span>
            <DropdownMenu>
              <DropdownMenuTrigger className={DROPDOWN_TRIGGER_CLS}>
                {ACTION_PREFIXES.find((p) => p.value === action)?.label ?? "Todas"}
                <ChevronDownIcon className="size-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuRadioGroup value={action} onValueChange={setAction}>
                  <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                  {ACTION_PREFIXES.map((p) => (
                    <DropdownMenuRadioItem key={p.value} value={p.value}>{p.label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <span className="text-xs text-muted-foreground">Severidad</span>
            <DropdownMenu>
              <DropdownMenuTrigger className={DROPDOWN_TRIGGER_CLS}>
                {SEVERITY_LABELS[severity] ?? "Todas"}
                <ChevronDownIcon className="size-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-36">
                <DropdownMenuRadioGroup value={severity} onValueChange={setSeverity}>
                  {Object.entries(SEVERITY_LABELS).map(([val, label]) => (
                    <DropdownMenuRadioItem key={val} value={val}>{label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <DataTable
        key={filtersKey}
        data={rows}
        loading={loading}
        columns={columns}
        rowSize="sm"
        hasOptions={false}
        actions={<></>}
        initialPageSize={50}
        serverSide={{
          total,
          onPageChange: handlePageChange,
          onFilterChange: () => {},
        }}
      />
    </div>
  );
};

export default BitacoraPage;
