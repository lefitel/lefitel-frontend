import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon, ArchiveIcon, ChevronDownIcon, CopyIcon, DownloadIcon, FilePlus2Icon,
  FileTextIcon, Loader2Icon, LockIcon, PlayIcon, RefreshCwIcon, SaveIcon, StarIcon, UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { cn } from "../../../lib/utils";
import {
  actualizarReporte, contarReporte, crearReporte, duplicarReporte, eliminarReporte,
  exportarReporte, getCatalogo, getReportesGuardados, getReporteGuardado, mensajeDeError, mensajeDeErrorAsync,
  runReporte,
  type AggFn, type Catalog, type CatalogField, type CatalogRoot, type ExportFormat,
  type FilterCondition,
  type ReportConfig, type ReportResult, type ReportTemplate, type SavedReport,
} from "../../../api/generador.api";
import {
  addColumn, addFilter, changeRoot, columnLimitReached, describeConfig, elementCount,
  emptyConfig, filterLimitReached, isSummary, maxColumns, maxConditions, maxSorts,
  moveColumnByKey,
  moveSortByKey, flipSort, removeSort,
  pruneToCatalog, removeColumn, removeFilter, renameColumn, sameQuery, sameShape, setColumnAgg,
  signatureOf, fieldLabel, withExtraFields,
  setFilterJoin, sortLimitReached, toggleGroupBy, toggleSort, updateFilter, validateConfig,
  clearFilters,
  withPageSize,
} from "../../../lib/reportConfig";
import axios from "axios";
import { saveAs } from "file-saver";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
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
import { Skeleton } from "../../../components/ui/skeleton";
import { Switch } from "../../../components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip";
import { Textarea } from "../../../components/ui/textarea";

import CardHelp from "./CardHelp";
import ColumnList from "./ColumnList";
import FieldPicker from "./FieldPicker";
import FilterBuilder from "./FilterBuilder";
import PageHelp from "./PageHelp";
import PreviewTable from "./PreviewTable";
import ReportPicker from "./ReportPicker";
import ShapePreview from "./ShapePreview";
import SortOrder from "./SortOrder";
import { PageSkeleton, ResultSkeleton } from "./Skeletons";

/**
 * Whether the table refreshes itself, remembered per browser.
 *
 * It used to be `useState(true)`: on for everyone, every time, and the tooltip
 * asked the reader to turn it off "si el reporte tarda" — advice for somebody
 * who cannot know that yet and who, having found out the hard way, arrived the
 * next morning with it on again. A switch that forgets is a switch that has to
 * be flicked every session by the people it costs the most.
 *
 * So the default is the cheap one. A refresh is a real query — rows, joins, up
 * to fifteen seconds — against a budget of thirty a minute shared with the
 * fixed reports on Informes, and nobody asked for it out loud. What tells you a
 * filter is working is the row count beside the button, which is a different
 * endpoint, four times the budget, and reads no rows at all.
 *
 * Per browser and not per account: it is about how this person works on this
 * screen, and it is not worth a column in the database. Storage refuses
 * outright in a private window or with site data blocked, and both ends are
 * wrapped: failing to read means the safe default, failing to write means the
 * choice lasts the session.
 */
const AUTO_KEY = "osefi-generador-auto";

const readAutoPreference = (): boolean => {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
};

const writeAutoPreference = (value: boolean): void => {
  try {
    localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  } catch {
    // In memory only: the switch holds for this session and forgets on reload.
  }
};

/** `fieldLabel` answers with the path itself when it does not know the field. */
const nameOrNothing = (name: string, path: string): string | undefined =>
  name === path ? undefined : name;

