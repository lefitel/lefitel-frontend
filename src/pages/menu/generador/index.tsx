import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon, DownloadIcon, FilePlus2Icon, FileTextIcon, Loader2Icon,
  PlayIcon, RefreshCwIcon, SaveIcon,
} from "lucide-react";
import { toast } from "sonner";

import { SesionContext } from "../../../context/SesionContext";
import {
  actualizarReporte, crearReporte, duplicarReporte, eliminarReporte, getCatalogo,
  getReportesGuardados, mensajeDeError, runReporte,
  type AggFn, type Catalog, type CatalogField, type ReportConfig, type ReportResult,
  type SavedReport,
} from "../../../api/generador.api";
import {
  addColumn, addFilter, changeRoot, describeConfig, emptyConfig, moveColumn,
  removeColumn, removeFilter, renameColumn, sameQuery, setColumnAgg, setFilterJoin,
  toggleGroupBy, toggleSort, updateFilter, validateConfig,
} from "../../../lib/reportConfig";
import { exportDynamicExcel } from "../../../lib/exports/dynamicExcel";
import { exportDynamicPdf } from "../../../lib/exports/dynamicPdf";

import { Button } from "../../../components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";

import ColumnList from "./ColumnList";
import FieldPicker from "./FieldPicker";
import FilterBuilder from "./FilterBuilder";
import PreviewTable from "./PreviewTable";
import SavedReports from "./SavedReports";

