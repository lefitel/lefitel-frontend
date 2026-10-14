import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import type { Col } from "../../../components/table/tableFeatures";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import {
  actualizarProgramacion,
  listarHistorial,
  listarProgramaciones,
  type EjecucionDelHistorial,
  type EstadoDeEjecucion,
  type Programacion,
} from "../../../api/Programacion.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  ESTADO_DE_EJECUCION,
  cuandoSeEnvia,
  detalleDeEjecucion,
  etiquetaDeFormato,
  fechaYHora,
  motivoDePausa,
  pedidaConActiva,
} from "../../../lib/envios";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { HeaderSlot } from "../../../components/HeaderSlot";
import DataTable from "../../../components/table/DataTable";
import { Estado } from "../../../components/EstadoDeEjecucion";
import EnvioDialog from "../../../components/dialogs/upsert/EnvioDialog";
import EntregadosDeEjecucion from "./EntregadosDeEjecucion";

/**
 * Scheduled reports: every saved report of the generator that is sent by email
 * on its own, to whom, when it is next due and how the last one went.
 *
 * **What a person sees here is theirs.** Administration sees everybody's — it
 * is the one place to look at everything that leaves the company by mail —
 * and may remove any of them, but only the owner changes a schedule, pauses
 * it or sends it now. The server decides all of this again; the screen only
 * avoids drawing a control whose one outcome would be a refusal.
 *
 * **Two tabs.** «Envíos» is the schedules; «Historial» is every run of every
 * schedule the viewer may see, newest first, paged and filtered by the server.
 * The history is asked for when its tab is first opened and not before.
 */

const dia = (iso: string): string =>
  new Intl.DateTimeFormat("es-BO", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "America/La_Paz",
  }).format(new Date(iso));

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Pestana = "envios" | "historial";

/** Rows per page of the history until the person picks another size. */
const POR_PAGINA = 15;

/**
 * What the server is being asked for. A filter that is off is `undefined`;
 * `listarHistorial` is what keeps it out of the request.
 */
interface ConsultaDelHistorial {
  page: number;
  limit: number;
  estado?: EstadoDeEjecucion;
  id_programacion?: number;
}

/** The page of runs on screen, with the filters it was asked under: what says why it is empty. */
interface HistorialCargado {
  filas: EjecucionDelHistorial[];
  total: number;
  estado?: EstadoDeEjecucion;
  id_programacion?: number;
}

/** The word of "no filter" in both menus. */
const TODOS = "todos";

