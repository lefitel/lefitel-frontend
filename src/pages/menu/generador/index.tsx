import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon, DownloadIcon, FileTextIcon, Loader2Icon, PlayIcon, SaveIcon,
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
  removeColumn, removeFilter, renameColumn, setColumnAgg, setFilterJoin,
  toggleGroupBy, updateFilter, validateConfig,
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

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [config, setConfig] = useState<ReportConfig>(emptyConfig("evento"));
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [running, setRunning] = useState(false);

  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveShared, setSaveShared] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const root = useMemo(
    () => catalog?.roots.find((r) => r.key === config.root),
    [catalog, config.root],
  );
  const problems = useMemo(() => validateConfig(config, root), [config, root]);
  const chosen = useMemo(() => new Set(config.columns.map((c) => c.path)), [config.columns]);

  // ── Loading ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    getCatalogo(token)
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        const first = data.roots[0];
        if (first) setConfig((c) => (c.root === first.key ? c : emptyConfig(first.key)));
      })
      .catch((error) => {
        if (!cancelled) toast.error(mensajeDeError(error, "No se pudo cargar el catálogo de campos"));
      })
      .finally(() => { if (!cancelled) setLoadingCatalog(false); });
    return () => { cancelled = true; };
  }, [token]);

  const refreshSaved = useCallback(() => {
    getReportesGuardados(token)
      .then(setSaved)
      .catch((error) => toast.error(mensajeDeError(error, "No se pudieron cargar los reportes guardados")));
  }, [token]);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  // ── Running ────────────────────────────────────────────────────────────────

  const run = useCallback(async (override?: Partial<ReportConfig>) => {
    const target = { ...config, ...override };
    setRunning(true);
    try {
      const data = await runReporte(target, token);
      setResult(data);
      setConfig(target);
      if (data.total === 0) toast.warning("Ningún registro coincide con estos filtros");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo generar el reporte"));
    } finally {
      setRunning(false);
    }
  }, [config, token]);

  const handleGenerate = () => {
    if (problems.length > 0) return toast.warning(problems[0]);
    void run({ offset: 0 });
  };

  // ── Saved reports ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    const name = saveName.trim();
    if (name === "") return toast.warning("El reporte necesita un nombre");
    if (problems.length > 0) return toast.warning(problems[0]);

    try {
      const payload = {
        name,
        description: saveDescription.trim() || null,
        config,
        visibility: saveShared ? ("shared" as const) : ("private" as const),
      };
      const report = currentId
        ? await actualizarReporte(currentId, payload, token)
        : await crearReporte(payload, token);
      setCurrentId(report.id);
      setSaveOpen(false);
      refreshSaved();
      toast.success(currentId ? "Reporte actualizado" : "Reporte guardado");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo guardar el reporte"));
    }
  };

  const handleOpen = (report: SavedReport) => {
    setConfig({ ...report.config, offset: 0 });
    setCurrentId(report.id);
    setSaveName(report.name);
    setSaveDescription(report.description ?? "");
    setSaveShared(report.visibility === "shared");
    setResult(null);
    toast.info(`«${report.name}» cargado. Pulse Generar para verlo.`);
  };

  const handleToggleFavorite = async (report: SavedReport) => {
    try {
      await actualizarReporte(report.id, { favorite: !report.favorite }, token);
      refreshSaved();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el favorito"));
    }
  };

  const handleDuplicate = async (report: SavedReport) => {
    try {
      await duplicarReporte(report.id, token);
      refreshSaved();
      toast.success("Copia creada");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo duplicar el reporte"));
    }
  };

  const handleDelete = async (report: SavedReport) => {
    try {
      await eliminarReporte(report.id, token);
      if (currentId === report.id) setCurrentId(null);
      refreshSaved();
      toast.success("Reporte archivado");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el reporte"));
    }
  };

  // ── Exports ────────────────────────────────────────────────────────────────

  const exportTitle = saveName.trim() || "Reporte";
  const exportSubtitle = describeConfig(config, root);

  const handleExcel = async () => {
    if (!result) return;
    try {
      await exportDynamicExcel(result, { title: exportTitle, subtitle: exportSubtitle });
      toast.success("Excel generado");
    } catch {
      toast.error("No se pudo generar el Excel");
    }
  };

  const handlePdf = () => {
    if (!result) return;
    try {
      exportDynamicPdf(result, { title: exportTitle, subtitle: exportSubtitle });
      toast.success("PDF generado");
    } catch {
      toast.error("No se pudo generar el PDF");
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

  return (
    <div className="@container/card w-full space-y-4 px-6 pt-4 pb-6 animate-in fade-in duration-500 md:px-8 md:pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Generador de reportes</h1>
        <p className="text-muted-foreground">
          Arme el reporte que necesite: elija las columnas, filtre y agrupe. Guárdelo para volver a generarlo cuando quiera.
        </p>
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
                  const next = catalog?.roots.find((r) => r.key === value);
                  if (next) { setConfig((c) => changeRoot(c, next)); setResult(null); }
                }}
              >
                <SelectTrigger aria-label="Nivel de detalle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog?.roots.map((r) => (
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
                  onPick={(field: CatalogField) => setConfig((c) => addColumn(c, field.path))}
                  onPickAggregate={(path) => setConfig((c) => addColumn(c, path, "count" as AggFn))}
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
                onToggleGroup={(path) => setConfig((c) => toggleGroupBy(c, path))}
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
                currentId={currentId}
                currentUserId={sesion.usuario.id ?? undefined}
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
                  <CardDescription className="truncate">{describeConfig(config, root)}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <SaveIcon className="mr-1.5 h-4 w-4" />
                        {currentId ? "Actualizar" : "Guardar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
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
                      <Button className="w-full" onClick={handleSave}>
                        {currentId ? "Actualizar reporte" : "Guardar reporte"}
                      </Button>
                    </PopoverContent>
                  </Popover>

                  <Button variant="outline" size="sm" disabled={!result} onClick={handleExcel}>
                    <DownloadIcon className="mr-1.5 h-4 w-4" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" disabled={!result} onClick={handlePdf}>
                    <FileTextIcon className="mr-1.5 h-4 w-4" />
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
                    {problems.map((problem) => <li key={problem}>{problem}</li>)}
                  </ul>
                </div>
              )}

              {result ? (
                <PreviewTable
                  result={result}
                  loading={running}
                  onPage={(offset) => void run({ offset })}
                />
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