const GeneradorPage = () => {
  const { sesion } = useContext(SesionContext);
  const token = sesion.token;
  const currentUserId = sesion.usuario.id ?? undefined;

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [config, setConfig] = useState<ReportConfig>(emptyConfig("evento"));
  const [result, setResult] = useState<ReportResult | null>(null);
  /** The configuration that produced `result`, so we can tell when it is stale. */
  const [resultConfig, setResultConfig] = useState<ReportConfig | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [current, setCurrent] = useState<SavedReport | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveShared, setSaveShared] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  /**
   * The token is re-issued on every authenticated response, so anything that
   * depends on it re-runs constantly. Keep it in a ref: the catalog is fetched
   * once, and later fetches read the current value without re-triggering.
   */
  const tokenRef = useRef(token);
  tokenRef.current = token;

  /** Discards responses from a request the user has already superseded. */
  const runSeq = useRef(0);

  const root = useMemo(
    () => catalog?.roots.find((r) => r.key === config.root),
    [catalog, config.root],
  );
  const problems = useMemo(() => validateConfig(config, root), [config, root]);
  const chosen = useMemo(() => new Set(config.columns.map((c) => c.path)), [config.columns]);
  const description = useMemo(() => describeConfig(config, root), [config, root]);

  /** True when the table on screen no longer matches the configuration above it. */
  const stale = useMemo(
    () => result !== null && resultConfig !== null && !sameQuery(config, resultConfig),
    [result, resultConfig, config],
  );

  const isMine = current === null || current.id_usuario === currentUserId;

  // ── Loading ────────────────────────────────────────────────────────────────

  const loadCatalog = useCallback(() => {
    setLoadingCatalog(true);
    setCatalogError(false);
    getCatalogo(tokenRef.current)
      .then((data) => {
        setCatalog(data);
        const first = data.roots[0];
        // Only seed the root the very first time; never reset a configuration
        // the user has already built.
        setConfig((c) => (data.roots.some((r) => r.key === c.root) ? c : emptyConfig(first.key)));
      })
      .catch((error) => {
        setCatalogError(true);
        toast.error(mensajeDeError(error, "No se pudo cargar el catálogo de campos"));
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const refreshSaved = useCallback(() => {
    getReportesGuardados(tokenRef.current)
      .then(setSaved)
      .catch((error) =>
        toast.error(mensajeDeError(error, "No se pudieron cargar los reportes guardados")));
  }, []);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  // ── Running ────────────────────────────────────────────────────────────────

  /**
   * Runs `target` and stores it alongside the result.
   *
   * It never writes back into `config`: doing so used to revert whatever the
   * user edited while the query was in flight, and could pair a configuration
   * with a different saved report's identity.
   */
  const run = useCallback(async (target: ReportConfig) => {
    const seq = ++runSeq.current;
    setRunning(true);
    try {
      const data = await runReporte(target, tokenRef.current);
      if (seq !== runSeq.current) return;   // a newer request already went out
      setResult(data);
      setResultConfig(target);
      if (data.total === 0) toast.warning("Ningún registro coincide con estos filtros");
    } catch (error) {
      if (seq !== runSeq.current) return;
      toast.error(mensajeDeError(error, "No se pudo generar el reporte"));
      // Do not keep showing rows from a previous configuration under a header
      // that now describes a different one.
      setResult(null);
      setResultConfig(null);
    } finally {
      if (seq === runSeq.current) setRunning(false);
    }
  }, []);

  const handleGenerate = () => {
    if (problems.length > 0) return toast.warning(problems[0]);
    const target = { ...config, offset: 0 };
    setConfig(target);
    void run(target);
  };

  /** Paging must run the configuration that produced the current page. */
  const handlePage = (offset: number) => {
    if (!resultConfig) return;
    void run({ ...resultConfig, offset });
  };

  // ── Saved reports ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setCurrent(null);
    setSaveName("");
    setSaveDescription("");
    setSaveShared(false);
  };

  const handleNew = () => {
    setConfig(emptyConfig(root?.key ?? catalog?.roots[0]?.key ?? "evento"));
    setResult(null);
    setResultConfig(null);
    resetForm();
    toast.info("Reporte nuevo en blanco");
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (name === "") return toast.warning("El reporte necesita un nombre");
    if (problems.length > 0) return toast.warning(problems[0]);
    if (saving) return;

    setSaving(true);
    try {
      const payload = {
        name,
        description: saveDescription.trim() || null,
        config,
        visibility: saveShared ? ("shared" as const) : ("private" as const),
      };
      // Updating only ever touches your own report; someone else's is copied.
      const report = current && isMine
        ? await actualizarReporte(current.id, payload, tokenRef.current)
        : await crearReporte(payload, tokenRef.current);
      setCurrent(report);
      setSaveName(report.name);
      setSaveOpen(false);
      refreshSaved();
      toast.success(current && isMine ? "Reporte actualizado" : "Reporte guardado");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo guardar el reporte"));
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = (report: SavedReport) => {
    const target = catalog?.roots.find((r) => r.key === report.config.root);
    if (!target) {
      return toast.error("Este reporte usa un nivel de detalle que su perfil no puede consultar.");
    }
    // Drop anything this role's catalog does not offer, instead of loading a
    // configuration that fails with an internal path name on every attempt.
    const cleaned = changeRoot({ ...report.config, offset: 0 }, target);
    const dropped =
      (report.config.columns?.length ?? 0) - cleaned.columns.length +
      ((report.config.filters?.conditions.length ?? 0) - (cleaned.filters?.conditions.length ?? 0));

    setConfig(cleaned);
    setCurrent(report);
    setSaveName(report.name);
    setSaveDescription(report.description ?? "");
    setSaveShared(report.visibility === "shared");
    setResult(null);
    setResultConfig(null);

    if (dropped > 0) {
      toast.warning(
        `«${report.name}» se abrió sin ${dropped} elemento${dropped === 1 ? "" : "s"} que su perfil no puede consultar.`,
      );
    } else {
      toast.info(`«${report.name}» cargado. Pulse Generar para verlo.`);
    }
  };

  const handleToggleFavorite = async (report: SavedReport) => {
    try {
      await actualizarReporte(report.id, { favorite: !report.favorite }, tokenRef.current);
      refreshSaved();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el favorito"));
    }
  };

  const handleDuplicate = async (report: SavedReport) => {
    try {
      await duplicarReporte(report.id, tokenRef.current);
      refreshSaved();
      toast.success("Copia creada");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo duplicar el reporte"));
    }
  };

  const handleDelete = async (report: SavedReport) => {
    try {
      await eliminarReporte(report.id, tokenRef.current);
      if (current?.id === report.id) resetForm();
      refreshSaved();
      toast.success("Reporte archivado");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el reporte"));
    }
  };

  // ── Exports ────────────────────────────────────────────────────────────────

  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  /**
   * Exports the whole report, not the page on screen.
   *
   * The preview pages 100 rows at a time; exporting `result` produced a file
   * that looked complete and held a fragment.
   */
  const fetchAll = async (): Promise<ReportResult | null> => {
    if (!resultConfig || !result) return null;
    if (result.rows.length >= result.total) return result;
    return runReporte({ ...resultConfig, offset: 0, limit: result.total }, tokenRef.current);
  };

  const exportTitle = (current?.name ?? saveName).trim() || "Reporte";
  const exportSubtitle = resultConfig ? describeConfig(resultConfig, root) : description;

  const handleExcel = async () => {
    if (!result || exporting) return;
    setExporting("excel");
    try {
      const full = await fetchAll();
      if (!full) return;
      await exportDynamicExcel(full, { title: exportTitle, subtitle: exportSubtitle });
      toast.success(`Excel generado con ${full.rows.length} filas`);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo generar el Excel"));
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = async () => {
    if (!result || exporting) return;
    setExporting("pdf");
    try {
      const full = await fetchAll();
      if (!full) return;
      exportDynamicPdf(full, { title: exportTitle, subtitle: exportSubtitle });
      toast.success(`PDF generado con ${full.rows.length} filas`);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo generar el PDF"));
    } finally {
      setExporting(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingCatalog) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
        Cargando campos disponibles…
      </div>
    );
  }

  if (catalogError || !catalog) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertTriangleIcon className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar los campos disponibles.
        </p>
        <Button variant="outline" size="sm" onClick={loadCatalog}>
          <RefreshCwIcon className="mr-1.5 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="@container/card w-full space-y-4 px-6 pt-4 pb-6 animate-in fade-in duration-500 md:px-8 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Generador de reportes</h1>
          <p className="text-muted-foreground">
            Arme el reporte que necesite: elija las columnas, filtre y agrupe. Guárdelo para volver a generarlo cuando quiera.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNew}>
          <FilePlus2Icon className="mr-1.5 h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
        {/* ── Configuration ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base">Nivel de detalle</CardTitle>
              <CardDescription>Define qué representa cada fila del reporte.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Select
                value={config.root}
                onValueChange={(value) => {
                  const next = catalog.roots.find((r) => r.key === value);
                  if (!next) return;
                  setConfig((c) => {
                    const cleaned = changeRoot(c, next);
                    const lost =
                      c.columns.length - cleaned.columns.length +
                      ((c.filters?.conditions.length ?? 0) - (cleaned.filters?.conditions.length ?? 0));
                    if (lost > 0) {
                      toast.warning(
                        `Se descartaron ${lost} elemento${lost === 1 ? "" : "s"} que no existen en este nivel de detalle.`,
                      );
                    }
                    return cleaned;
                  });
                  setResult(null);
                  setResultConfig(null);
                }}
              >
                <SelectTrigger aria-label="Nivel de detalle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog.roots.map((r) => (
                    <SelectItem key={r.key} value={r.key}>{r.rowMeaning}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Columnas</CardTitle>
                <FieldPicker
                  root={root}
                  chosen={chosen}
                  onPick={(field: CatalogField) =>
                    setConfig((c) => {
                      const next = addColumn(c, field.path);
                      if (next === c) toast.warning(`"${field.label}" ya está en el reporte.`);
                      return next;
                    })}
                  onPickAggregate={(path) =>
                    setConfig((c) => addColumn(c, path, "count" as AggFn))}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <ColumnList
                config={config}
                root={root}
                onMove={(from, to) => setConfig((c) => moveColumn(c, from, to))}
                onRemove={(index) => setConfig((c) => removeColumn(c, index))}
                onRename={(index, label) => setConfig((c) => renameColumn(c, index, label))}
                onSetAgg={(index, agg) => setConfig((c) => setColumnAgg(c, index, agg))}
                onToggleGroup={(index) => setConfig((c) => toggleGroupBy(c, index))}
                onToggleSort={(path) => setConfig((c) => toggleSort(c, path))}
              />
            </CardContent>
          </Card>

          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Filtros</CardTitle>
                <FieldPicker
                  root={root}
                  chosen={new Set()}
                  label="Añadir filtro"
                  onPick={(field) => setConfig((c) => addFilter(c, field))}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <FilterBuilder
                config={config}
                root={root}
                onUpdate={(index, patch) => setConfig((c) => updateFilter(c, index, patch))}
                onRemove={(index) => setConfig((c) => removeFilter(c, index))}
                onSetJoin={(op) => setConfig((c) => setFilterJoin(c, op))}
              />
            </CardContent>
          </Card>

          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base">Reportes guardados</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <SavedReports
                reports={saved}
                currentId={current?.id ?? null}
                currentUserId={currentUserId}
                onOpen={handleOpen}
                onToggleFavorite={handleToggleFavorite}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Results ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">Resultado</CardTitle>
                  <CardDescription className="truncate">{description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <SaveIcon className="mr-1.5 h-4 w-4" />
                        {current && isMine ? "Actualizar" : "Guardar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      {current && isMine && (
                        <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          Se sobrescribirá «{current.name}».
                        </p>
                      )}
                      {current && !isMine && (
                        <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          «{current.name}» es de otra persona: se guardará como copia suya.
                        </p>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="rep-nombre">Nombre</Label>
                        <Input
                          id="rep-nombre"
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          placeholder="Eventos pendientes por tramo"
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rep-desc">Descripción <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                        <Textarea
                          id="rep-desc"
                          value={saveDescription}
                          onChange={(e) => setSaveDescription(e.target.value)}
                          rows={2}
                          maxLength={500}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="rep-shared" className="cursor-pointer">Compartir con el equipo</Label>
                        <Switch id="rep-shared" checked={saveShared} onCheckedChange={setSaveShared} />
                      </div>
                      <Button className="w-full" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />}
                        {current && isMine ? "Actualizar reporte" : "Guardar reporte"}
                      </Button>
                    </PopoverContent>
                  </Popover>

                  <Button variant="outline" size="sm" disabled={!result || exporting !== null} onClick={handleExcel}>
                    {exporting === "excel"
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <DownloadIcon className="mr-1.5 h-4 w-4" />}
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" disabled={!result || exporting !== null} onClick={handlePdf}>
                    {exporting === "pdf"
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <FileTextIcon className="mr-1.5 h-4 w-4" />}
                    PDF
                  </Button>
                  <Button size="sm" onClick={handleGenerate} disabled={running}>
                    {running
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <PlayIcon className="mr-1.5 h-4 w-4" />}
                    Generar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {problems.length > 0 && (
                <div
                  role="alert"
                  className="mb-4 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="space-y-0.5">
                    {problems.map((problem, i) => <li key={`${i}-${problem}`}>{problem}</li>)}
                  </ul>
                </div>
              )}

              {stale && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  Cambió la configuración: la tabla muestra el resultado anterior. Pulse Generar para actualizarla.
                </div>
              )}

              {result ? (
                <PreviewTable result={result} loading={running} onPage={handlePage} />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Arme el reporte a la izquierda y pulse <strong>Generar</strong> para verlo aquí.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GeneradorPage;
