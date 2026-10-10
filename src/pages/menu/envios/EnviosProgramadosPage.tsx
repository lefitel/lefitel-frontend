import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import type { Col } from "../../../components/table/tableFeatures";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { actualizarProgramacion, listarProgramaciones, type Programacion } from "../../../api/Programacion.api";
import { mensajeDeError } from "../../../api/descarga";
import { cuandoSeEnvia, motivoDePausa, pedidaConActiva } from "../../../lib/envios";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import DataTable from "../../../components/table/DataTable";
import EnvioDialog, { Estado } from "../../../components/dialogs/upsert/EnvioDialog";

/**
 * Scheduled reports: every saved report of the generator that is sent by email
 * on its own, to whom, when it is next due and how the last one went.
 *
 * **What a person sees here is theirs.** Administration sees everybody's — it
 * is the one place to look at everything that leaves the company by mail —
 * and may remove any of them, but only the owner changes a schedule, pauses
 * it or sends it now. The server decides all of this again; the screen only
 * avoids drawing a control whose one outcome would be a refusal.
 */

const dia = (iso: string): string =>
  new Intl.DateTimeFormat("es-BO", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "America/La_Paz",
  }).format(new Date(iso));

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function EnviosProgramadosPage() {
  const { sesion } = useContext(SesionContext);
  const yo = sesion.usuario.id;
  const rol = sesion.usuario.id_rol;
  const puedeProgramar = can(rol, "generador", "programar");
  const modera = can(rol, "seguridad", "editar");

  const [envios, setEnvios] = useState<Programacion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<{ programacion: Programacion | null; informe?: number | null } | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sobre = await listarProgramaciones();
      if (montado.current) setEnvios(sobre.data);
    } catch {
      if (montado.current) {
        setEnvios(null);
        toast.error("No se pudieron cargar los envíos programados");
      }
    } finally {
      if (montado.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * `?informe=7`, which is how the generator will hand a report over to be
   * scheduled. Attended once and taken out of the address, so that closing the
   * form and reloading does not open it again.
   */
  const [parametros, setParametros] = useSearchParams();
  const informePedido = Number(parametros.get("informe")) || null;
  const pedidoAtendido = useRef(false);
  useEffect(() => {
    if (!informePedido || pedidoAtendido.current) return;
    pedidoAtendido.current = true;
    setParametros((actuales) => { actuales.delete("informe"); return actuales; }, { replace: true });
    if (puedeProgramar) setAbierto({ programacion: null, informe: informePedido });
  }, [informePedido, puedeProgramar, setParametros]);

  const alternar = useCallback(async (p: Programacion, activa: boolean) => {
    setCambiando(p.id);
    try {
      await actualizarProgramacion(p.id, pedidaConActiva(p, activa));
      toast.success(activa ? "Envío reactivado" : "Envío en pausa");
      await load();
    } catch (error) {
      const mensaje = mensajeDeError(error, "No se pudo cambiar el envío");
      // Empty when the identity confirmation was cancelled, which already said so.
      if (mensaje) toast.error(mensaje);
    } finally {
      if (montado.current) setCambiando(null);
    }
  }, [load]);

  const columns = useMemo<Col<Programacion>[]>(() => [
    {
      id: "informe",
      accessorFn: (p) => p.informe?.name ?? "",
      header: "Informe",
      cell: ({ row: { original: p } }) => (
        <div className="min-w-0">
          <span className="block font-medium truncate max-w-72">{p.informe?.name ?? "Informe eliminado"}</span>
          <span className="block text-xs text-muted-foreground">
            {p.formato === "excel" ? "Excel" : "PDF"}
            {p.id_usuario !== yo && p.dueno ? ` · de ${`${p.dueno.name ?? ""} ${p.dueno.lastname ?? ""}`.trim()}` : ""}
            {p.informe?.archivado ? " · archivado" : ""}
          </span>
        </div>
      ),
    },
    {
      id: "cuando",
      accessorFn: (p) => cuandoSeEnvia(p),
      header: "Cuándo",
      enableColumnFilter: false,
      cell: ({ row: { original: p } }) => (
        <div className="whitespace-nowrap">
          <span className="block font-medium">{cuandoSeEnvia(p)}</span>
          <span className="block text-xs text-muted-foreground">
            {p.activa && p.proxima_ejecucion ? `Próximo: ${dia(p.proxima_ejecucion)}` : motivoDePausa(p.motivo_pausa)}
          </span>
        </div>
      ),
    },
    {
      id: "destinatarios",
      accessorFn: (p) => p.destinatarios.usuarios.length + p.destinatarios.correos.length,
      header: "Destinatarios",
      enableColumnFilter: false,
      cell: ({ row: { original: p } }) => {
        const externos = p.destinatarios.correos.filter((c) => !c.deBaja).length;
        const usuarios = p.destinatarios.usuarios.length;
        return (
          <div className="whitespace-nowrap">
            <span className="block">{usuarios > 0 ? plural(usuarios, "usuario", "usuarios") : plural(externos, "externo", "externos")}</span>
            {usuarios > 0 && externos > 0 && (
              <span className="block text-xs text-muted-foreground">{plural(externos, "externo", "externos")}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "ultimo",
      accessorFn: (p) => p.ultima?.estado ?? "",
      header: "Último",
      enableColumnFilter: false,
      cell: ({ row: { original: p } }) =>
        p.ultima ? <Estado estado={p.ultima.estado} /> : <span className="text-xs text-muted-foreground">Aún no se ha enviado</span>,
    },
    {
      id: "activa",
      accessorFn: (p) => (p.activa ? 1 : 0),
      header: "Activo",
      enableColumnFilter: false,
      cell: ({ row: { original: p } }) => {
        const mio = p.id_usuario === yo && puedeProgramar;
        return (
          // The switch is its own control: flipping it must not also open the row.
          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
            <Switch
              checked={p.activa}
              disabled={!mio || cambiando === p.id}
              aria-label={`${p.activa ? "Pausar" : "Reactivar"} el envío de ${p.informe?.name ?? "este informe"}`}
              onCheckedChange={(v) => void alternar(p, v)}
            />
          </span>
        );
      },
    },
  ], [yo, puedeProgramar, cambiando, alternar]);

  const activos = envios?.filter((p) => p.activa).length ?? 0;
  const seleccionada = abierto?.programacion ?? null;
  const esMia = seleccionada !== null && seleccionada.id_usuario === yo;

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Envíos programados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {envios === null
            ? "Informes del generador que se envían solos por correo"
            : envios.length === 0
              ? "Ningún informe se envía solo todavía"
              : `${plural(envios.length, "envío", "envíos")} · ${plural(activos, "activo", "activos")}${modera ? " · de todos los usuarios" : ""}`}
        </p>
      </div>

      <DataTable
        data={envios}
        loading={loading}
        columns={columns}
        onRetry={() => void load()}
        onRowClick={(programacion) => setAbierto({ programacion })}
        actions={<>
          <Button variant="outline" size="icon-sm" aria-label="Refrescar" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {puedeProgramar && (
            <Button className="gap-2" aria-label="Nuevo envío" onClick={() => setAbierto({ programacion: null })}>
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo envío</span>
            </Button>
          )}
        </>}
      />

      <EnvioDialog
        open={abierto !== null}
        programacion={seleccionada}
        informeInicial={abierto?.informe ?? null}
        puedeEditar={puedeProgramar && (seleccionada === null || esMia)}
        puedeEliminar={puedeProgramar && seleccionada !== null && (esMia || modera)}
        onClose={() => setAbierto(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
