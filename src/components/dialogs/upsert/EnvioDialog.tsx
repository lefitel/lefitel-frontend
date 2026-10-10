import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, SendIcon, Trash2Icon } from "lucide-react";
import {
  actualizarProgramacion,
  crearProgramacion,
  eliminarProgramacion,
  enviarProgramacionAhora,
  listarDestinatariosPosibles,
  listarEjecuciones,
  type DestinatarioPosible,
  type Ejecucion,
  type FormatoProgramado,
  type Frecuencia,
  type Programacion,
} from "../../../api/Programacion.api";
import { getReportesGuardados, type SavedReport } from "../../../api/generador.api";
import { mensajeDeError } from "../../../api/descarga";
import {
  BORRADOR_VACIO,
  DIAS_DE_LA_SEMANA,
  DIAS_DEL_MES,
  ESTADO_DE_EJECUCION,
  FRECUENCIAS,
  MAX_DESTINATARIOS,
  borradorDe,
  correosDe,
  cuandoSeEnvia,
  faltan,
  pedidaDe,
  problemaDe,
  totalDeDestinatarios,
  type Borrador,
  type Tono,
} from "../../../lib/envios";
import { cn } from "../../../lib/utils";
import FormDialog from "../FormDialog";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { TimeField } from "../../ui/time-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

/**
 * Creating a scheduled report, or looking at one: its settings in one tab and
 * what happened each time it was due in the other.
 *
 * **Who may do what is decided by the caller and handed in.** Only the owner
 * changes a schedule or sends it now; administration may look at anybody's
 * and remove it. Somebody who may only look gets the same form, read-only,
 * with a single "Cerrar".
 */

interface Props {
  open: boolean;
  /** `null` to create one. */
  programacion: Programacion | null;
  /** The report to start from when creating — the generator's shortcut. */
  informeInicial?: number | null;
  /** May change it and send it now: it is theirs and they hold the permission. */
  puedeEditar: boolean;
  /** May remove it: the owner, or administration. */
  puedeEliminar: boolean;
  onClose: () => void;
  /** Something was written; the list behind should be read again. */
  onChanged: () => void;
}

// The theme has no token for "went well" or "look at this": every screen
// writes these two by hand, and these are the pair most of them use.
const AVISO = "text-amber-600 dark:text-amber-500";
const TONO: Record<Tono, string> = {
  bien: "text-emerald-600 dark:text-emerald-400",
  aviso: AVISO,
  mal: "text-destructive",
  neutro: "text-muted-foreground",
};

/** A date as the screen writes them: 05/10, 07:00. */
const fecha = (iso: string): string =>
  new Intl.DateTimeFormat("es-BO", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "America/La_Paz",
  }).format(new Date(iso));

const peso = (bytes: number | null): string | null =>
  bytes === null ? null : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const Estado = ({ estado }: { estado: Ejecucion["estado"] }) => {
  const { etiqueta, tono } = ESTADO_DE_EJECUCION[estado] ?? { etiqueta: estado, tono: "neutro" as Tono };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap", TONO[tono])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {etiqueta}
    </span>
  );
};

