import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { SesionContext } from "../../../context/SesionContext";
import { getAllBitacora, BitacoraFilters } from "../../../api/Bitacora.api";
import { BitacoraInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { DatePicker } from "../../../components/ui/date-picker";
import { SearchIcon, RotateCcwIcon, ChevronDownIcon } from "lucide-react";
import DataTable from "../../../components/table/DataTable";

const ENTITIES = ["Evento", "Poste", "Ciudad", "Material", "Propietario", "Obs", "TipoObs", "Solucion", "Revicion", "Usuario"];
const LIMIT_OPTIONS = [50, 100, 200, 500];

const actionColor = (action: string) => {
  if (action.startsWith("CREATE")) return "default";
  if (action.startsWith("UPDATE") || action.startsWith("REABRIR")) return "secondary";
  if (action.startsWith("DELETE")) return "destructive";
  return "outline";
};

const BitacoraPage = () => {
  const { sesion } = useContext(SesionContext);
  const [rows, setRows] = useState<BitacoraInterface[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<BitacoraFilters>({ limit: 100 });
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [entity, setEntity] = useState("all");
  const [limitVal, setLimitVal] = useState("100");

  const columns = useMemo<ColumnDef<BitacoraInterface>[]>(() => [
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
          {row.original.usuario ? `${row.original.usuario.name} ${row.original.usuario.lastname}` : `#${row.original.id_usuario}`}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Acción",
      cell: ({ row }) => (
        <Badge variant={actionColor(row.original.action)} className="font-mono text-xs">
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: "entity",
      header: "Entidad",
      cell: ({ row }) => <span className="text-sm">{row.original.entity}</span>,
    },
    {
      accessorKey: "entity_id",
      header: "ID",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.entity_id ?? "—"}</span>,
    },
    {
      accessorKey: "detail",
      header: "Detalle",
      cell: ({ row }) => <span className="text-sm">{row.original.detail}</span>,
    },
  ], []);

  const fetch = useCallback(async () => {
    setLoading(true);
    const active: BitacoraFilters = { ...filters };
    if (from) active.from = from.toISOString();
    if (to) active.to = to.toISOString();
    if (entity && entity !== "all") active.entity = entity;
    const data = await getAllBitacora(active, sesion.token);
    setRows(data);
    setLoading(false);
  }, [filters, from, to, entity, sesion.token]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, limit: Number(limitVal) }));
    fetch();
  };

  const handleReset = () => {
    setFrom(undefined);
    setTo(undefined);
    setEntity("all");
    setLimitVal("100");
    setFilters({ limit: 100 });
    getAllBitacora({ limit: 100 }, sesion.token).then(setRows);
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bitácora</h1>
        <p className="text-sm text-muted-foreground mt-1">Registro de acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Desde</span>
          <DatePicker value={from} onSelect={setFrom} placeholder="Desde" className="w-40 h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <DatePicker value={to} onSelect={setTo} placeholder="Hasta" className="w-40 h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Entidad</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
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
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Límite</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-24 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {limitVal}
              <ChevronDownIcon className="size-4 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-24">
              <DropdownMenuRadioGroup value={limitVal} onValueChange={setLimitVal}>
                {LIMIT_OPTIONS.map((l) => (
                  <DropdownMenuRadioItem key={l} value={String(l)}>{l}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button onClick={handleSearch} disabled={loading}  >
          <SearchIcon className="mr-2 size-4" />
          Buscar
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={loading} size={"icon"} >
          <RotateCcwIcon size={"icon"} />
        </Button>
      </div>

      {/* Table */}
      <DataTable
        data={loading ? null : rows}
        loading={loading}
        columns={columns}
        onRetry={fetch}
        rowSize="sm"
        actions={<></>}
      />
    </div>
  );
};

export default BitacoraPage;