export default function EnviosProgramadosPage() {
  const { sesion } = useContext(SesionContext);
  const yo = sesion.usuario.id;
  const rol = sesion.usuario.id_rol;
  const puedeProgramar = can(rol, "generador", "programar");
  const modera = can(rol, "seguridad", "editar");

  const [pestana, setPestana] = useState<Pestana>("envios");
  const [envios, setEnvios] = useState<Programacion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<{ programacion: Programacion | null; informe?: number | null } | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  // Raised on every mount, not only declared `true`: in development React
  // mounts, unmounts and mounts each screen again, and a flag the cleanup
  // lowers and nothing raises back leaves the page throwing its own answers
  // away — the list arrived and the skeleton stayed for ever.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

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

  // ─── The history of every schedule ─────────────────────────────────────────
  //
  // Asked for the first time when its tab is first opened, and not before: most
  // visits to this screen are to look at the schedules.
  const [historial, setHistorial] = useState<HistorialCargado | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  /**
   * The last request failed. The table is not put in its error state for this:
   * that state replaces the whole table, action bar included, and here the
   * action bar is the filters — the one thing the person may need to change
   * after a request fails. So a failure is an empty table under the same
   * controls, with the sentence and the retry above it.
   */
  const [fallo, setFallo] = useState(false);
  const [resultado, setResultado] = useState<string>(TODOS);
  const [envioElegido, setEnvioElegido] = useState<string>(TODOS);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(POR_PAGINA);
  const historialPedido = useRef(false);
  /** What the server was last asked for. A ref: `cargarHistorial` has to stay the same function to be a safe `onRetry`. */
  const consulta = useRef<ConsultaDelHistorial>({ page: 1, limit: POR_PAGINA });
  /**
   * Which request is the latest. Every request takes a number, and only the one
   * holding the latest number may write its answer: a slow answer for page 2
   * arriving after the one for page 3 — or for the previous filter — must not
   * put the older rows back under the newer controls.
   */
  const pregunta = useRef(0);

  const cargarHistorial = useCallback(async (cambios: Partial<ConsultaDelHistorial> = {}) => {
    const q = { ...consulta.current, ...cambios };
    consulta.current = q;
    const esta = ++pregunta.current;
    setCargandoHistorial(true);
    try {
      const sobre = await listarHistorial(q);
      if (montado.current && esta === pregunta.current) {
        setHistorial({ filas: sobre.data, total: sobre.total, estado: q.estado, id_programacion: q.id_programacion });
        setFallo(false);
      }
    } catch {
      if (montado.current && esta === pregunta.current) {
        // No rows: the ones on screen belong to filters that are no longer the controls'.
        setHistorial({ filas: [], total: 0, estado: q.estado, id_programacion: q.id_programacion });
        setFallo(true);
        toast.error("No se pudo cargar el historial de envíos");
      }
    } finally {
      if (montado.current && esta === pregunta.current) setCargandoHistorial(false);
    }
  }, []);

  const cambiarPestana = (valor: string) => {
    const siguiente = valor as Pestana;
    setPestana(siguiente);
    if (siguiente === "historial" && !historialPedido.current) {
      historialPedido.current = true;
      void cargarHistorial();
    }
  };

  /** A filter changed: the first page of what it now asks for. */
  const filtrar = (cambios: { estado?: EstadoDeEjecucion; id_programacion?: number }) => {
    setPagina(1);
    void cargarHistorial({ page: 1, ...cambios });
  };

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
            {etiquetaDeFormato(p.formato)}
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

  const columnasDelHistorial = useMemo<Col<EjecucionDelHistorial>[]>(() => [
    {
      id: "tocaba",
      accessorFn: (e) => e.programada_para,
      header: "Tocaba",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row: { original: e } }) => (
        <div className="whitespace-nowrap">
          <span className="block font-medium tabular-nums">{fechaYHora(e.programada_para)}</span>
          {e.manual && <span className="block text-xs text-muted-foreground">Envío manual</span>}
        </div>
      ),
    },
    {
      id: "informe",
      accessorFn: (e) => e.programacion.informe?.name ?? "",
      header: "Informe",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row: { original: e } }) => {
        const { programacion: p } = e;
        // Somebody else's schedule is only ever on screen for administration.
        const dueno = modera && p.dueno && p.dueno.id !== yo ? `de ${`${p.dueno.name ?? ""} ${p.dueno.lastname ?? ""}`.trim()}` : null;
        return (
          <div className="min-w-0">
            <span className="block font-medium truncate max-w-72">{p.informe?.name ?? "Informe eliminado"}</span>
            <span className="block text-xs text-muted-foreground">
              {[etiquetaDeFormato(p.formato), p.eliminada ? "Envío eliminado" : null, dueno].filter(Boolean).join(" · ")}
            </span>
          </div>
        );
      },
    },
    {
      id: "resultado",
      accessorFn: (e) => e.estado,
      header: "Resultado",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row: { original: e } }) => {
        const detalle = detalleDeEjecucion(e);
        return (
          <div>
            <Estado estado={e.estado} />
            {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
          </div>
        );
      },
    },
    {
      id: "entregados",
      accessorFn: (e) => e.enviados,
      header: "Entregados",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row: { original: e } }) => <EntregadosDeEjecucion key={e.id} ejecucion={e} />,
    },
  ], [yo, modera]);

  /**
   * The schedules the "Envío" filter can name: the ones this screen already
   * has, so no request of its own. A schedule that has since been removed is not
   * among them; if one was chosen before it went, it stays in the menu under a
   * word that says what happened to it instead of leaving the control blank —
   * or, when the list itself failed to load and so says nothing about it, under
   * its number.
   */
  const opcionesDeEnvio = useMemo(() => {
    const opciones = (envios ?? []).map((p) => ({
      value: String(p.id),
      label: [
        p.informe?.name ?? "Informe eliminado",
        cuandoSeEnvia(p),
        modera && p.id_usuario !== yo && p.dueno ? `de ${`${p.dueno.name ?? ""} ${p.dueno.lastname ?? ""}`.trim()}` : null,
      ].filter(Boolean).join(" · "),
    }));
    if (envioElegido !== TODOS && !opciones.some((o) => o.value === envioElegido)) {
      // Only a list that did load can say the schedule is gone; without one it is just a number.
      opciones.push({ value: envioElegido, label: envios === null ? `Envío #${envioElegido}` : "Envío eliminado" });
    }
    return opciones;
  }, [envios, envioElegido, modera, yo]);

  const seleccionada = abierto?.programacion ?? null;
  const esMia = seleccionada !== null && seleccionada.id_usuario === yo;

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
      <h1 className="sr-only">Envíos programados</h1>
      <HeaderSlot>
        <Tabs value={pestana} onValueChange={cambiarPestana} className="shrink-0">
          <TabsList size="sm">
            <TabsTrigger value="envios">Envíos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        </Tabs>
      </HeaderSlot>

      {pestana === "envios" && (
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
      )}

      {pestana === "historial" && fallo && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-2 text-sm text-muted-foreground">
          <span>No se pudo cargar el historial de envíos.</span>
          <Button variant="outline" size="sm" onClick={() => void cargarHistorial()} disabled={cargandoHistorial}>
            Reintentar
          </Button>
        </div>
      )}

      {pestana === "historial" && (
        <DataTable
          // Remounted when a filter changes, so that the table is on page one
          // along with the request: it keeps its own page number, and this is
          // the way the Bitácora hands it back to the start as well.
          key={`${resultado}|${envioElegido}`}
          data={historial?.filas ?? null}
          loading={cargandoHistorial}
          columns={columnasDelHistorial}
          hasColumnFilter={false}
          emptyMessage={fallo
            ? "—"
            : historial && (historial.estado || historial.id_programacion)
              ? "Ningún envío con ese filtro."
              : "Todavía no se ha enviado nada."}
          initialPage={pagina}
          initialPageSize={porPagina}
          // A run opens the dialog of its schedule when there is one to open:
          // it still exists and this screen has it.
          isRowClickable={(e) => !e.programacion.eliminada && (envios ?? []).some((p) => p.id === e.id_programacion)}
          onRowClick={(e) => {
            const programacion = (envios ?? []).find((p) => p.id === e.id_programacion);
            if (programacion) setAbierto({ programacion });
          }}
          serverSide={{
            total: historial?.total ?? 0,
            onPageChange: (page, limit) => {
              setPagina(page);
              setPorPagina(limit);
              void cargarHistorial({ page, limit });
            },
            onFilterChange: () => {},
          }}
          actions={<>
            <Select
              value={resultado}
              onValueChange={(valor) => {
                setResultado(valor);
                filtrar({ estado: valor === TODOS ? undefined : (valor as EstadoDeEjecucion) });
              }}
            >
              <SelectTrigger aria-label="Resultado" className="h-8 w-40">
                {/* The trigger names the filter while it is off, and the choice once it is on. */}
                <SelectValue>{resultado === TODOS ? "Resultado" : ESTADO_DE_EJECUCION[resultado as EstadoDeEjecucion]?.etiqueta ?? resultado}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {(Object.entries(ESTADO_DE_EJECUCION) as [EstadoDeEjecucion, { etiqueta: string }][]).map(([estado, { etiqueta }]) => (
                  <SelectItem key={estado} value={estado}>{etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={envioElegido}
              onValueChange={(valor) => {
                setEnvioElegido(valor);
                filtrar({ id_programacion: valor === TODOS ? undefined : Number(valor) });
              }}
            >
              <SelectTrigger aria-label="Envío" className="h-8 w-48">
                <SelectValue>{envioElegido === TODOS ? "Envío" : opcionesDeEnvio.find((o) => o.value === envioElegido)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {opcionesDeEnvio.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon-sm" aria-label="Refrescar" onClick={() => void cargarHistorial()} disabled={cargandoHistorial}>
              <RefreshCwIcon className={`h-4 w-4 ${cargandoHistorial ? "animate-spin" : ""}`} />
            </Button>
          </>}
        />
      )}

      <EnvioDialog
        open={abierto !== null}
        programacion={seleccionada}
        informeInicial={abierto?.informe ?? null}
        puedeEditar={puedeProgramar && (seleccionada === null || esMia)}
        puedeEliminar={puedeProgramar && seleccionada !== null && (esMia || modera)}
        onClose={() => setAbierto(null)}
        onChanged={() => {
          void load();
          // What was just done (a send, a change, a removal) is in the history
          // already, if anybody has looked at it.
          if (historialPedido.current) void cargarHistorial();
        }}
      />
    </div>
  );
}