const GeneradorPage = () => {
  const { sesion } = useContext(SesionContext);
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
  /** Confirmation for emptying a filter list long enough to be worth rebuilding. */
  const [clearingFilters, setClearingFilters] = useState(false);
  /** The "Nuevo" confirmation, open only when there is something to discard. */
  const [discarding, setDiscarding] = useState(false);
  /**
   * How much of the report the exported file holds.
   *
   * "all" is what this always did and stays the default — a file of the whole
   * report is what somebody exporting one usually wants. What was missing was
   * the other answer and, more to the point, the admission: pressing Excel on
   * page 4 produced a file starting at row 1 and nothing said so.
   */
  const [exportScope, setExportScope] = useState<"all" | "page">("all");
  const [exportOpen, setExportOpen] = useState(false);
  /** A level-of-detail change waiting to be confirmed, and what it would cost. */
  const [pendingRoot, setPendingRoot] = useState<
    { root: CatalogRoot; cleaned: ReportConfig; lost: number } | null
  >(null);
  /**
   * Whether the table follows the configuration on its own.
   *
   * Both ways of working are real: for a report being explored, refreshing
   * itself is the whole point, and for one that takes eight seconds over a year
   * of events it is a tax. Off until asked for, and then remembered — see
   * `readAutoPreference`. The switch is next to the button it replaces.
   */
  const [auto, setAutoState] = useState(readAutoPreference);
  const setAuto = useCallback((next: boolean) => {
    setAutoState(next);
    writeAutoPreference(next);
  }, []);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedFailed, setSavedFailed] = useState(false);
  /**
   * Whether a page of saved reports is in flight.
   *
   * Starts true: this and the catalog are both asked for on mount, and the
   * catalog is a fixed structure while this one joins `usuarios` and reads the
   * database, so the catalog usually wins. The page would then render with an
   * empty list and the panel would state, in the reader's first second on the
   * screen, that they had never saved a report.
   */
  const [loadingSaved, setLoadingSaved] = useState(true);
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

  /** Discards responses from a request the user has already superseded. */
  const runSeq = useRef(0);
  /** And hangs up on it, so the server stops working on the answer. */
  const runAbort = useRef<AbortController | null>(null);
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

  /**
   * Fields the open report uses and the picker does not list.
   *
   * The server runs more than its menu offers — a path that reaches an entity
   * the long way round, a parent's own totals — and a saved report can name
   * one. It sends what each of those is along with the report; kept here so the
   * report goes on being readable after it is saved, when the answer to the
   * save carries nothing but the row.
   */
  const [extraFields, setExtraFields] = useState<CatalogField[]>([]);
  /** The same for to-many relations: a count or an «existe» on one. */
  const [extraRelations, setExtraRelations] = useState<CatalogRoot["aggregateOnly"]>([]);
  /**
   * Bumped whenever the screen starts being about a different report: one
   * opened, a template loaded, Nuevo. A save or an archive that answers late
   * compares it, so it cannot pin its own report's identity onto whatever was
   * opened while it travelled.
   */
  const identitySeq = useRef(0);

  /** The level of detail as the picker offers it. */
  const menuRoot = useMemo(
    () => catalog?.roots.find((r) => r.key === config.root),
    [catalog, config.root],
  );
  /** And as everything else reads it: with the open report's extra fields. */
  const root = useMemo(
    () => (menuRoot ? withExtraFields(menuRoot, extraFields, extraRelations) : undefined),
    [menuRoot, extraFields, extraRelations],
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
   * a new filter and not on a renamed header. It lives beside `sameQuery` now,
   * where it can be built the same way and read by the handlers below.
   */
  const signature = useMemo(() => signatureOf(config), [config]);

  /**
   * The configuration on screen and the current signature, readable from the
   * handlers that never change — same reason as `configRef`.
   */
  const resultConfigRef = useRef(resultConfig);
  resultConfigRef.current = resultConfig;
  const signatureRef = useRef(signature);
  signatureRef.current = signature;

  /**
   * Disarms a refresh that has not gone out yet, and stops it re-arming.
   *
   * Every control that runs something itself calls this first — Generar, a
   * page, a page size, an order: an explicit
   * click beats a refresh that is still counting down. Without it, editing and
   * then paging within the same second gave you the page you asked for and
   * replaced it a moment later with page 1 of a different report. Marking the
   * signature as dealt with is what stops the effect arming it straight back.
   */
  const cancelAutoRefresh = useCallback(() => {
    if (autoTimer.current === null) return;
    clearTimeout(autoTimer.current);
    autoTimer.current = null;
    autoDone.current = signatureRef.current;
    setAutoPending(false);
  }, []);
  const problems = useMemo(() => validateConfig(config, root, limits), [config, root, limits]);
  /** Read by the ordering handlers, which never change identity. */
  const problemsRef = useRef(problems);
  problemsRef.current = problems;
  const chosen = useMemo(() => new Set(config.columns.map((c) => c.path)), [config.columns]);
  // The fields that already carry a filter, for the same tick the column picker
  // gives a column already added. Only the conditions the panel lists by field
  // name: a group or an existence filter is not "a filter on" any one field.
  const filtered = useMemo(
    () => new Set(
      (config.filters?.conditions ?? []).flatMap((node) => ("path" in node ? [node.path] : [])),
    ),
    [config.filters],
  );
  const description = useMemo(() => describeConfig(config, root), [config, root]);

  /** True when the table on screen no longer matches the configuration above it. */
  const stale = useMemo(
    () => result !== null && resultConfig !== null && !sameQuery(config, resultConfig),
    [result, resultConfig, config],
  );

  /**
   * Whether the table on screen can still stand for what is being built.
   *
   * Stale is not enough on its own. A changed filter value leaves every column
   * where it was, so the rows are still a fair picture and taking them away
   * would cost the reader the row they were reading. Adding, removing, moving
   * or grouping a column is different in kind: the table simply does not have
   * that column, and no amount of real data in it shows the one being made.
   */
  const shapeChanged = useMemo(
    () => resultConfig !== null && !sameShape(config, resultConfig),
    [config, resultConfig],
  );
  /** The real table is shown while it still describes the configuration's shape. */
  const showsResult = result !== null && !shapeChanged;
  /**
   * The headers of the table on screen, where they have been renamed since it
   * was generated.
   *
   * A rename changes no row, so the table stays (`sameShape`) and nothing
   * re-runs for it (`signatureOf`) — which leaves the result carrying the old
   * name. Same shape means the same columns in the same order, so position is
   * enough to pair them. Untouched headers stay undefined and keep the name the
   * server gave them.
   */
  const liveHeaders = useMemo(() => {
    if (!showsResult || !resultConfig) return undefined;
    return config.columns.map((column, i) =>
      (column.label ?? "") === (resultConfig.columns[i]?.label ?? "")
        ? undefined
        // The author's name, or — the name having been cleared — the one the
        // server gives an unnamed column: the catalog's, with no summary after
        // it. `columnHeader` adds «(conteo)» there and the server does not, so
        // the header read one thing until the next Generar and another after.
        // A path the catalog has no name for keeps the header it came with.
        : column.label?.trim() || nameOrNothing(fieldLabel(root, column.path), column.path));
  }, [showsResult, resultConfig, config.columns, root]);
  /**
   * The shape drawn from the configuration alone, with sample values.
   *
   * Distinct from the skeleton: grey bars say "the real values are on their
   * way", and this says "this is the table you are building". The two never
   * appear at once — a query in flight always wins, because then the values
   * really are coming.
   */
  const previewing = config.columns.length > 0 && !showsResult && !running;
  /**
   * Whether there is a generated report to put in a file.
   *
   * A result is not enough. Once the columns have changed, what is on screen is
   * a sample of a report nobody has generated, and the export — which sends the
   * configuration that produced the last table — handed over a file without
   * the column just added, under «Excel descargado». The banner that explains
   * a stale table is not shown then either, because there is no table.
   */
  const canExport = result !== null && !shapeChanged;
  // More rows than one page holds: only then is "this page" a different file.
  const exportPaged = result !== null && result.total > result.limit;
  const exportRows = result === null ? 0
    : exportPaged && exportScope === "page"
      ? Math.min(result.limit, result.total - result.offset)
      : result.total;

  /**
   * Filters as the panel lists them, which is the top level only.
   *
   * A nested group shows as one "Filtro avanzado" row however many conditions
   * it holds, so counting the tree would offer to remove "todos los 9" over a
   * list of three rows.
   */
  const filterCount = config.filters?.conditions?.length ?? 0;

  const isMine = current === null || current.id_usuario === currentUserId;
  /**
   * Whether "Nuevo" has anything to do.
   *
   * On a page that is already blank it clears nothing, closes nothing and
   * announces "Reporte nuevo en blanco" — which was the only evidence anything
   * had happened, about a change that had not. Both the button's state and the
   * confirmation read this, so the two can never disagree: if there is nothing
   * to discard the button is off, and if the button is on there is something
   * to ask about.
   */
  const somethingToDiscard = elementCount(config) > 0 || current !== null;
  /** Written the same way the list writes it, so one report reads one way. */
  const author = current?.usuario?.name
    ? `${current.usuario.name} ${current.usuario.lastname ?? ""}`.trim()
    : null;

  // ── Loading ────────────────────────────────────────────────────────────────

  const loadCatalog = useCallback(() => {
    setLoadingCatalog(true);
    setCatalogError(false);
    getCatalogo()
      .then((data) => {
        setCatalog(data);
        const first = data.roots[0];
        // Only seed the root the very first time; never reset a configuration
        // the user has already built.
        setConfig((c) => (data.roots.some((r) => r.key === c.root) ? c : emptyConfig(first.key)));
      })
      .catch((error) => {
        setCatalogError(true);
        toast.error(mensajeDeError(error, "No se pudieron cargar los campos disponibles"));
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
    setLoadingSaved(true);
    return getReportesGuardados({ offset })
      .then((page) => {
        // Guarded rather than trusted: a response that is not the shape this
        // expects used to leave `reports` undefined and the whole page blank,
        // which is a worse answer than an empty list beside an error.
        const rows = Array.isArray(page?.rows) ? page.rows : [];
        setSaved((current) => (append ? [...current, ...rows] : rows));
        setSavedTotal(Number.isFinite(page?.total) ? page.total : rows.length);
        setSavedFailed(false);
      })
      .catch((error) => {
        // Remembered, not only announced. The toast disappears and the panel
        // used to go on saying "Todavía no hay reportes guardados" — a claim
        // about the user's data made out of a failed request.
        setSavedFailed(true);
        toast.error(mensajeDeError(error, "No se pudieron cargar los reportes guardados"));
      })
      // In `finally`, so a failure releases it too: a skeleton that outlives the
      // request it belongs to is a panel that waits forever, and it would hide
      // the very error state below that says the list could not be read.
      .finally(() => setLoadingSaved(false));
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
    // Hanging up on the one it supersedes, not merely ignoring its answer.
    //
    // `runSeq` already threw the late reply away, which is all the screen
    // needed and none of what the database needed: the query itself ran to
    // completion, so three edits a second apart put three of them on the server
    // at once and used one. They are the expensive kind — rows, joins, up to
    // fifteen seconds each — and the cost lands on everyone, not on the person
    // editing. `abort` closes the socket; the connection goes back and the
    // statement dies with it.
    runAbort.current?.abort();
    const controller = new AbortController();
    runAbort.current = controller;
    setRunning(true);
    try {
      const data = await runReporte(target, controller.signal);
      if (seq !== runSeq.current) return false;   // a newer request already went out
      setResult(data);
      setResultConfig(target);
      // Blaming the filters is only honest when there are some. A revision
      // report whose events are all archived comes back empty through
      // requiredParentGuards, with the filter panel saying "Sin filtros".
      if (data.total === 0) {
        toast.warning(
          (target.filters?.conditions?.length ?? 0) > 0
            ? "Ningún registro coincide con estos filtros."
            : "El reporte no devolvió ningún registro.",
        );
      }
      return true;
    } catch (error) {
      if (seq !== runSeq.current) return false;
      // A cancellation is this screen's own doing — a newer run, or the reader
      // leaving the page — and the only one that reaches here is the leaving:
      // a superseded run has an older sequence and returned on the line above.
      if (axios.isCancel(error)) return false;
      toast.error(mensajeDeError(error, "No se pudo generar el reporte"));
      // Clearing is right for Generar: rows from a previous configuration under
      // a header describing a different one is a lie on screen.
      //
      // It is wrong for a page. The failure there is usually transient — a
      // timeout, or the thirty-a-minute limit reached by holding "Siguiente"
      // (a budget shared with the six fixed reports since B3, so it may also
      // have been spent on the Informes screen) —
      // and clearing threw away the table the person was reading, disabled both
      // export buttons, and left them re-running the very query that had just
      // timed out. The page they asked for did not arrive; the one they had is
      // still true.
      if (!keepOnError) {
        setResult(null);
        setResultConfig(null);
      }
      return false;
    } finally {
      if (seq === runSeq.current) {
        setRunning(false);
        runAbort.current = null;
      }
    }
  }, []);

  /** Nobody is waiting for it once the screen is gone. */
  useEffect(() => () => runAbort.current?.abort(), []);

  /**
   * Adopts a new level of detail, once there is nothing to lose or the loss has
   * been accepted.
   */
  const applyRoot = (cleaned: ReportConfig) => {
    retireInFlight();
    setExtraFields([]);
    setExtraRelations([]);
    setConfig(cleaned);
    setResult(null);
    setResultConfig(null);
    setPendingRoot(null);
  };

  const handleGenerate = () => {
    if (problems.length > 0) return toast.warning(problems[0]);
    // Before anything goes out. Moving to the first page does not change what
    // the refresh is keyed on, so a refresh armed by the last edit stayed armed
    // behind this click, fired, hung up on this very request and asked for the
    // same report again: two of the thirty runs a minute, and the wait started
    // over. Only a slow report showed it — a fast one landed first.
    cancelAutoRefresh();
    const target = { ...config, offset: 0 };
    autoDone.current = signatureOf(target);
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
   * The limit is thirty runs a minute per person, and since B3 it is **one
   * budget with the six fixed reports** on the Informes screen: a run here and
   * a Generar there spend the same thirty. Somebody editing steadily commits
   * maybe a dozen changes in that minute, and if the limit is reached anyway
   * the refusal keeps the table it had (`keepOnError`) and the banner comes
   * back with its button — which is what the button is still there for. The
   * other direction is the one to remember when a 429 shows up on Informes:
   * this auto-run can have spent it.
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
    // Cleared before asking, not only when the configuration is invalid.
    //
    // Every failure here is swallowed below — the 120/min limiter, the fifteen
    // second timeout, a dropped connection — and without this line the previous
    // configuration's number stayed on screen looking exactly like a fresh
    // answer. "40.532 filas" beside Generar, for a filter that leaves 118, is
    // worse than no number at all.
    setEstimate(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      contarReporte({ ...configRef.current, offset: 0 }, controller.signal)
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
    // The configuration stays un-run — and the banner below says so, which is
    // the honest state: you chose to keep reading this table.
    cancelAutoRefresh();
    void run({ ...resultConfig, offset }, true);
  };

  /**
   * Changes how many rows a page holds, and asks for the first one again.
   *
   * Runs `resultConfig` and not `config`, exactly as paging does: resizing the
   * table you are reading must not also apply half-finished edits you have not
   * asked for yet. The size lands on the configuration too, so it survives into
   * the saved report — it is part of what a report is, and until now it was the
   * one part of it nobody could choose.
   */
  const handlePageSize = (limit: number) => {
    if (!resultConfig) {
      setConfig((c) => ({ ...c, limit }));
      return;
    }
    cancelAutoRefresh();
    // On the configuration once the page is here, not before. Written first, a
    // page that failed left the table and its selector at the old size while
    // the configuration held the new one — nothing on screen said so, and
    // Guardar stored a size the reader had never seen applied.
    void run({ ...resultConfig, limit, offset: 0 }, true).then((landed) => {
      if (landed) setConfig((c) => ({ ...c, limit }));
    });
  };

  // ── Column and filter editing ──────────────────────────────────────────────
  //
  // Identity-stable on purpose: see `configRef`. None of these calls a toast
  // from inside a state updater — an updater has to be pure, React invokes it
  // twice in development to prove it, and every warning fired from one appeared
  // twice on screen.

  /**
   * Reordering by dragging, named by key and never by position.
   *
   * The two ↑↓ buttons this replaces moved a column one place per press, which
   * is eleven presses to bring the twelfth column to the front. The keys come
   * from `columnKeys`, so two columns of the same field — the minimum and the
   * maximum of one date — are told apart, which position never could.
   */
  const handleReorder = useCallback((from: string, to: string) => {
    setConfig((c) => moveColumnByKey(c, from, to));
  }, []);

  /**
   * The three that act on the sort order once there is more than one criterion.
   *
   * The order of that list is what the server writes `ORDER BY` from, and until
   * now it was whatever sequence the buttons happened to be pressed in, with no
   * way to see it and no way to change it short of switching every sort off and
   * back on.
   */
  /**
   * Re-orders the table on screen, when a change of order is all that is asked.
   *
   * Ordering used to only edit the configuration and wait for the automatic
   * refresh to notice. That was invisible while the refresh was on for
   * everybody, and it is the whole behaviour of the control now that it is not:
   * clicking an arrow that says "ordenar la tabla por Fecha" would move the
   * arrow, raise a banner, and leave every row exactly where it was.
   *
   * Two conditions, and both are about honesty rather than caution.
   *
   * It runs `next` — the whole configuration — and never the order grafted onto
   * the one that produced the table. That graft is how paging works and it is
   * wrong here: an order carries the aggregate of the column it sorts, the
   * server refuses an aggregated order in a report that does not summarise
   * (`sqlBuilder`), and a grouping added since the last run lives in one of the
   * two halves. The mixture is a configuration nobody validated, and it comes
   * back as a red error about a report that is on screen and perfectly legal.
   *
   * So it only runs when the order is the *only* thing outstanding. With edits
   * waiting in the panel, an order is not permission to apply them — that is
   * what Generar is for, and what the banner already says. The reader keeps the
   * table they were reading.
   */
  const runOrderNow = useCallback((next: ReportConfig) => {
    const shown = resultConfigRef.current;
    if (!shown) return;                            // nothing on screen to order
    if (problemsRef.current.length > 0) return;    // and nothing runnable to send
    if (!sameQuery({ ...next, sort: shown.sort }, shown)) return;

    cancelAutoRefresh();
    // The query going out *is* the configuration, so the refresh has nothing
    // left to do. Saying so is what stops a slow report being asked for twice:
    // the timer would otherwise arm behind this run and fire before it landed.
    autoDone.current = signatureOf(next);
    void run({ ...next, offset: 0 }, true);
  }, [cancelAutoRefresh, run]);

  /*
   * The other three ordering controls, in the strip under the column list.
   *
   * They change the same ORDER BY as the arrow on a column, so they run the
   * same way — through `runOrderNow`, which decides whether the table can be
   * re-ordered where it stands. Leaving them behind would have been the worse
   * half of a half-done change: the arrow on the pill re-orders the table, and
   * the control directly beneath it that says "dejar de ordenar por Resuelto"
   * moves an arrow and leaves every row where it was. Reordering the criteria
   * is the one that changes the answer most, and it was the most inert.
   */
  const handleSortReorder = useCallback((from: string, to: string) => {
    const next = moveSortByKey(configRef.current, from, to);
    setConfig(next);
    runOrderNow(next);
  }, [runOrderNow]);
  const handleSortFlip = useCallback((key: string) => {
    const next = flipSort(configRef.current, key);
    setConfig(next);
    runOrderNow(next);
  }, [runOrderNow]);
  const handleSortRemove = useCallback((key: string) => {
    const next = removeSort(configRef.current, key);
    setConfig(next);
    runOrderNow(next);
  }, [runOrderNow]);

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
        `Ya hay ${maxSorts(limitsRef.current)} criterios de orden. Pulse otra vez la flecha` +
        ` de una columna ya ordenada, hasta apagarla, para liberar uno.`,
      );
    }
    const next = toggleSort(current, path, agg, limitsRef.current);
    setConfig(next);
    runOrderNow(next);
  }, [runOrderNow]);

  const handleUpdateFilter = useCallback((
    index: number, patch: Partial<FilterCondition>, listed?: boolean,
  ) => {
    setConfig((c) => updateFilter(c, index, patch, listed));
  }, []);

  const handleRemoveFilter = useCallback((index: number) => {
    setConfig((c) => removeFilter(c, index));
  }, []);

  const handleSetJoin = useCallback((op: "and" | "or") => {
    setConfig((c) => setFilterJoin(c, op));
  }, []);

  // ── Saved reports ──────────────────────────────────────────────────────────

  const resetForm = () => {
    // The screen stops being about that report, so an answer still travelling
    // for it must not bring it back: a slow «Actualizar» that landed after the
    // report had been archived pinned the archived report open again.
    identitySeq.current += 1;
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
    // And hangs up, for the same reason `run` does when it supersedes one:
    // opening a saved report while a fifteen-second query is running used to
    // leave that query holding a connection to the end, for an answer this
    // screen had already promised itself to throw away.
    runAbort.current?.abort();
    runAbort.current = null;
    // And release the spinner it was holding. `run` clears `running` only when
    // its own sequence is still current — which was safe while `run` was the
    // only writer, because a superseding run set the flag again and cleared it
    // itself. Retiring a request without starting another one left the flag
    // raised with nobody left to lower it: Generar stayed disabled for the rest
    // of the session, and no later action could clear it.
    setRunning(false);
  };

  const applyNew = () => {
    retireInFlight();
    identitySeq.current += 1;
    setExtraFields([]);
    setExtraRelations([]);
    setConfig(emptyConfig(root?.key ?? catalog?.roots[0]?.key ?? "evento"));
    setResult(null);
    setResultConfig(null);
    resetForm();
    toast.info("Reporte nuevo en blanco");
  };

  /**
   * Asked, not announced — the same treatment the level of detail was given,
   * and for the same reason.
   *
   * This empties the configuration, closes whatever report was open and throws
   * away the table, and it used to say so *afterwards*, in a message that
   * disappears on its own. It now sits beside the button that saves, where a
   * press meant for one is a press away from the other.
   *
   * Nothing is asked when there is nothing to lose: a confirmation on an empty
   * page is how people learn to confirm without reading.
   */
  const handleNew = () => {
    if (somethingToDiscard) {
      setDiscarding(true);
      return;
    }
    applyNew();
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (name === "") return toast.warning("El reporte necesita un nombre");
    if (problems.length > 0) return toast.warning(problems[0]);
    if (saving) return;

    setSaving(true);
    const openedAs = identitySeq.current;
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
        ? await actualizarReporte(current.id, payload)
        : await crearReporte(payload);
      // Only while the screen is still about the report that was saved. The
      // popover is not modal, so another report can be opened while this
      // travels — and pinning this one's identity onto that one's
      // configuration made the next «Actualizar» write B over A.
      if (openedAs === identitySeq.current) {
        setCurrent(report);
        setSaveName(report.name);
        setSaveOpen(false);
      }
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
    // `withPageSize` because a stored configuration can predate the page-size
    // control, and "no limit" is not a neutral value: the server reads it as
    // 500 while everything this screen builds says 100.
    //
    // Against the root *with this report's extra fields*: the server sends what
    // a valid path the picker does not list is, and pruning against the bare
    // menu dropped exactly those — a column the server had just kept.
    const extras = Array.isArray(report.extraFields) ? report.extraFields : [];
    const relations = Array.isArray(report.extraRelations) ? report.extraRelations : [];
    const cleaned = withPageSize({
      ...pruneToCatalog(report.config, withExtraFields(target, extras, relations)),
      offset: 0,
    });
    // Two prunes, one number. The server drops what this account may not see
    // before the configuration ever arrives — it used to publish those paths,
    // filter values included — and this one drops what the catalog no longer
    // has at all. Counting only the local one made the warning disappear for
    // exactly the case it was written for.
    const dropped =
      (report.omitted ?? 0) + elementCount(report.config) - elementCount(cleaned);

    retireInFlight();
    identitySeq.current += 1;
    setExtraFields(extras);
    setExtraRelations(relations);
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
      //
      // "al menos" because the number is a floor, not a count: both prunes drop
      // a nested filter group whole while counting it as one, so a single
      // "Filtro avanzado" holding three conditions arrives here as 1. The
      // server's own comment already described the message as saying "at least
      // this much" — it did not, and stating a bare number over an undercount
      // is how a report opens materially wider than its author built it.
      const one = dropped === 1;
      toast.warning(
        `«${report.name}» se abrió sin al menos ${dropped} elemento${one ? "" : "s"}` +
        ` —columnas, filtros, orden o agrupación— que ya no ${one ? "está" : "están"}` +
        ` disponible${one ? "" : "s"}. Si lo guarda ahora, la pérdida será permanente.`,
      );
    } else {
      toast.info(`«${report.name}» cargado. Pulse Generar para verlo.`);
    }
  };

  /**
   * `?vista=12`, which is how the Bitácora links to a saved report.
   *
   * Asked for by id rather than looked up in `saved`: that list is a page, and
   * the report may not be on it. Waits for the catalog because `handleOpen`
   * prunes against it. Attended once and taken out of the address, so a reload
   * does not open it again over whatever has been built since.
   *
   * The builder is usable from the moment the catalog arrives, and this answer
   * arrives after. Whatever was started in between is not overwritten: opening
   * from the picker is a gesture and may replace the work; this is not one.
   *
   * A refusal is shown in the server's own words — "es privado", "no existe".
   */
  const [parametros, setParametros] = useSearchParams();
  const vistaPedida = Number(parametros.get("vista")) || null;
  const vistaAtendida = useRef(false);
  const algoQuePerder = useRef(somethingToDiscard);
  algoQuePerder.current = somethingToDiscard;
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  useEffect(() => {
    if (!vistaPedida || !catalog || vistaAtendida.current) return;
    vistaAtendida.current = true;
    setParametros((actuales) => { actuales.delete("vista"); return actuales; }, { replace: true });
    getReporteGuardado(vistaPedida)
      .then((report) => {
        if (!montado.current) return;
        if (algoQuePerder.current) {
          toast.info(`«${report.name}» no se abrió para no pisar lo que ya tiene en pantalla. Está en sus reportes guardados.`);
          return;
        }
        handleOpen(report);
      })
      .catch((error) => {
        if (montado.current) toast.error(mensajeDeError(error, "No se pudo abrir el reporte"));
      });
    // `handleOpen` is a new function on every render and reads nothing that
    // changes between this one and the answer: the catalog is already in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaPedida, catalog, setParametros]);

  /**
   * Loads a template into the builder.
   *
   * Deliberately not `handleOpen`. A template is not a saved report: `current`
   * stays null, so the save button goes on saying "Guardar" and cannot
   * overwrite anything — pressing "Actualizar" over a template would be
   * overwriting a report the reader never made. The name is pre-filled as a
   * courtesy and can be typed over; nothing is written until they save.
   *
   * No pruning here: the server already fitted the template to this viewer
   * before sending it, and refuses to send one it could not fit whole.
   */
  const handlePickTemplate = (template: ReportTemplate) => {
    retireInFlight();
    identitySeq.current += 1;
    setExtraFields([]);
    setExtraRelations([]);
    setConfig(withPageSize({ ...template.config, offset: 0 }));
    setCurrent(null);
    setSaveName(template.name);
    setSaveDescription(template.description);
    setSaveShared(false);
    setResult(null);
    setResultConfig(null);
    toast.info(`«${template.name}» cargado. Cámbielo a su gusto y pulse Generar.`);
  };

  const handleToggleFavorite = async (report: SavedReport) => {
    try {
      const favorite = !report.favorite;
      await actualizarReporte(report.id, { favorite });
      // The star is drawn from the open report, not from the list. Refreshing
      // only the list left it showing the old state, so the next press sent the
      // same value again and a favourite could not be taken back.
      setCurrent((open) => (open?.id === report.id ? { ...open, favorite } : open));
      refreshSaved();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el favorito"));
    }
  };

  const handleDuplicate = async (report: SavedReport) => {
    try {
      await duplicarReporte(report.id);
      refreshSaved();
      toast.success("Copia creada");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo duplicar el reporte"));
    }
  };

  const handleDelete = async (report: SavedReport) => {
    // Decided now and checked again on the way back: `current` here is the one
    // from when the click happened, so archiving A and opening B before the
    // answer arrived closed B.
    const wasOpen = current?.id === report.id;
    const openedAs = identitySeq.current;
    try {
      await eliminarReporte(report.id);
      if (wasOpen && openedAs === identitySeq.current) resetForm();
      // And by id, whatever happened in between: reopened from the list before
      // this answered, it is still a report that no longer exists.
      else setCurrent((open) => (open?.id === report.id ? null : open));
      refreshSaved();
      toast.success("Reporte archivado");
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo archivar el reporte"));
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
  const resultRoot = useMemo(() => {
    const found = catalog?.roots.find((r) => r.key === resultConfig?.root);
    return found ? withExtraFields(found, extraFields, extraRelations) : undefined;
  }, [catalog, resultConfig?.root, extraFields, extraRelations]);
  const exportSubtitle = resultConfig ? describeConfig(resultConfig, resultRoot) : description;

  /**
   * Asks the server for the file.
   *
   * The configuration travels, not the rows. Building it here meant downloading
   * the whole result set as JSON and fetching one photograph per row over HTTP;
   * the server has both already, and reads the photographs off its own disk.
   */
  const runExport = async (format: ExportFormat) => {
    // `shapeChanged` as well as the buttons: what is on screen then is a sample
    // of a report nobody has generated, and the file would be the one before it.
    if (!resultConfig || shapeChanged || exporting) return;
    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(format);
    setExportBytes(0);
    // The configuration that produced the table — with one thing taken from
    // the one being edited: the headers. A rename changes no row, so nothing
    // re-runs the report for it (`signatureOf` leaves labels out on purpose),
    // and the file went out under the name the column had before.
    //
    // Whenever there is a table to export, not only when the rename is the one
    // pending edit: the table draws the new names in both cases (`liveHeaders`),
    // and with a filter also waiting the file said «Descripción» under a table
    // that said something else. The guard above means the shape has not
    // changed — the same columns in the same order — so the names pair by
    // position. An edit to a filter or to the order still exports the rows that
    // were generated, which is what the staleness banner says.
    const exported = {
      ...resultConfig,
      columns: resultConfig.columns.map((column, i) => {
        const { label: _was, ...rest } = column;
        const label = config.columns[i]?.label;
        return label ? { ...rest, label } : rest;
      }),
    };
    try {
      const { blob, filename } = await exportarReporte(
        exported,
        {
          format,
          title: exportTitle,
          subtitle: exportSubtitle,
          photos: format === "excel" && hasPhotoColumns && withPhotos,
          // `resultConfig` carries the page on screen, so "page" needs nothing
          // else: it is the same configuration the table was built from.
          scope: exportScope,
        },
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

  // The page that is coming, not a spinner in an empty one. What used to happen
  // here was a centred spinner and then, in one frame, a two-column layout with
  // five cards in it: nothing on screen during the wait had anything to do with
  // what arrived, so the whole thing read as a jump rather than as a load.
  if (loadingCatalog) return <PageSkeleton />;

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
    <div className="@container/card w-full space-y-page p-page animate-in fade-in duration-500">
      {/*
        One header, which is what every other page in this application has: a
        heading, one line under it, and the page's own controls on the right of
        that same row.

        This page had two. The heading with its paragraph, and then a bordered
        strip under it — two bands of chrome before anything anybody came here
        to do. The strip's border, its tint and the gap above it were sixty
        pixels spent saying "these controls belong together", which is already
        said by their sitting together.

        The level of detail leads because it is the decision the rest are made
        under: changing it discards columns and filters. Then the way into a
        report that already exists, then the way to abandon one.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Generador de reportes</h1>
            <PageHelp />
          </div>
          {/* One line, like every other page's. It was three sentences saying
              what the help panel says at length two centimetres to the left. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Arme la tabla que necesite, guárdela y expórtela.
          </p>
        </div>

        {/*
          `items-end` so the controls sit on one line however tall their labels
          are, and "Nuevo" — which has no label of its own — lines up with them
          instead of floating in the middle of the row.
        */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {/* Above its control, not beside it: at the size a header gives
                  them, a label to the left of one box and another to the left
                  of the next read as one long line of words with boxes in it,
                  and neither label looked attached to anything. */}
              <span className="text-xs font-medium text-muted-foreground">Nivel de detalle</span>
              <CardHelp label="el nivel de detalle">
                <p>
                  Define qué representa cada fila del reporte, y es la decisión que manda sobre
                  todas las demás: los mismos datos dan tablas distintas según sea una fila por
                  evento o una por revisión.
                </p>
                <p className="mt-2">
                  Cambiarlo descarta lo que no exista en el nivel nuevo, y le avisa antes de
                  hacerlo.
                </p>
              </CardHelp>
            </div>

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
              {/*
                A pill rather than a boxed select. What it holds is a statement
                about the report — "una fila por evento" — and not a field being
                filled in, and the header it now sits in reads better for the
                difference: two bordered boxes side by side looked like a form
                somebody had left half filled.

                The borderless fill that made that work is every select's now,
                so only what is particular to this one is left here: it is round
                rather than square, and it hugs its text instead of holding a
                fixed width, so the pill is as long as what it says.
              */}
              <SelectTrigger
                className="h-8 w-auto rounded-full px-3 text-sm font-medium"
                aria-label="Nivel de detalle"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.roots.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.rowMeaning}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            The report being worked on, which the page never used to name. Opening
            one from the list changed everything on screen except any statement of
            what had been opened: the only clue was the save button turning into
            "Actualizar". On somebody else's report that mattered more than a
            label — saving makes a copy, and that was explained inside the save
            popover, after it had been opened.
          */}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Reporte</span>
              <CardHelp label="abrir un reporte">
                <p>
                  <strong className="font-medium text-foreground">Guardados</strong> son los suyos
                  y los que el equipo ha compartido. <strong className="font-medium text-foreground">Plantillas</strong> son
                  seis reportes ya armados: se abren, se tocan y se generan.
                </p>
                <p className="mt-2">
                  Abrir una plantilla no toca ningún reporte guardado — se guarda como uno nuevo
                  cuando usted quiera.
                </p>
              </CardHelp>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <ReportPicker
                reports={saved}
                total={savedTotal}
                onLoadMore={() => loadSaved(true)}
                templates={catalog.templates ?? []}
                roots={catalog.roots}
                current={current}
                currentUserId={currentUserId}
                // Opening and running are `ver`, which this page already required
                // to load at all. The three below are not.
                onOpen={handleOpen}
                onPickTemplate={handlePickTemplate}
                loading={loadingSaved}
                failed={savedFailed}
                onRetry={refreshSaved}
              />

              {current && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {current.visibility === "shared"
                        ? <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        : <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                    </TooltipTrigger>
                    <TooltipContent>
                      {current.visibility === "shared" ? "Compartido con el equipo" : "Privado"}
                    </TooltipContent>
                  </Tooltip>

                  {/*
                    Whose it is, said before anything is pressed rather than after.
                    Saving somebody else's report creates a copy of it, and until
                    now that was stated inside the save popover.
                  */}
                  {!isMine && author && (
                    <span className="ml-1 truncate text-xs text-muted-foreground">
                      De {author}
                    </span>
                  )}

                  {/* The same three the list rows carried, behind the same three
                      permissions — and now usable on the report while it is open,
                      which the list could never do. */}
                  {isMine && mayEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          aria-label={current.favorite
                            ? `Quitar ${current.name} de favoritos`
                            : `Marcar ${current.name} como favorito`}
                          aria-pressed={current.favorite}
                          onClick={() => handleToggleFavorite(current)}
                        >
                          <StarIcon className={cn(
                            "h-3.5 w-3.5",
                            current.favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                          )} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {current.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {mayCreate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                          aria-label={`Duplicar ${current.name}`}
                          onClick={() => handleDuplicate(current)}
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicar</TooltipContent>
                    </Tooltip>
                  )}

                  {isMine && mayArchive && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Archivar ${current.name}`}
                        >
                          <ArchiveIcon className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Archivar «{current.name}»?</AlertDialogTitle>
                          <AlertDialogDescription>
                            El reporte dejará de estar disponible para usted y para el resto del
                            equipo, y no podrá recuperarlo desde el sistema. Los datos que consulta no
                            se tocan: sólo se archiva este reporte guardado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(current)}>
                            Archivar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          </div>

          {/*
            The two verbs that act on the report as a thing that is kept, next
            to the report itself and to the three buttons that already act on
            it. Saving stores the configuration, never the rows — a saved report
            is generated again when it is opened — so it belongs with what
            builds that configuration and not with the table it produced. It sat
            in the results heading, which had seven controls and now has six,
            each of them about the table.
          */}
          <div className="flex items-center gap-2">
            {/* Updating your own report needs `editar` and everything
                else creates a row and needs `crear` — but holding only
                `crear` must not lose the button the moment one of your
                own reports is open: `handleSave` already falls back to
                creating a copy, and the alternative was telling someone
                to press Nuevo and rebuild what they wanted to keep. */}
            {(mayCreate || (current !== null && isMine && mayEdit)) && (
            <Popover open={saveOpen} onOpenChange={setSaveOpen}>
              <Tooltip>
                {/*
                  A span between the tooltip and the button, because a disabled
                  button receives no pointer events — and the tooltip here is
                  the only place the reason for being disabled is written.
                */}
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <PopoverTrigger asChild>
                      {/*
                        Off while the configuration cannot be saved at all. The
                        form behind this asks for a name, a description and a
                        decision about sharing, and then refused the whole thing
                        with "el reporte necesita al menos una columna" — work
                        asked for before saying it was impossible.
                      */}
                      <Button variant="outline" size="sm" disabled={problems.length > 0}>
                        <SaveIcon className="mr-1.5 h-4 w-4" />
                        {current && isMine && mayEdit ? "Actualizar" : "Guardar"}
                      </Button>
                    </PopoverTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {problems.length > 0 ? problems[0]
                    : current && isMine && mayEdit
                      ? `Sobrescribe «${current.name}», también para el equipo si está compartido`
                      : "Guarda la configuración, no los datos: al abrirlo se vuelve a generar"}
                </TooltipContent>
              </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline" size="sm"
                    onClick={handleNew}
                    disabled={!somethingToDiscard}
                  >
                    <FilePlus2Icon className="mr-1.5 h-4 w-4" />
                    Nuevo
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {somethingToDiscard
                  ? "Vacía la configuración y cierra el reporte abierto"
                  : "Ya está en blanco"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/*
        The configuration sits above the table, not beside it.

        It used to be a column 320 to 400 pixels wide down the left, which is a
        quarter to a third of the screen spent, permanently, on panels that are
        read while a report is being set up and ignored while it is being read. The table is what needs the width — it is the report, its headers
        do not wrap, and it was the one thing squeezed.

        Each panel caps its own height and scrolls inside itself rather than the
        band scrolling as a whole, so every heading stays visible and only the
        long one — sixty columns, a hundred filters — moves. The cap is 448
        pixels: at 288 it showed four columns, and an ordinary report of eight
        was built and reordered through a slot. `items-start` keeps
        a panel holding two saved reports from being stretched to the height of
        one holding forty columns.

        `min-w-0` on each card for the reason the old two-column layout needed
        it: a grid track is floored at its item's min-content width unless the
        item is itself a scroll container, so a card wider than its share widens
        the grid, the grid outgrows the page, and the application's `<main>` —
        which is `overflow-auto` — takes a horizontal scrollbar.
      */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* ── Configuration ─────────────────────────────────────────────── */}
        <>
          <Card size="sm" className="min-w-0 border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base">Columnas</CardTitle>
                  <CardHelp label="las columnas">
                    <p>
                      Lo que se ve en la tabla, en el orden en que se verá — y ese es también el
                      orden del Excel. Arrástrelas por el agarre de la izquierda para cambiarlo.
                    </p>
                    <p className="mt-2">
                      Puede renombrar la cabecera escribiendo encima. Los campos que empiezan por
                      «Contar» no son un dato guardado: se cuentan al generar.
                    </p>
                  </CardHelp>
                </div>
                <FieldPicker
                  root={menuRoot}
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
            <CardContent className="max-h-112 overflow-y-auto space-y-3">
              {/*
                The rule, said before it is broken instead of after.

                Grouping is the hardest idea on this screen: it turns a listing
                into one row per distinct value, and from that moment every
                column has to be grouped or summarised or the report is refused.
                Until now the only place that rule appeared was in the refusal
                itself — after somebody had chosen the columns, pressed Generar
                and been told no. It shows only while the report actually groups,
                so it is an explanation of what is on screen and not a manual.
              */}
              {isSummary(config) && (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Este reporte <strong className="font-medium text-foreground">agrupa</strong>: cada
                  fila será un valor distinto, no un registro. Por eso toda columna tiene que estar
                  agrupada o llevar un resumen —Conteo, Suma, Mínimo…—; las que no, hay que quitarlas.
                </p>
              )}
              <ColumnList
                config={config}
                root={root}
                onReorder={handleReorder}
                onRemove={handleRemoveColumn}
                onRename={handleRename}
                onSetAgg={handleSetAgg}
                onToggleGroup={handleToggleGroup}
                onToggleSort={handleToggleSort}
              />

              {/*
                Under the columns, because it is about them and it only exists
                once two of them sort. It draws nothing at all with fewer.
              */}
              <SortOrder
                config={config}
                root={root}
                onReorder={handleSortReorder}
                onFlip={handleSortFlip}
                onRemove={handleSortRemove}
              />
            </CardContent>
          </Card>

          <Card size="sm" className="min-w-0 border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base">Filtros</CardTitle>
                  <CardHelp label="los filtros">
                    <p>
                      Lo que se queda fuera del reporte. Sin filtros entra todo.
                    </p>
                    <p className="mt-2">
                      Con dos o más aparece arriba un selector para decidir si han de cumplirse
                      todos o basta con cualquiera de ellos.
                    </p>
                  </CardHelp>
                </div>
                <div className="flex items-center gap-1">
                  {/*
                    Only once there is more than one to lose. With a single
                    filter the ✕ beside it is closer and clearer, and a second
                    control for the same act would just be another thing to
                    read.
                  */}
                  {filterCount > 1 && (
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                      onClick={() => {
                        // Confirmed above three, because that is where redoing
                        // them by hand stops being a moment's work. Below it the
                        // dialog costs more than the mistake.
                        if (filterCount > 3) return setClearingFilters(true);
                        setConfig((c) => clearFilters(c));
                      }}
                    >
                      Quitar todos
                    </Button>
                  )}
                <FieldPicker
                  root={menuRoot}
                  chosen={filtered}
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
              </div>
            </CardHeader>
            <CardContent className="max-h-112 overflow-y-auto">
              <FilterBuilder
                config={config}
                root={root}
                optionLists={catalog.optionLists}
                periods={catalog.periods}
                onUpdate={handleUpdateFilter}
                onRemove={handleRemoveFilter}
                onSetJoin={handleSetJoin}
              />
            </CardContent>
          </Card>
        </>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {/*
        Full width now, and no `min-w-0`: this is a block child of a block, so
        its width comes from its containing block and the table's own
        `overflow-x-auto` is finally the thing that decides. The floor only ever
        mattered while this was a grid item.
      */}
      <div>
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              {/*
                Two groups, by what they are for. On the left, making the table:
                the button that does it, how big the answer will be, and whether
                it redoes itself. On the right, taking the table away as a file.

                It was one row of up to nine controls with Generar last and the
                same size as the rest — the page's main action, found by reading
                past eight others.
              */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">Resultado</CardTitle>
                    <CardDescription className="truncate">{description}</CardDescription>
                  </div>

                  <Button onClick={handleGenerate} disabled={running}>
                    {running
                      ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                      : <PlayIcon className="mr-1.5 h-4 w-4" />}
                    Generar
                  </Button>

                  {/*
                    How big the answer is, before asking for it.

                    The space is held whether or not there is a number in it.
                    The count is cleared and asked again on every keystroke of a
                    filter value, and with the chip appearing and disappearing
                    the control to its right slid left and back on each letter
                    typed — the most frequent movement on the page, right
                    beside the button being aimed at.
                  */}
                  {problems.length === 0 && (
                    // A div, not a span: the placeholder below is one, and a
                    // block element inside a span is invalid markup.
                    <div className="w-20 text-xs tabular-nums text-muted-foreground">
                      {estimate !== null ? (
                        `${estimate.toLocaleString("es-BO")} fila${estimate === 1 ? "" : "s"}`
                      ) : (
                        <Skeleton className="h-3 w-14" aria-hidden="true" />
                      )}
                    </div>
                  )}

                  {/*
                    It said "Auto" and nothing else, and somebody had to ask
                    what it did — which is the whole test of a label. The label
                    now says what happens; the tooltip keeps the part a label
                    has no room for: when it refreshes, and why it starts off.
                  */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1">
                        <Switch
                          id="rep-auto"
                          checked={auto}
                          onCheckedChange={setAuto}
                          aria-label="Actualizar la tabla automáticamente"
                        />
                        <Label htmlFor="rep-auto" className="cursor-pointer text-xs font-normal">
                          Actualizar sola
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Rehace la tabla sola cuando cambia algo, un momento después de que pare de
                      tocar. Viene apagado porque cada refresco es una consulta entera: enciéndalo
                      para ir probando variantes y se queda encendido en este navegador.
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {result !== null && shapeChanged && problems.length === 0 && !running && (
                    <span role="status" className="self-center text-xs text-muted-foreground">
                      Pulse Generar para exportar este reporte
                    </span>
                  )}

                  {/* Only while a file is being made. The server sends nothing
                      until it is finished, so there is no honest percentage to
                      show — only how long it has taken and how much has arrived. */}
                  {exporting !== null && (
                    <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <span>
                        {exportBytes > 0
                          ? `Descargando ${(exportBytes / 1024 / 1024).toLocaleString("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB…`
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

                  {/*
                    One button in front of both formats and of the two choices
                    that only matter to a file. They are used once per report,
                    after everything else, and were four places in the row all
                    of the time.

                    A popover and not a menu: two of the four things in it are
                    switches that have to stay open while they are set, and a
                    menu closes on every press.
                  */}
                  <Popover open={exportOpen} onOpenChange={setExportOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        disabled={!canExport || exporting !== null}
                      >
                        {exporting !== null
                          ? <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
                          : <DownloadIcon className="mr-1.5 h-4 w-4" />}
                        Exportar
                        <ChevronDownIcon className="ml-1 h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-1">
                      {(["excel", "pdf"] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => { setExportOpen(false); runExport(format); }}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        >
                          <span className="flex items-center gap-2">
                            {format === "excel"
                              ? <DownloadIcon className="h-4 w-4 text-muted-foreground" />
                              : <FileTextIcon className="h-4 w-4 text-muted-foreground" />}
                            {format === "excel" ? "Excel" : "PDF"}
                          </span>
                          {/* What the switch below decides, said on the thing
                              it changes: how many rows this file will carry. */}
                          {result && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {exportRows.toLocaleString("es-BO")} fila{exportRows === 1 ? "" : "s"}
                            </span>
                          )}
                        </button>
                      ))}

                      {(exportPaged || hasPhotoColumns) && <div className="my-1 border-t" />}

                      {/*
                        Only when the report does not fit in one page. When it
                        does, the whole report and this page are the same rows,
                        and a choice whose two answers are identical is one more
                        thing to read and decide about for nothing.
                      */}
                      {exportPaged && (
                        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                          <Label htmlFor="rep-pagina" className="cursor-pointer text-sm font-normal">
                            Solo esta página
                          </Label>
                          <Switch
                            id="rep-pagina"
                            checked={exportScope === "page"}
                            onCheckedChange={(on) => setExportScope(on ? "page" : "all")}
                          />
                        </div>
                      )}

                      {hasPhotoColumns && (
                        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
                          <Label htmlFor="rep-fotos" className="cursor-pointer text-sm font-normal">
                            Fotos en el Excel
                          </Label>
                          <Switch id="rep-fotos" checked={withPhotos} onCheckedChange={setWithPhotos} />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>

            <CardContent>
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
              {/*
                And only while that previous result is the thing on screen. When
                the shape changed there is no old table any more — there is a
                preview of the new one — and "la tabla muestra el resultado
                anterior" printed above it would be describing something the
                reader cannot see, next to a strip that already says what to
                press.
              */}
              {stale && !autoPending && showsResult && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  {problems.length > 0
                    ? "La tabla muestra el resultado anterior: la configuración de arriba todavía no se puede generar."
                    : "Cambió la configuración: la tabla muestra el resultado anterior. Pulse Generar para actualizarla."}
                </div>
              )}

              {/*
                Four states, in the order that decides between them.

                A query in flight wins over everything, because then the real
                values genuinely are on their way and grey bars say so. Then the
                real table, for as long as it still has the shape being built.
                Then the shape itself, drawn from the configuration with sample
                values. The invitation is last and now means only one thing:
                nothing has been chosen yet.
              */}
              {running && !showsResult ? (
                /*
                  Nothing usable to keep — either the first run, or a run whose
                  shape the table on screen no longer has. Underneath this used
                  to sit the invitation below, so for the whole of the first
                  query the screen answered "elija las columnas y pulse Generar"
                  to somebody who had just done both.
                */
                <ResultSkeleton columns={config.columns} root={root} />
              ) : showsResult && result ? (
                <PreviewTable
                  result={result}
                  headers={liveHeaders}
                  loading={running}
                  onPage={handlePage}
                  sort={config.sort}
                  onToggleSort={handleToggleSort}
                  // From the configuration that produced the table, not the one
                  // being edited: the wording has to describe the result shown.
                  hasFilters={(resultConfig?.filters?.conditions?.length ?? 0) > 0}
                  onPageSize={handlePageSize}
                />
              ) : previewing ? (
                <ShapePreview
                  columns={config.columns}
                  root={root}
                  grouped={isSummary(config)}
                />
              ) : (
                /*
                  The templates used to be listed here as well, and on an empty
                  page that put the same six on screen twice — once in the panel
                  and once here — which reads as the page repeating itself. They
                  live in the picker on the strip, and this says where rather
                  than showing them again.
                */
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Añada columnas arriba, en «Columnas», para ir viendo aquí cómo queda el reporte
                  {(catalog.templates?.length ?? 0) > 0
                    ? ", o abra una de las plantillas desde «Reporte», arriba."
                    : "."}
                </p>
              )}
            </CardContent>
          </Card>
      </div>

      <AlertDialog open={discarding} onOpenChange={setDiscarding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Empezar un reporte en blanco?</AlertDialogTitle>
            <AlertDialogDescription>
              {/*
                The same two facts the level-of-detail confirmation states: how
                much is at stake, counted the way the page counts it everywhere
                else, and what is left standing afterwards. "Lo guardado no se
                toca" is the sentence that makes this safe to press — without it
                somebody with a report open has to guess whether this deletes
                it.
              */}
              {elementCount(config) > 0 && (
                <>
                  Se descartará{elementCount(config) === 1 ? "" : "n"} {elementCount(config)}{" "}
                  {elementCount(config) === 1 ? "elemento" : "elementos"} del reporte
                  —columnas, filtros, orden o agrupación—{current ? " " : ". "}
                </>
              )}
              {current && (
                <>
                  y se cerrará «{current.name}». El reporte guardado no se toca: se cierra
                  aquí, no se borra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyNew}>Empezar en blanco</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearingFilters} onOpenChange={setClearingFilters}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar los {filterCount} filtros?</AlertDialogTitle>
            <AlertDialogDescription>
              El reporte pasará a incluir todos los registros. Los filtros no se pueden recuperar:
              habría que volver a armarlos uno a uno.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfig((c) => clearFilters(c))}>
              Quitar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              ¿Cambiar a «{pendingRoot?.root.rowMeaning}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/*
                "agrupación" belongs in the list because elementCount counts it:
                grouping by tramo and then switching level said "4 elementos —
                columnas, filtros u orden—" where one of the four was the
                grouping. And the last sentence is a warning rather than a
                reassurance now: a surviving column keeps its summary, so what
                is conserved can be a configuration Generar refuses.
              */}
              Se descartará{pendingRoot?.lost === 1 ? "" : "n"} {pendingRoot?.lost}{" "}
              {pendingRoot?.lost === 1 ? "elemento" : "elementos"} del reporte
              —columnas, filtros, orden o agrupación— porque no{" "}
              {pendingRoot?.lost === 1 ? "existe" : "existen"} en este nivel de detalle.
              El resto se conserva, pero puede que haya que revisar los resúmenes
              de las columnas que queden.
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