export default function EnvioDialog({
  open, programacion, informeInicial = null, puedeEditar, puedeEliminar, onClose, onChanged,
}: Props) {
  const existe = programacion !== null;
  const soloLectura = existe && !puedeEditar;

  const inicial = useMemo<Borrador>(
    () => (programacion ? borradorDe(programacion) : { ...BORRADOR_VACIO, id_reporte: informeInicial }),
    [programacion, informeInicial],
  );
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [tab, setTab] = useState<"programacion" | "historial">("programacion");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const [informes, setInformes] = useState<SavedReport[] | null>(null);
  const [cuentas, setCuentas] = useState<DestinatarioPosible[] | null>(null);
  const [historial, setHistorial] = useState<Ejecucion[] | null>(null);
  const [filtro, setFiltro] = useState("");

  // A dialog opened again starts from what it was given, not from last time.
  useEffect(() => {
    if (!open) return;
    setBorrador(inicial);
    setTab("programacion");
    setConfirmandoBorrado(false);
    setHistorial(null);
    setFiltro("");
  }, [open, inicial]);

  // The two lists the form chooses from. Read when it opens, and only by
  // somebody who can use them: the accounts are behind the write permission.
  useEffect(() => {
    if (!open || soloLectura) return;
    let vivo = true;
    getReportesGuardados({ limit: 200 })
      .then((pagina) => { if (vivo) setInformes(pagina.rows); })
      .catch(() => { if (vivo) setInformes([]); });
    listarDestinatariosPosibles()
      .then((sobre) => { if (vivo) setCuentas(sobre.data); })
      .catch(() => { if (vivo) setCuentas([]); });
    return () => { vivo = false; };
  }, [open, soloLectura]);

  useEffect(() => {
    if (!open || tab !== "historial" || !programacion || historial !== null) return;
    let vivo = true;
    listarEjecuciones(programacion.id)
      .then((sobre) => { if (vivo) setHistorial(sobre.data); })
      .catch(() => { if (vivo) setHistorial([]); });
    return () => { vivo = false; };
  }, [open, tab, programacion, historial]);

  const cambia = <K extends keyof Borrador>(campo: K, valor: Borrador[K]) =>
    setBorrador((b) => ({ ...b, [campo]: valor }));

  const dirty = JSON.stringify(borrador) !== JSON.stringify(inicial);
  const problema = problemaDe(borrador);
  const total = totalDeDestinatarios(borrador);
  const { validos: correosValidos } = correosDe(borrador.correos);

  const guardar = async () => {
    // The frame shows what is missing and still calls this: stopping is ours.
    if (faltan(borrador).length > 0) return;
    if (problema) return void toast.error(problema);
    setGuardando(true);
    try {
      if (programacion) await actualizarProgramacion(programacion.id, pedidaDe(borrador));
      else await crearProgramacion(pedidaDe(borrador));
      toast.success(programacion ? "Envío actualizado" : "Envío programado");
      onChanged();
      onClose();
    } catch (error) {
      const mensaje = mensajeDeError(error, "No se pudo guardar el envío");
      // Empty when the identity confirmation was cancelled: that dialog has
      // already said so.
      if (mensaje) toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const enviarAhora = async () => {
    if (!programacion || enviando) return;
    setEnviando(true);
    try {
      const r = await enviarProgramacionAhora(programacion.id);
      if (r.tipo === "pausada") toast.warning("No se envió: el envío ha quedado en pausa.");
      else if (r.estado === "fallido") toast.error("No se pudo enviar. Mira el historial para ver el motivo.");
      else toast.success(`Enviado a ${r.enviados} ${r.enviados === 1 ? "destinatario" : "destinatarios"}`);
      setHistorial(null);
      onChanged();
    } catch (error) {
      const mensaje = mensajeDeError(error, "No se pudo enviar ahora");
      if (mensaje) toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async () => {
    if (!programacion) return;
    setGuardando(true);
    try {
      await eliminarProgramacion(programacion.id);
      toast.success("Envío eliminado");
      onChanged();
      onClose();
    } catch (error) {
      const mensaje = mensajeDeError(error, "No se pudo eliminar el envío");
      if (mensaje) toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const cuentasVisibles = (cuentas ?? []).filter((c) =>
    `${c.name} ${c.lastname}`.toLowerCase().includes(filtro.trim().toLowerCase()));
  const sinCorreo = (cuentas ?? []).filter((c) => borrador.usuarios.includes(c.id) && !c.tieneCorreo);
  const deBaja = programacion?.destinatarios.correos.filter((c) => c.deBaja) ?? [];
  const rechazados = programacion?.destinatarios.correos.filter((c) => c.rechazado && !c.deBaja) ?? [];

  const nombreDelInforme = programacion?.informe?.name
    ?? informes?.find((i) => i.id === borrador.id_reporte)?.name
    ?? null;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={existe ? (nombreDelInforme ?? "Envío programado") : "Programar envío"}
      description={existe
        ? `${cuandoSeEnvia(programacion)}${programacion.proxima_ejecucion ? ` · próximo envío el ${fecha(programacion.proxima_ejecucion)}` : ""}`
        : "Se enviará por correo con el fichero adjunto, en hora de Bolivia."}
      dirty={!soloLectura && dirty}
      missing={soloLectura || tab === "historial" ? [] : faltan(borrador)}
      saving={guardando}
      submitLabel={existe ? "Guardar cambios" : "Programar envío"}
      onSubmit={soloLectura || tab === "historial" ? undefined : () => void guardar()}
      bodyClassName="space-y-4"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        {existe && (
          <TabsList>
            <TabsTrigger value="programacion">Programación</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="programacion" className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="envio-informe">Informe <span className="text-destructive">*</span></Label>
            {soloLectura ? (
              <p id="envio-informe" className="text-sm">{nombreDelInforme ?? "—"}</p>
            ) : (
              <Select
                value={borrador.id_reporte === null ? "" : String(borrador.id_reporte)}
                onValueChange={(v) => cambia("id_reporte", Number(v))}
              >
                <SelectTrigger id="envio-informe" aria-label="Informe">
                  <SelectValue placeholder={informes === null ? "Cargando…" : "Elija un informe guardado"} />
                </SelectTrigger>
                <SelectContent>
                  {/* The one already chosen stays offered even if it is past the
                      page that was read, or archived: the form must not show an
                      empty box over a schedule that has a report. */}
                  {programacion?.informe && !informes?.some((i) => i.id === programacion.id_reporte) && (
                    <SelectItem value={String(programacion.id_reporte)}>{programacion.informe.name}</SelectItem>
                  )}
                  {(informes ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {programacion?.informe?.archivado && (
              <p className={cn("text-xs", AVISO)}>Este informe está archivado: el envío no saldrá hasta que elijas otro.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="envio-frecuencia">Frecuencia</Label>
              <Select value={borrador.frecuencia} disabled={soloLectura} onValueChange={(v) => cambia("frecuencia", v as Frecuencia)}>
                <SelectTrigger id="envio-frecuencia" aria-label="Frecuencia"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRECUENCIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {borrador.frecuencia === "semanal" && (
              <div className="space-y-1.5">
                <Label htmlFor="envio-dia-semana">Día</Label>
                <Select value={String(borrador.dia_semana)} disabled={soloLectura} onValueChange={(v) => cambia("dia_semana", Number(v))}>
                  <SelectTrigger id="envio-dia-semana" aria-label="Día de la semana"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS_DE_LA_SEMANA.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {borrador.frecuencia === "mensual" && (
              <div className="space-y-1.5">
                <Label htmlFor="envio-dia-mes">Día del mes</Label>
                <Select value={String(borrador.dia_mes)} disabled={soloLectura} onValueChange={(v) => cambia("dia_mes", Number(v))}>
                  <SelectTrigger id="envio-dia-mes" aria-label="Día del mes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS_DEL_MES.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="envio-hora">Hora</Label>
              <TimeField
                id="envio-hora"
                hora={borrador.hora}
                minuto={borrador.minuto}
                disabled={soloLectura}
                onChange={(hora, minuto) => setBorrador((b) => ({ ...b, hora, minuto }))}
              />
            </div>
          </div>
          {borrador.frecuencia === "mensual" && (
            <p className="text-xs text-muted-foreground -mt-2">Del 1 al 28, para que el día exista todos los meses.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="envio-formato">Formato</Label>
              <Select value={borrador.formato} disabled={soloLectura} onValueChange={(v) => cambia("formato", v as FormatoProgramado)}>
                <SelectTrigger id="envio-formato" aria-label="Formato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Photographs are an Excel matter: a PDF never carries them. */}
            {borrador.formato === "excel" && (
              <div className="flex items-center gap-2 sm:pt-6">
                <Switch id="envio-fotos" checked={borrador.con_fotos} disabled={soloLectura} onCheckedChange={(v) => cambia("con_fotos", v)} />
                <Label htmlFor="envio-fotos" className="font-normal">Con fotos</Label>
              </div>
            )}
            <div className="flex items-center gap-2 sm:pt-6">
              <Switch id="envio-activa" checked={borrador.activa} disabled={soloLectura} onCheckedChange={(v) => cambia("activa", v)} />
              <Label htmlFor="envio-activa" className="font-normal">{borrador.activa ? "Activo" : "En pausa"}</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="envio-buscar-cuenta">Usuarios del sistema</Label>
              <span className={cn("text-xs tabular-nums", total > MAX_DESTINATARIOS ? "text-destructive" : "text-muted-foreground")}>
                {total} de {MAX_DESTINATARIOS} destinatarios
              </span>
            </div>
            {soloLectura ? (
              <p className="text-sm">
                {programacion.destinatarios.usuarios.map((u) => `${u.name ?? ""} ${u.lastname ?? ""}`.trim()).join(", ") || "Ninguno"}
              </p>
            ) : (
              // `data-no-submit`: Intro in the search box narrows a list; it
              // must not save the form behind it.
              <div className="rounded-md border border-input" data-no-submit>
                <input
                  id="envio-buscar-cuenta"
                  data-no-autofocus
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className="h-8 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                />
                <ul className="max-h-36 overflow-y-auto p-1" aria-label="Usuarios destinatarios">
                  {cuentas === null && <li className="px-2 py-2 text-sm text-muted-foreground">Cargando…</li>}
                  {cuentas !== null && cuentasVisibles.length === 0 && (
                    <li className="px-2 py-2 text-sm text-muted-foreground">Sin resultados</li>
                  )}
                  {cuentasVisibles.map((c) => {
                    const marcada = borrador.usuarios.includes(c.id);
                    // Nothing would reach an account with no verified address,
                    // so it cannot be added. One already on the schedule — it
                    // had an address when it was added — can still be taken off.
                    const bloqueada = !c.tieneCorreo && !marcada;
                    return (
                      <li key={c.id}>
                        <label
                          className={cn(
                            "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                            bloqueada ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer hover:bg-accent",
                          )}
                        >
                          <Checkbox
                            checked={marcada}
                            disabled={bloqueada}
                            onCheckedChange={(v) => cambia(
                              "usuarios",
                              v ? [...borrador.usuarios, c.id] : borrador.usuarios.filter((id) => id !== c.id),
                            )}
                          />
                          <span className="truncate">{c.name} {c.lastname}</span>
                          {!c.tieneCorreo && <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">sin correo verificado</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {sinCorreo.length > 0 && (
              <p className={cn("text-xs", AVISO)}>
                {sinCorreo.map((c) => `${c.name} ${c.lastname}`).join(", ")} no {sinCorreo.length === 1 ? "tiene" : "tienen"} un
                correo verificado: no lo {sinCorreo.length === 1 ? "recibirá" : "recibirán"} hasta que lo {sinCorreo.length === 1 ? "verifique" : "verifiquen"}.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="envio-correos">Correos externos</Label>
            {soloLectura ? (
              <p id="envio-correos" className="text-sm break-words">
                {programacion.destinatarios.correos.filter((c) => !c.deBaja).map((c) => c.email).join(", ") || "Ninguno"}
              </p>
            ) : (
              <Textarea
                id="envio-correos"
                rows={2}
                value={borrador.correos}
                onChange={(e) => cambia("correos", e.target.value)}
                placeholder="cliente@empresa.com, otra@empresa.com"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Reciben el informe sin datos del personal, y un enlace para dejar de recibirlo.
              {correosValidos.length > 0 && !soloLectura ? ` ${correosValidos.length} ${correosValidos.length === 1 ? "dirección" : "direcciones"}.` : ""}
            </p>
            {problema && !soloLectura && <p role="alert" className="text-xs text-destructive">{problema}</p>}
            {deBaja.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Se {deBaja.length === 1 ? "dio" : "dieron"} de baja y ya no {deBaja.length === 1 ? "recibe" : "reciben"}: {deBaja.map((c) => c.email).join(", ")}.
              </p>
            )}
            {rechazados.length > 0 && (
              <p className={cn("text-xs", AVISO)}>
                El correo no llega a {rechazados.map((c) => c.email).join(", ")}: se dejó de enviar tras tres rechazos. Corrige la dirección o quítala.
              </p>
            )}
          </div>

          {existe && (puedeEditar || puedeEliminar) && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {puedeEditar && (
                <Button type="button" variant="outline" size="sm" className="gap-2" disabled={enviando || dirty} onClick={() => void enviarAhora()}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                  Enviar ahora
                </Button>
              )}
              {puedeEditar && dirty && <span className="text-xs text-muted-foreground">Guarda los cambios antes de enviar.</span>}
              {puedeEliminar && (confirmandoBorrado ? (
                <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                  ¿Eliminar este envío?
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmandoBorrado(false)}>No</Button>
                  <Button type="button" size="sm" className="bg-destructive-fill hover:bg-destructive-fill/90 text-white" disabled={guardando} onClick={() => void eliminar()}>
                    Sí, eliminar
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="ml-auto gap-2 text-destructive hover:text-destructive" onClick={() => setConfirmandoBorrado(true)}>
                  <Trash2Icon className="h-4 w-4" />
                  Eliminar envío
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          {historial === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : historial.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no se ha enviado ninguna vez.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[26rem] text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Tocaba</th>
                    <th className="px-3 py-2 font-semibold">Resultado</th>
                    <th className="px-3 py-2 font-semibold">Entregados</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((e) => {
                    const detalle = e.detalle
                      ?? (e.estado === "enviado" ? [e.filas !== null ? `${e.filas.toLocaleString("es-BO")} filas` : null, peso(e.bytes)].filter(Boolean).join(" · ") : null)
                      ?? (e.estado === "vacio" ? "Se envió un aviso" : null);
                    return (
                      <tr key={e.id} className="border-b last:border-0 align-top">
                        <td className="px-3 py-2 whitespace-nowrap font-medium">
                          {fecha(e.programada_para)}
                          {e.manual && <span className="block text-xs font-normal text-muted-foreground">Envío manual</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Estado estado={e.estado} />
                          {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {e.estado === "omitido" ? "—" : `${e.enviados} de ${e.enviados + e.no_enviados}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </FormDialog>
  );
}
