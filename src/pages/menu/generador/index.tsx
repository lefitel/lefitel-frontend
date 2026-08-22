import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon, DownloadIcon, FilePlus2Icon, FileTextIcon, Loader2Icon,
  PlayIcon, RefreshCwIcon, SaveIcon,
} from "lucide-react";
import { toast } from "sonner";

import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import {
  actualizarReporte, contarReporte, crearReporte, duplicarReporte, eliminarReporte,
  exportarReporte, getCatalogo, getReportesGuardados, mensajeDeError, mensajeDeErrorAsync,
  runReporte,
  type AggFn, type Catalog, type CatalogField, type CatalogRoot, type ExportFormat,
  type FilterCondition,
  type ReportConfig, type ReportResult, type SavedReport,
} from "../../../api/generador.api";
import {
  addColumn, addFilter, changeRoot, columnLimitReached, describeConfig, elementCount,
  emptyConfig, filterLimitReached, maxColumns, maxConditions, maxSorts, moveColumn,
  pruneToCatalog, removeColumn, removeFilter, renameColumn, sameQuery, setColumnAgg,
  setFilterJoin, sortLimitReached, toggleGroupBy, toggleSort, updateFilter, validateConfig,
} from "../../../lib/reportConfig";
import axios from "axios";
import { saveAs } from "file-saver";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
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

  /**
   * What this role may do here, from the matrix the server enforces.
   *
   * The page asked nothing: every button was drawn for everyone, and the server
   * answered 403 to whoever pressed one they did not hold. That cost nothing
   * while all three seeded roles held all four actions — and it breaks the
   * first time an administrator unticks a box in Seguridad, which is the entire
   * point of that screen. The server stays the authority; this only stops
   * offering what it is going to refuse.
   */
  const rol = sesion.usuario.id_rol;
  const mayCreate = can(rol, "generador", "crear");
  const mayEdit = can(rol, "generador", "editar");
  const mayArchive = can(rol, "generador", "archivar");

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [config, setConfig] = useState<ReportConfig>(emptyConfig("evento"));
  const [result, setResult] = useState<ReportResult | null>(null);
  /** The configuration that produced `result`, so we can tell when it is stale. */
  const [resultConfig, setResultConfig] = useState<ReportConfig | null>(null);
  /** Row count for the configuration as it stands, from the counting endpoint. */
  const [estimate, setEstimate] = useState<number | null>(null);
  /** True while a refresh is armed but has not gone out: the banner defers to it. */
  const [autoPending, setAutoPending] = useState(false);
  /** A level-of-detail change waiting to be confirmed, and what it would cost. */
  const [pendingRoot, setPendingRoot] = useState<
    { root: CatalogRoot; cleaned: ReportConfig; lost: number } | null
  >(null);
  /**
   * Whether the table follows the configuration on its own.
   *
   * On by default and switchable, because the two ways of working are real: for
   * a report being explored, refreshing itself is the whole point, and for one
   * that takes eight seconds over a year of events it is a tax. The switch is
   * next to the button it replaces.
   */
  const [auto, setAuto] = useState(true);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedTotal, setSavedTotal] = useState(0);
  // Read by `loadSaved` to know where the next page starts, so the loader stays
  // identity-stable and does not re-run on every append.
  const savedRef = useRef<SavedReport[]>(saved);
  savedRef.current = saved;
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
  /** The armed refresh, so an explicit click can cancel it. */
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last configuration the automatic refresh has dealt with. */
  const autoDone = useRef<string | null>(null);

  /**
   * The current configuration, readable from a handler that never changes.
   *
   * Every row of the column list and the filter list is memoised, and the memo
   * was inert: the parent rebuilt six arrow functions on each render, so the
   * shallow compare failed for all sixty rows on every keystroke of any rename
   * or filter value — the half-second-per-keypress the memo was added to
   * remove. The handlers below are built once; when one needs to look at the
   * configuration before deciding, it reads it here instead of closing over it.
   */
  const configRef = useRef(config);
  configRef.current = config;

  const root = useMemo(
    () => catalog?.roots.find((r) => r.key === config.root),
    [catalog, config.root],
  );
  /**
   * The caps, taken from the catalog the server publishes.
   *
   * They were written out again in `reportConfig.ts` as constants, which is the
   * duplication `catalog.limits` exists to avoid: whoever changes a cap on the
   * server has no reason to suspect a copy lives in the client, and then the
   * local warning either never fires or fires over a report the server would
   * have accepted. The constants remain as the fallback for before the catalog
   * arrives.
   */
  const limits = catalog?.limits;
  // Read by the identity-stable callbacks below, for the same reason
  // `configRef` exists: a value closed over at first render is the value from
  // before the catalog arrived, which is no value at all.
  const limitsRef = useRef(limits);
  limitsRef.current = limits;

  /**
   * A string that changes exactly when the *rows* would change.
   *
   * `sameQuery` compares two configurations and is what the staleness banner
   * uses; this is the same idea as a dependency, so the count effect re-runs on
   * a new filter and not on a renamed header.
   */
  const signature = useMemo(() => {
    const { offset: _offset, limit: _limit, ...rest } = config;
    return JSON.stringify({
      ...rest,
      columns: rest.columns.map((c) => ({ path: c.path, agg: c.agg })),
    });
  }, [config]);
  const problems = useMemo(() => validateConfig(config, root, limits), [config, root, limits]);
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

  /**
   * Loads the first page of saved reports, or appends the next one.
   *
   * The endpoint used to return every report the account can see in one
   * response, each with its whole configuration inside. It is paginated now, so
   * the list says how many it is not showing instead of quietly being all there
   * is.
   */
  const loadSaved = useCallback((append = false) => {
    const offset = append ? savedRef.current.length : 0;
    return getReportesGuardados(tokenRef.current, { offset })
      .then((page) => {
        // Guarded rather than trusted: a response that is not the shape this
        // expects used to leave `reports` undefined and the whole page blank,
        // which is a worse answer than an empty list beside an error.
        const rows = Array.isArray(page?.rows) ? page.rows : [];
        setSaved((current) => (append ? [...current, ...rows] : rows));
        setSavedTotal(Number.isFinite(page?.total) ? page.total : rows.length);
      })
      .catch((error) =>
        toast.error(mensajeDeError(error, "No se pudieron cargar los reportes guardados")));
  }, []);

  const refreshSaved = useCallback(() => loadSaved(false), [loadSaved]);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  // ── Running ────────────────────────────────────────────────────────────────

  /**
   * Runs `target` and stores it alongside the result.
   *
   * It never writes back into `config`: doing so used to revert whatever the
   * user edited while the query was in flight, and could pair a configuration
   * with a different saved report's identity.
   */
  const run = useCallback(async (target: ReportConfig, keepOnError = false) => {
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
      // Clearing is right for Generar: rows from a previous configuration under
      // a header describing a different one is a lie on screen.
      //
      // It is wrong for a page. The failure there is usually transient — a
      // timeout, or the thirty-a-minute limit reached by holding "Siguiente" —
      // and clearing threw away the table the person was reading, disabled both
      // export buttons, and left them re-running the very query that had just
      // timed out. The page they asked for did not arrive; the one they had is
      // still true.
      if (!keepOnError) {
        setResult(null);
        setResultConfig(null);
      }
    } finally {
      if (seq === runSeq.current) setRunning(false);
    }
  }, []);

  /**
   * Adopts a new level of detail, once there is nothing to lose or the loss has
   * been accepted.
   */
  const applyRoot = (cleaned: ReportConfig) => {
    retireInFlight();
    setConfig(cleaned);
    setResult(null);
    setResultConfig(null);
    setPendingRoot(null);
  };

  const handleGenerate = () => {
    if (problems.length > 0) return toast.warning(problems[0]);
    const target = { ...config, offset: 0 };
    setConfig(target);
    void run(target);
  };

  /**
   * The table follows the configuration, instead of waiting to be told.
   *
   * Every change used to leave the table describing a report nobody was asking
   * for any more, with a banner saying so and a button to press: exploring
   * twenty variants was forty actions, half of them the same button. Now the
   * query goes out on its own once the edits stop.
   *
   * Three things keep this from being a mistake. It waits **700 ms of silence**,
   * so a filter value being typed is one query and not one per keystroke. It
   * runs only when the configuration is *valid*, so an incomplete filter is
   * shown as a problem rather than sent. And it only fires when the table no
   * longer matches — `sameQuery` ignores the page, so paging never re-triggers
   * it.
   *
   * The limit is thirty runs a minute per person. Somebody editing steadily
   * commits maybe a dozen changes in that minute, and if the limit is reached
   * anyway the refusal keeps the table it had (`keepOnError`) and the banner
   * comes back with its button — which is what the button is still there for.
   */
  useEffect(() => {
    if (!auto || result === null || problems.length > 0) return;
    // Once per configuration, keyed by what would change the rows. Keying it on
    // "is the table stale" instead re-armed the timer on every render while it
    // stayed stale — including after a page — so a click on Siguiente was
    // answered and then overwritten by page 1 of the edited report.
    if (autoDone.current === signature) return;
    if (resultConfig !== null && sameQuery(configRef.current, resultConfig)) {
      autoDone.current = signature;
      return;
    }

    setAutoPending(true);
    autoTimer.current = setTimeout(() => {
      autoDone.current = signature;
      autoTimer.current = null;
      setAutoPending(false);
      void run({ ...configRef.current, offset: 0 }, true);
    }, 700);

    return () => {
      if (autoTimer.current !== null) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
      setAutoPending(false);
    };
  }, [auto, result, problems.length, signature, resultConfig, run]);

  /**
   * How many rows the current configuration would return, while it is still
   * being written.
   *
   * This is the answer that changes a decision *before* it is taken — a filter
   * that leaves 118 rows and one that leaves 40.000 are different filters — and
   * it is asked far too often to ask for the rows as well. Its own endpoint
   * reads none: one aggregate over the filtered set, on a budget four times
   * larger.
   *
   * Aborted on every change, so only the last question is ever outstanding.
   */
  useEffect(() => {
    if (problems.length > 0) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      contarReporte({ ...configRef.current, offset: 0 }, tokenRef.current, controller.signal)
        .then(({ total }) => setEstimate(total))
        // Silent on purpose: this is a hint beside a button, and a toast for a
        // number nobody asked for out loud would be noise. The real query says
        // what went wrong when it is asked.
        .catch(() => undefined);
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature, problems.length]);

  /** Paging must run the configuration that produced the current page. */
  const handlePage = (offset: number) => {
    if (!resultConfig) return;
    // An explicit click beats a refresh that has not gone out yet. Without
    // this, editing and then paging within the same second gave you the page
    // you asked for and replaced it a moment later with page 1 of a different
    // report. Cancelling here also stops it re-arming, so the configuration
    // stays un-run — and the banner below says so, which is the honest state:
    // you chose to keep reading this table.
    if (autoTimer.current !== null) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
      autoDone.current = signature;
      setAutoPending(false);
    }
    void run({ ...resultConfig, offset }, true);
  };

  // ── Column and filter editing ──────────────────────────────────────────────
  //
  // Identity-stable on purpose: see `configRef`. None of these calls a toast
  // from inside a state updater — an updater has to be pure, React invokes it
  // twice in development to prove it, and every warning fired from one appeared
  // twice on screen.

  const handleMove = useCallback((from: number, to: number) => {
    setConfig((c) => moveColumn(c, from, to));
  }, []);

  const handleRemoveColumn = useCallback((index: number) => {
    setConfig((c) => removeColumn(c, index));
  }, []);

  const handleRename = useCallback((index: number, label: string) => {
    setConfig((c) => renameColumn(c, index, label));
  }, []);

  const handleSetAgg = useCallback((index: number, agg?: AggFn) => {
    const next = setColumnAgg(configRef.current, index, agg);
    if (next === configRef.current) {
      return toast.warning("Ya hay una columna igual con ese resumen.");
    }
    setConfig(next);
  }, []);

  const handleToggleGroup = useCallback((index: number) => {
    const before = configRef.current;
    const next = toggleGroupBy(before, index);
    // Grouping strips the aggregates from every column sharing that path and
    // collapses what is left over into one. That is the right behaviour and it
    // used to happen in silence: two columns became one and the summaries the
    // person had chosen were gone with no explanation.
    const lost = before.columns.length - next.columns.length;
    if (lost > 0) {
      toast.info(
        `Se juntaron ${lost + 1} columnas en una: una columna agrupada no lleva resumen.`,
      );
    }
    setConfig(next);
  }, []);

  const handleToggleSort = useCallback((path: string, agg?: AggFn) => {
    const current = configRef.current;
    const already = (current.sort ?? []).some((s) => s.path === path && s.agg === agg);
    if (!already && sortLimitReached(current, limitsRef.current)) {
      return toast.warning(
        `Ya hay ${maxSorts(limitsRef.current)} criterios de orden. Quite alguno para añadir otro.`,
      );
    }
    setConfig(toggleSort(current, path, agg, limitsRef.current));
  }, []);

  const handleUpdateFilter = useCallback((index: number, patch: Partial<FilterCondition>) => {
    setConfig((c) => updateFilter(c, index, patch));
  }, []);

  const handleRemoveFilter = useCallback((index: number) => {
    setConfig((c) => removeFilter(c, index));
  }, []);

  const handleSetJoin = useCallback((op: "and" | "or") => {
    setConfig((c) => setFilterJoin(c, op));
  }, []);

  // ── Saved reports ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setCurrent(null);
    setSaveName("");
    setSaveDescription("");
    setSaveShared(false);
  };

  /**
   * Retires whatever is still in flight.
   *
   * `run` bumps this on the way out and checks it on the way back, but nothing
   * else did — so clearing the table was not enough: a response from a report
   * abandoned eight seconds ago still passed the check and wrote itself in.
   * The screen then showed a full table under an empty configuration, or worse,
   * report A's rows with report B's name on them, and exporting produced a file
   * titled B containing A.
   */
  const retireInFlight = () => {
    runSeq.current += 1;
    // And release the spinner it was holding. `run` clears `running` only when
    // its own sequence is still current — which was safe while `run` was the
    // only writer, because a superseding run set the flag again and cleared it
    // itself. Retiring a request without starting another one left the flag
    // raised with nobody left to lower it: Generar stayed disabled for the rest
    // of the session, and no later action could clear it.
    setRunning(false);
  };

  const handleNew = () => {
    retireInFlight();
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
      // Updating only ever touches your own report; someone else's is copied,
      // and so is your own when this role may create but not edit.
      const report = current && isMine && mayEdit
        ? await actualizarReporte(current.id, payload, tokenRef.current)
        : await crearReporte(payload, tokenRef.current);
      setCurrent(report);
      setSaveName(report.name);
      setSaveOpen(false);
      refreshSaved();
      toast.success(current && isMine && mayEdit ? "Reporte actualizado" : "Reporte guardado");
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
    //
    // Through `pruneToCatalog`, not `changeRoot`: the detail level is not
    // changing — it is the one the report was saved with — and `changeRoot`
    // deleted every advanced filter on its way past, available or not. A report
    // narrowed to "eventos con alguna revisión en mayo" opened as "todos los
    // eventos", the warning blamed the reader's profile, and saving wrote the
    // widened version back over the original.
    const cleaned = { ...pruneToCatalog(report.config, target), offset: 0 };
    // Two prunes, one number. The server drops what this account may not see
    // before the configuration ever arrives — it used to publish those paths,
    // filter values included — and this one drops what the catalog no longer
    // has at all. Counting only the local one made the warning disappear for
    // exactly the case it was written for.
    const dropped =
      (report.omitted ?? 0) + elementCount(report.config) - elementCount(cleaned);

    retireInFlight();
    setConfig(cleaned);
    setCurrent(report);
    setSaveName(report.name);
    setSaveDescription(report.description ?? "");
    setSaveShared(report.visibility === "shared");
    setResult(null);
    setResultConfig(null);

    if (dropped > 0) {
      // Not "que su perfil no puede consultar": a piece can also be missing
      // because the field was retired from the catalog, and naming the wrong
      // cause sends people to ask for a permission that would not help.
      toast.warning(
        `«${report.name}» se abrió sin ${dropped} elemento${dropped === 1 ? "" : "s"} que ya no están disponibles.`,
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

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportBytes, setExportBytes] = useState(0);
  const exportAbort = useRef<AbortController | null>(null);

  /** Whether the report has anything to embed, which decides if the switch shows. */
  const hasPhotoColumns = useMemo(
    () => (result?.columns ?? []).some((column) => column.kind === "image"),
    [result],
  );
  const [withPhotos, setWithPhotos] = useState(true);

  const exportTitle = (current?.name ?? saveName).trim() || "Reporte";

  /**
   * The root that produced the table, not the one being edited.
   *
   * Today they cannot differ: both places that change the detail level — the
   * selector and opening a saved report — clear the result along with it. This
   * does not depend on that holding. The subtitle describes `resultConfig`, and
   * captioning an event report with "una fila por poste" is a file that
   * describes itself wrongly, which is worse than one that says nothing.
   */
  const resultRoot = useMemo(
    () => catalog?.roots.find((r) => r.key === resultConfig?.root),
    [catalog, resultConfig?.root],
  );
  const exportSubtitle = resultConfig ? describeConfig(resultConfig, resultRoot) : description;

  /**
   * Asks the server for the file.
   *
   * The configuration travels, not the rows. Building it here meant downloading
   * the whole result set as JSON and fetching one photograph per row over HTTP;
   * the server has both already, and reads the photographs off its own disk.
   */
  const runExport = async (format: ExportFormat) => {
    if (!resultConfig || exporting) return;
    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(format);
    setExportBytes(0);
    try {
      const { blob, filename } = await exportarReporte(
        resultConfig,
        {
          format,
          title: exportTitle,
          subtitle: exportSubtitle,
          photos: format === "excel" && hasPhotoColumns && withPhotos,
        },
        tokenRef.current,
        { signal: controller.signal, onProgress: (received) => setExportBytes(received) },
      );
      saveAs(blob, filename);
      toast.success(`${format === "excel" ? "Excel" : "PDF"} descargado`);
    } catch (error) {
      // A cancellation is the user's own doing, not a failure to report.
      if (!axios.isCancel(error)) {
        toast.error(await mensajeDeErrorAsync(
          error,
          `No se pudo generar el ${format === "excel" ? "Excel" : "PDF"}`,
        ));
      }
    } finally {
      exportAbort.current = null;
      setExporting(null);
      setExportBytes(0);
    }
  };

  const cancelExport = () => exportAbort.current?.abort();

  // A request left in flight when the page unmounts would resolve into a
  // component that no longer exists, and keep the server busy for nothing.
  useEffect(() => () => exportAbort.current?.abort(), []);

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
          {/*
            First, not last. It used to sit under the filter list, which can be
            a hundred rows tall, so the most frequent task in the page — running
            a report that already exists — was the one furthest from the top.
          */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base">Reportes guardados</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <SavedReports
                reports={saved}
                total={savedTotal}
                onLoadMore={() => loadSaved(true)}
                currentId={current?.id ?? null}
                currentUserId={currentUserId}
                onOpen={handleOpen}
                // Opening and running are `ver`, which this page already
                // required to load at all. The three that write are not.
                onToggleFavorite={mayEdit ? handleToggleFavorite : undefined}
                onDuplicate={mayCreate ? handleDuplicate : undefined}
                onDelete={mayArchive ? handleDelete : undefined}
              />
            </CardContent>
          </Card>

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
                  if (!next || next.key === config.root) return;
                  // Outside the updater. A state updater must be pure — React
                  // calls it twice in development on purpose — so every one of
                  // these warnings appeared twice, and in concurrent rendering
                  // the double call is not a development-only courtesy.
                  const cleaned = changeRoot(config, next);
                  const lost = elementCount(config) - elementCount(cleaned);
                  // Asked, not announced. This is the most destructive control
                  // on the page dressed as a preference: it throws away columns
                  // and filters, and it used to say so afterwards in a message
                  // that disappears on its own. Somebody who wanted to look at
                  // the other level of detail for a second lost twenty minutes
                  // of work and was told about it by a toast.
                  if (lost > 0) {
                    setPendingRoot({ root: next, cleaned, lost });
                    return;
                  }
                  applyRoot(cleaned);
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
                  onPick={(field: CatalogField) => {
                    // Both refusals used to return the same object, and the
                    // caller had only identity to go on: at sixty columns,
                    // picking a field never added before answered "ya está en
                    // el reporte", which is not true and does not tell anyone
                    // to remove a column.
                    if (columnLimitReached(config, limits)) {
                      return toast.warning(
                        `El reporte ya tiene el máximo de ${maxColumns(limits)} columnas. Quite alguna para añadir otra.`,
                      );
                    }
                    const next = addColumn(config, field.path, undefined, limits);
                    if (next === config) {
                      return toast.warning(`"${field.label}" ya está en el reporte.`);
                    }
                    setConfig(next);
                  }}
                  onPickAggregate={(path, label) => {
                    if (columnLimitReached(config, limits)) {
                      return toast.warning(
                        `El reporte ya tiene el máximo de ${maxColumns(limits)} columnas. Quite alguna para añadir otra.`,
                      );
                    }
                    const next = addColumn(config, path, "count" as AggFn, limits);
                    if (next === config) {
                      return toast.warning(`"${label ?? path}" ya está en el reporte.`);
                    }
                    setConfig(next);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <ColumnList
                config={config}
                root={root}
                onMove={handleMove}
                onRemove={handleRemoveColumn}
                onRename={handleRename}
                onSetAgg={handleSetAgg}
                onToggleGroup={handleToggleGroup}
                onToggleSort={handleToggleSort}
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
                  onPick={(field) => {
                    if (filterLimitReached(config, limits)) {
                      return toast.warning(
                        `El reporte ya tiene el máximo de ${maxConditions(limits)} filtros.`,
                      );
                    }
                    setConfig(addFilter(config, field, limits));
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <FilterBuilder
                config={config}
                root={root}
                onUpdate={handleUpdateFilter}
                onRemove={handleRemoveFilter}
                onSetJoin={handleSetJoin}
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
                  {/* Updating your own report needs `editar` and everything
                      else creates a row and needs `crear` — but holding only
                      `crear` must not lose the button the moment one of your
                      own reports is open: `handleSave` already falls back to
                      creating a copy, and the alternative was telling someone
                      to press Nuevo and rebuild what they wanted to keep. */}
                  {(mayCreate || (current !== null && isMine && mayEdit)) && (
                  <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <SaveIcon className="mr-1.5 h-4 w-4" />
                        {current && isMine && mayEdit ? "Actualizar" : "Guardar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      {current && isMine && mayEdit && (
                        <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          Se sobrescribirá «{current.name}».
                        </p>
                      )}
                      {current && (!isMine || !mayEdit) && (
                        <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          «{current.name}» se guardará como una copia suya.
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
                        {current && isMine && mayEdit ? "Actualizar reporte" : "Guardar reporte"}
                      </Button>
                    </PopoverContent>
                  </Popover>
                  )}

                  {hasPhotoColumns && (
                    <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1">
                      <Switch
                        id="rep-fotos"
                        checked={withPhotos}
                        onCheckedChange={setWithPhotos}
                        disabled={exporting !== null}
                      />
                      <Label htmlFor="rep-fotos" className="cursor-pointer text-xs font-normal">
                        Fotos en el Excel
                      </Label>
                    </div>
                  )}

                  <Button
                    variant="outline" size="sm"
                    disabled={!result || exporting !== null}
                    onClick={() => runExport("excel")}
                  >
                    {exporting === "excel"
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <DownloadIcon className="mr-1.5 h-4 w-4" />}
                    Excel
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={!result || exporting !== null}
                    onClick={() => runExport("pdf")}
                  >
                    {exporting === "pdf"
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <FileTextIcon className="mr-1.5 h-4 w-4" />}
                    PDF
                  </Button>

                  {/* Only while a file is being made. The server sends nothing
                      until it is finished, so there is no honest percentage to
                      show — only how long it has taken and how much has arrived. */}
                  {exporting !== null && (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <span>
                        {exportBytes > 0
                          ? `Descargando ${(exportBytes / 1024 / 1024).toFixed(1)} MB…`
                          : "Generando en el servidor…"}
                      </span>
                      <button
                        type="button"
                        onClick={cancelExport}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  {/* How big the answer is, before asking for it. */}
                  {estimate !== null && problems.length === 0 && (
                    <span className="self-center text-xs tabular-nums text-muted-foreground">
                      {estimate.toLocaleString("es-BO")} fila{estimate === 1 ? "" : "s"}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1">
                    <Switch
                      id="rep-auto"
                      checked={auto}
                      onCheckedChange={setAuto}
                      aria-label="Actualizar la tabla automáticamente"
                    />
                    <Label htmlFor="rep-auto" className="cursor-pointer text-xs font-normal">
                      Auto
                    </Label>
                  </div>

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

              {/*
                Only when nothing is coming. With the table following the
                configuration this appeared for the seven hundred milliseconds
                before the query went out — a warning that solves itself, which
                is how people learn to ignore warnings. `autoPending` is the
                difference between "about to catch up" and "not going to": the
                switch is off, the configuration cannot be run, or a page click
                cancelled the refresh.
              */}
              {stale && !autoPending && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  {problems.length > 0
                    ? "La tabla muestra el resultado anterior: la configuración de arriba todavía no se puede consultar."
                    : "Cambió la configuración: la tabla muestra el resultado anterior. Pulse Actualizar."}
                </div>
              )}

              {result ? (
                <PreviewTable
                  result={result}
                  loading={running}
                  onPage={handlePage}
                  sort={config.sort}
                  onToggleSort={handleToggleSort}
                />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Elija las columnas a la izquierda y pulse <strong>Generar</strong> para verlo aquí.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/*
        The confirmation the level of detail always needed. It names the number
        of pieces at stake and what a row will mean afterwards, because "¿está
        seguro?" on its own asks somebody to guess what they are agreeing to.
      */}
      <AlertDialog
        open={pendingRoot !== null}
        onOpenChange={(open) => { if (!open) setPendingRoot(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Cambiar a «{pendingRoot?.root.rowMeaning.toLowerCase()}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se descartarán {pendingRoot?.lost}{" "}
              {pendingRoot?.lost === 1 ? "elemento" : "elementos"} del reporte
              —columnas, filtros u orden— porque no existen en este nivel de detalle.
              Lo demás se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dejarlo como está</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingRoot) applyRoot(pendingRoot.cleaned); }}
            >
              Cambiar y descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GeneradorPage;
