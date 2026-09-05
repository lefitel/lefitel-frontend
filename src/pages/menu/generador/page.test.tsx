import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { SesionContext } from "../../../context/SesionContext";
import type { Catalog, ReportConfig, ReportResult, SavedReport } from "../../../api/generador.api";
import { usuarioExample } from "../../../data/example";

// ─── Doubles ─────────────────────────────────────────────────────────────────

const api = {
  getCatalogo: vi.fn(),
  runReporte: vi.fn(),
  contarReporte: vi.fn(),
  getReportesGuardados: vi.fn(),
  crearReporte: vi.fn(),
  actualizarReporte: vi.fn(),
  eliminarReporte: vi.fn(),
  duplicarReporte: vi.fn(),
  exportarReporte: vi.fn(),
};

vi.mock("../../../api/generador.api", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../api/generador.api");
  return {
    ...actual,
    getCatalogo: (...a: unknown[]) => api.getCatalogo(...a),
    runReporte: (...a: unknown[]) => api.runReporte(...a),
    contarReporte: (...a: unknown[]) => api.contarReporte(...a),
    getReportesGuardados: (...a: unknown[]) => api.getReportesGuardados(...a),
    crearReporte: (...a: unknown[]) => api.crearReporte(...a),
    actualizarReporte: (...a: unknown[]) => api.actualizarReporte(...a),
    eliminarReporte: (...a: unknown[]) => api.eliminarReporte(...a),
    duplicarReporte: (...a: unknown[]) => api.duplicarReporte(...a),
    exportarReporte: (...a: unknown[]) => api.exportarReporte(...a),
  };
});

/** file-saver hands the blob to the browser; capture it instead. */
const downloaded: { name: string; size: number }[] = [];
vi.mock("file-saver", () => ({
  saveAs: (blob: Blob, name: string) => { downloaded.push({ name, size: blob.size }); },
}));

const toasts: { kind: string; text: string }[] = [];
vi.mock("sonner", () => ({
  toast: {
    success: (t: string) => toasts.push({ kind: "success", text: t }),
    error: (t: string) => toasts.push({ kind: "error", text: t }),
    warning: (t: string) => toasts.push({ kind: "warning", text: t }),
    info: (t: string) => toasts.push({ kind: "info", text: t }),
  },
}));


const GeneradorPage = (await import("./index")).default;

const { setPermisos, olvidarPermisos, sinPermisos } = await import("../../../lib/permissions");

/**
 * What the session provider does at login, done by hand.
 *
 * These tests mount the page under a fake context rather than the real
 * provider, so nothing fills the permission matrix — and the page now asks it
 * before drawing anything that writes. Granting the four here is what a role
 * that can use this screen actually holds; the test below takes them away
 * again on purpose.
 */
const grantGenerador = (over: Partial<Record<"ver" | "crear" | "editar" | "archivar", boolean>> = {}) => {
  setPermisos(usuarioExample.id_rol, {
    ...sinPermisos(),
    generador: { ver: true, crear: true, editar: true, archivar: true, ...over },
  });
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const catalog: Catalog = {
  limits: { maxColumns: 60, maxConditions: 100, maxSorts: 10, maxRows: 50000, maxDepth: 3, maxFilterValue: 200 },
  roots: [
    {
      key: "evento", label: "Evento", rowMeaning: "Una fila por evento",
      fields: [
        { path: "description", label: "Descripción", kind: "string", group: "Evento", operators: ["like"], aggregates: ["count"] },
        { path: "state", label: "Resuelto", kind: "boolean", group: "Evento", operators: ["eq"], aggregates: ["count"] },
      ],
      // A to-many relation the report can count and filter on with `exists`.
      // The fixture had none, so nothing here ever exercised the branch that
      // decides whether an advanced filter survives being opened.
      aggregateOnly: [{ path: "revisiones", label: "Revisiones", group: "Evento" }],
    },
    {
      key: "poste", label: "Poste", rowMeaning: "Una fila por poste",
      fields: [{ path: "name", label: "Nº de poste", kind: "string", group: "Poste", operators: ["like"], aggregates: ["count"] }],
      aggregateOnly: [],
    },
  ],
  // The real server sends these with the catalog, so the fixture does too.
  // Without them every test here started on a screen the server no longer
  // serves — the empty right-hand panel — and nothing exercised the gallery
  // that now stands there.
  templates: [
    {
      key: "todos-los-eventos",
      name: "Todos los eventos",
      description: "Cada evento con su descripción y si está resuelto.",
      config: {
        root: "evento",
        columns: [{ path: "description" }, { path: "state" }],
        filters: { op: "and", conditions: [] },
        groupBy: [],
        sort: [],
      },
    },
    {
      key: "listado-de-postes",
      name: "Listado de postes",
      description: "El número de cada poste dado de alta en el sistema.",
      config: {
        root: "poste",
        columns: [{ path: "name" }],
        filters: { op: "and", conditions: [] },
        groupBy: [],
        sort: [],
      },
    },
  ],
};

/**
 * What the server calls each column of the fixture above, and what type it
 * gives it. Written out by hand rather than computed from the catalog: this is
 * the other side of the contract, and a fake that derives its answer from the
 * same function the page uses would agree with the page by construction.
 *
 * This used to be `c.label ?? c.path`, so every header in these tests read
 * "description" — a shape no server ever sends. Nothing noticed until a test
 * compared a header the page draws against a header the server sends.
 */
const SERVER_COLUMN: Record<string, { label: string; kind: ReportResult["columns"][number]["kind"] }> = {
  description: { label: "Descripción", kind: "string" },
  state: { label: "Resuelto", kind: "boolean" },
  name: { label: "Nº de poste", kind: "string" },
  revisiones: { label: "Nº de revisiones", kind: "number" },
};

const resultFor = (config: ReportConfig, over: Partial<ReportResult> = {}): ReportResult => ({
  // The server sends the path and the summary with each column now, so the
  // table can sort by its own headers; the fake answers the same shape.
  columns: config.columns.map((c, i) => ({
    key: `c${i}`,
    label: c.label?.trim() || SERVER_COLUMN[c.path]?.label || c.path,
    kind: SERVER_COLUMN[c.path]?.kind ?? "string",
    path: c.path,
    agg: c.agg,
  })),
  rows: [{ c0: "fila" }],
  total: 1,
  limit: config.limit ?? 100,
  offset: config.offset ?? 0,
  ...over,
});

// `autenticado: true` is set explicitly: without it this fixture would
// silently carry `autenticado: undefined` past the `as never` cast below,
// and no compiler error would ever say so (task 5's brief flagged this file).
const sesion = {
  sesion: { usuario: { ...usuarioExample, id: 7 }, autenticado: true },
  setSesion: vi.fn(),
  loading: false,
  logout: vi.fn(),
};

const renderPage = () =>
  render(
    <SesionContext.Provider value={sesion as never}>
      <TooltipProvider>
        <GeneradorPage />
      </TooltipProvider>
    </SesionContext.Provider>,
  );

/**
 * Waits until the catalog has loaded and the builder is on screen.
 *
 * Anchored on the Generar button rather than on the word "Columnas". The
 * skeleton drawn while the catalog loads carries the four card titles — they
 * are fixed strings, so hiding them behind grey bars would be pretending not
 * to know them — and "Columnas" therefore stopped telling these seventy tests
 * apart from a page that has not loaded yet. Only the real page has a button.
 */
const ready = async () => {
  await waitFor(() => expect(screen.getByRole("button", { name: "Generar" })).toBeInTheDocument());
};

const addColumn = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getAllByRole("button", { name: /añadir columna/i })[0]);
  await user.click(screen.getByRole("option", { name }));
};

/**
 * One page of saved reports, as the endpoint answers now.
 *
 * The listing used to return a bare array of every report the account can see.
 * It is paginated, so the total travels with the page and the sidebar can say
 * how many it is not showing.
 */
const savedPage = (rows: unknown[]) => ({ rows, total: rows.length, limit: 100, offset: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  toasts.length = 0;
  downloaded.length = 0;
  olvidarPermisos();
  grantGenerador();
  api.getCatalogo.mockResolvedValue(catalog);
  api.getReportesGuardados.mockResolvedValue(savedPage([]));
  api.runReporte.mockImplementation((config: ReportConfig) => Promise.resolve(resultFor(config)));
  api.contarReporte.mockResolvedValue({ total: 1 });
  // The server names the file; the page only saves what it is handed.
  api.exportarReporte.mockImplementation((_config: ReportConfig, options: { format: string }) =>
    Promise.resolve({
      blob: new Blob(["contenido"]),
      filename: `Reporte_06-08-2026_00-00-00.${options.format === "pdf" ? "pdf" : "xlsx"}`,
    }));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("catalog loading", () => {
  it("fetches the catalog once, not on every new session object", async () => {
    // The session used to carry a token the server re-issued on every
    // response, so this object changed identity constantly; when the effect
    // depended on it, generating a report wiped the configuration and reset
    // the detail level to "evento". The token is gone, the hazard is not —
    // anything that replaces the session object hands this page a new
    // identity, and a role change now does exactly that.
    const { rerender } = renderPage();
    await ready();
    expect(api.getCatalogo).toHaveBeenCalledTimes(1);

    rerender(
      <SesionContext.Provider value={{ ...sesion, sesion: { ...sesion.sesion } } as never}>
        <TooltipProvider><GeneradorPage /></TooltipProvider>
      </SesionContext.Provider>,
    );
    await ready();
    expect(api.getCatalogo).toHaveBeenCalledTimes(1);
  });

  it("offers to retry when the catalog fails, instead of a dead page", async () => {
    api.getCatalogo.mockRejectedValueOnce(new Error("caída"));
    const user = userEvent.setup();
    renderPage();

    const retry = await screen.findByRole("button", { name: /reintentar/i });
    api.getCatalogo.mockResolvedValue(catalog);
    await user.click(retry);
    await ready();
  });
});

describe("running a report", () => {
  it("refuses to run an invalid configuration", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getByRole("button", { name: /generar/i }));
    expect(api.runReporte).not.toHaveBeenCalled();
    expect(toasts[toasts.length - 1]?.text).toMatch(/al menos una columna/);
  });

  it("keeps edits made while the query is in flight", async () => {
    // run() used to write its captured config back on completion, so anything
    // touched during the request silently reverted.
    let release: (v: ReportResult) => void = () => {};
    api.runReporte.mockImplementationOnce(
      () => new Promise<ReportResult>((resolve) => { release = resolve; }),
    );

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));

    // Second column added while the first request is still open.
    await addColumn(user, /Resuelto/);
    release(resultFor({ root: "evento", columns: [{ path: "description" }] }));

    await waitFor(() => {
      expect(screen.getByLabelText("Nombre de la columna Resuelto")).toBeInTheDocument();
    });
  });

  it("catches the table up by itself instead of asking to be told", async () => {
    // Every change used to leave the table describing a report nobody was
    // asking for, with a banner saying so and a button to press: twenty
    // variants were forty actions, half of them the same button.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalledTimes(1));

    await addColumn(user, /Resuelto/);

    await waitFor(
      () => expect(api.runReporte).toHaveBeenCalledTimes(2),
      { timeout: 3000 },
    );
    const second = api.runReporte.mock.calls[1][0] as ReportConfig;
    expect(second.columns).toHaveLength(2);
    // And no warning is left over: a banner that solves itself is how people
    // learn to ignore banners.
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("says the table is behind when nothing is going to fix it", async () => {
    // With the switch off the table stays where it is, and then the warning is
    // the only thing telling the reader the header above no longer describes
    // the rows below.
    //
    // The change here is a sort, which leaves every column exactly where it
    // was. That matters: this banner only exists for edits the table on screen
    // can survive, and an edit that changes the shape retires the table instead
    // (the test below). Driving this one with a new column stopped exercising
    // the banner at all.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText("Actualizar la tabla automáticamente"));
    await user.click(screen.getByRole("button", { name: /^Ordenar la tabla por/ }));

    expect(await screen.findByText(/Cambió la configuración/)).toBeInTheDocument();
    // The rows are still there: they are real, and a different order is still a
    // fair picture of the same columns.
    expect(screen.getByText("fila")).toBeInTheDocument();
    expect(api.runReporte).toHaveBeenCalledTimes(1);
  });

  it("retires the table when the change is one it cannot show", async () => {
    // A new column is not a different order — the table simply does not have
    // it, and no amount of real data in it shows the report being built. So the
    // shape takes over, and the banner that would say "la tabla muestra el
    // resultado anterior" above a preview of a different table steps aside.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText("Actualizar la tabla automáticamente"));
    await addColumn(user, /Resuelto/);

    expect(await screen.findByText(/Vista previa/)).toBeInTheDocument();
    expect(screen.queryByText(/Cambió la configuración/)).not.toBeInTheDocument();
    // Both columns, including the one the old table never had.
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent))
      .toEqual(["Descripción", "Resuelto"]);
    expect(api.runReporte).toHaveBeenCalledTimes(1);
  });

  it("asks how many rows there are without asking for the rows", async () => {
    // The answer that changes a decision before it is taken. It is asked while
    // a filter value is still being typed, so it has its own endpoint that
    // reads no rows and its own budget — four times the other one.
    api.contarReporte.mockResolvedValue({ total: 118 });

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    expect(await screen.findByText(/118 filas/)).toBeInTheDocument();
    // Nothing was generated: the count is not a query for the table.
    expect(api.runReporte).not.toHaveBeenCalled();
  });

  it("clears the table when a run fails, rather than showing stale rows", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(screen.queryByRole("table")).toBeInTheDocument());

    api.runReporte.mockRejectedValueOnce(new Error("fallo"));
    await user.click(screen.getByRole("button", { name: /generar/i }));

    // The rows are what must not survive: stale values under a header that no
    // longer produced them read exactly like an answer. What takes their place
    // is the preview, which says in as many words that its values are examples
    // — the same state the screen is in before anything has been run.
    await waitFor(() => expect(screen.queryByText("fila")).not.toBeInTheDocument());
    expect(screen.getByText(/Vista previa/)).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(toasts[toasts.length - 1]?.kind).toBe("error");
  });

  it("sorts by clicking the column, which is where every table sorts", async () => {
    // It used to be a button in the left panel, several hundred pixels from the
    // column it ordered, while the table itself responded to nothing.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(screen.queryByRole("table")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Ordenar la tabla por/ }));

    await waitFor(() => expect(api.runReporte).toHaveBeenCalledTimes(2), { timeout: 3000 });
    const sorted = api.runReporte.mock.calls[1][0] as ReportConfig;
    expect(sorted.sort).toEqual([{ path: "description", dir: "asc" }]);
    // And the header says so, so the arrow and the query cannot disagree.
    expect(await screen.findByRole("button", { name: /Ordenando la tabla por .*ascendente/ })).toBeInTheDocument();
  });

  it("pages the query that produced the page, not the edited one", async () => {
    api.runReporte.mockImplementation((config: ReportConfig) =>
      Promise.resolve(resultFor(config, { total: 250, rows: [{ c0: "x" }] })));

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(screen.getByText(/Mostrando/)).toBeInTheDocument());

    // Edit after generating, then page. The edit is a sort and the switch goes
    // off first, both on purpose: the table has to still be on screen for there
    // to be a Siguiente to press, and nothing else may fire a run in between.
    await user.click(screen.getByLabelText("Actualizar la tabla automáticamente"));
    await user.click(screen.getByRole("button", { name: /^Ordenar la tabla por/ }));
    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    const paged = api.runReporte.mock.calls[api.runReporte.mock.calls.length - 1]?.[0] as ReportConfig;
    expect(paged.offset).toBe(100);
    // The configuration that was run, which had no sort on it.
    expect(paged.sort ?? []).toHaveLength(0);
    expect(paged.columns).toHaveLength(1);
  });
});

describe("saving", () => {
  const openSaveForm = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: /^guardar$|^actualizar$/i }));
    await user.type(screen.getByLabelText("Nombre"), name);
  };

  it("does not create two reports on a double click", async () => {
    api.crearReporte.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: "X" }), 20)),
    );
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await openSaveForm(user, "Mensual");

    const button = screen.getByRole("button", { name: /guardar reporte/i });
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(api.crearReporte).toHaveBeenCalledTimes(1));
  });

  it("saves someone else's report as a copy instead of overwriting it", async () => {
    const theirs: SavedReport = {
      id: 5, name: "De Ana", description: null, id_usuario: 99,
      visibility: "shared", favorite: false,
      config: { root: "evento", columns: [{ path: "description" }] },
    };
    api.getReportesGuardados.mockResolvedValue(savedPage([theirs]));
    api.crearReporte.mockResolvedValue({ ...theirs, id: 6, id_usuario: 7 });

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("De Ana"));

    // The action reads "Guardar", never "Actualizar", for a report that is not ours.
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    expect(screen.getByText(/se guardará como una copia suya/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar reporte/i }));
    await waitFor(() => expect(api.crearReporte).toHaveBeenCalled());
    expect(api.actualizarReporte).not.toHaveBeenCalled();
  });

  it("says what it dropped when a saved report names unavailable fields", async () => {
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 8, name: "Con campos ajenos", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: {
        root: "evento",
        columns: [{ path: "description" }, { path: "usuario.name" }, { path: "usuario.phone" }],
      },
    }]));

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("Con campos ajenos"));

    // "que ya no están disponibles", not "que su perfil no puede consultar":
    // a field can also be gone from the catalog, and blaming permissions sends
    // people to ask for one that would not bring the column back.
    expect(toasts[toasts.length - 1]?.text).toMatch(/sin al menos 2 elementos/);
    expect(screen.getAllByLabelText(/Nombre de la columna/)).toHaveLength(1);
  });

  it("keeps an advanced filter that the catalog still offers", async () => {
    // Opening ran the stored configuration through `changeRoot`, which deleted
    // every `exists` and every nested group on principle — even with the detail
    // level unchanged and every path available. The report silently widened:
    // "eventos con alguna revisión" instead of "…en un rango de fechas". The
    // warning blamed the reader's profile, and pressing Actualizar wrote the
    // widened version back over the original, for its author and for everyone
    // it was shared with.
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 9, name: "Con filtro avanzado", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: {
        root: "evento",
        columns: [{ path: "description" }],
        filters: {
          op: "and",
          conditions: [
            { path: "description", operator: "like", value: "poste" },
            { exists: "revisiones", where: { op: "and", conditions: [] } },
          ],
        },
      },
    }]));

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("Con filtro avanzado"));

    expect(toasts[toasts.length - 1]?.text).toMatch(/cargado/);
    expect(toasts[toasts.length - 1]?.text).not.toMatch(/sin \d+ elemento/);
    expect(screen.getByText(/Filtro avanzado/)).toBeInTheDocument();
  });

  it("counts what the server left out, not only what it prunes itself", async () => {
    // The server prunes on the way out now — a shared report used to publish
    // the paths of fields the catalog hides, filter values included. So the
    // configuration that arrives is already clean and the local comparison
    // finds nothing to drop: counting only that made the warning vanish for
    // exactly the case it exists for, and the report opened quietly narrower
    // than its author saved it.
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 11, name: "Podado por el servidor", description: null, id_usuario: 4,
      visibility: "shared", favorite: false, omitted: 3,
      config: { root: "evento", columns: [{ path: "description" }] },
    }]));

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("Podado por el servidor"));

    expect(toasts[toasts.length - 1]?.text).toMatch(/sin al menos 3 elementos/);
  });
});

describe("the list of saved reports", () => {
  it("says how many it is not showing, and loads the rest when asked", async () => {
    // The endpoint returned every report the account can see in one response,
    // each carrying its whole configuration. It is paginated now, and a page
    // that does not say it is a page reads as everything there is.
    const page = (id: number, name: string) => ({
      id, name, description: null, id_usuario: 7, visibility: "private", favorite: false,
      config: { root: "evento", columns: [{ path: "description" }] },
    });
    api.getReportesGuardados.mockResolvedValueOnce({
      rows: [page(1, "Primero")], total: 2, limit: 1, offset: 0,
    });
    api.getReportesGuardados.mockResolvedValueOnce({
      rows: [page(2, "Segundo")], total: 2, limit: 1, offset: 1,
    });

    const user = userEvent.setup();
    renderPage();
    await ready();

    expect(await screen.findByText(/Mostrando 1 reportes de 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cargar más" }));

    expect(await screen.findByText("Segundo")).toBeInTheDocument();
    expect(screen.getByText("Primero")).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    // The second page is asked for by offset, not fetched from the start again.
    expect(api.getReportesGuardados).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 1 }),
    );
  });
});

describe("exporting", () => {
  /** Runs a report so the export buttons have something to act on. */
  const generate = async (user: ReturnType<typeof userEvent.setup>) => {
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(screen.getByText(/Mostrando/)).toBeInTheDocument());
  };

  it("sends the configuration to the server rather than building the file here", async () => {
    // The browser used to download the whole result set as JSON only to rebuild
    // the file from it, and to fetch one photograph per row over HTTP.
    const user = userEvent.setup();
    await generate(user);
    const runsBefore = api.runReporte.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => expect(api.exportarReporte).toHaveBeenCalled());
    const [config, options] = api.exportarReporte.mock.calls[api.exportarReporte.mock.calls.length - 1] as [ReportConfig, { format: string }];
    expect(config.columns).toHaveLength(1);
    expect(options.format).toBe("excel");
    // No second pass over the rows: the server re-runs the query itself.
    expect(api.runReporte.mock.calls.length).toBe(runsBefore);
  });

  it("downloads the file under the name the server chose", async () => {
    const user = userEvent.setup();
    await generate(user);

    await user.click(screen.getByRole("button", { name: /pdf/i }));

    await waitFor(() => expect(downloaded).toHaveLength(1));
    expect(downloaded[0].name).toBe("Reporte_06-08-2026_00-00-00.pdf");
    expect(toasts[toasts.length - 1]?.text).toMatch(/PDF descargado/);
  });

  it("exports the configuration that produced what is on screen", async () => {
    // Editing after generating must not silently export something else.
    const user = userEvent.setup();
    await generate(user);
    await addColumn(user, /Resuelto/);

    await user.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => expect(api.exportarReporte).toHaveBeenCalled());
    const [config] = api.exportarReporte.mock.calls[api.exportarReporte.mock.calls.length - 1] as [ReportConfig];
    expect(config.columns).toHaveLength(1);
  });

  it("shows the server's own message when the export is refused", async () => {
    api.exportarReporte.mockRejectedValueOnce(new Error("cualquier cosa"));

    const user = userEvent.setup();
    await generate(user);
    await user.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => expect(toasts[toasts.length - 1]?.kind).toBe("error"));
    expect(downloaded).toHaveLength(0);
  });

  it("offers to leave the photographs out only when there are any", async () => {
    const user = userEvent.setup();
    await generate(user);

    expect(screen.queryByLabelText(/Fotos en el Excel/)).not.toBeInTheDocument();
  });

  it("blocks the second button while one export is running", async () => {
    let release!: () => void;
    api.exportarReporte.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = () => resolve({ blob: new Blob(["x"]), filename: "r.xlsx" });
      }),
    );

    const user = userEvent.setup();
    await generate(user);
    await user.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => expect(screen.getByText(/Generando en el servidor/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /pdf/i })).toBeDisabled();

    release();
    await waitFor(() => expect(downloaded).toHaveLength(1));
  });
});

describe("changing the detail level", () => {
  // Radix's Select cannot be opened in jsdom — it needs pointer capture the
  // environment does not implement — so the switch itself is exercised through
  // changeRoot in reportConfig.test.ts, and the warning it produces through
  // "says what it dropped" above, which takes the same path.
  it("shows the current level and every alternative the catalog offers", async () => {
    renderPage();
    await ready();
    expect(screen.getByLabelText("Nivel de detalle")).toHaveTextContent("Una fila por evento");
  });
});

describe("starting over", () => {
  it("clears the configuration and the saved report identity", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    await user.click(screen.getByRole("button", { name: /^nuevo$/i }));

    expect(screen.getByText(/sin columnas todavía/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
  });
});

describe("a request the user has moved on from", () => {
  it("does not land on the report that replaced it", async () => {
    // `run` retires its own outgoing requests, and nothing else did. Opening
    // another saved report while one was generating cleared the table but left
    // the sequence untouched, so the old response still passed the check and
    // wrote itself in: report A's rows appeared under report B's name, both
    // export buttons went live, and pressing Excel produced a file titled B
    // containing A. The header of the file argues at length that it must never
    // describe itself wrongly; the title did exactly that.
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 11, name: "Otro reporte", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: { root: "evento", columns: [{ path: "state" }] },
    }]));

    let land: () => void = () => {};
    api.runReporte.mockImplementationOnce(
      (config: ReportConfig) =>
        new Promise<ReportResult>((resolve) => {
          land = () => resolve(resultFor(config, { rows: [{ c0: "de la anterior" }] }));
        }),
    );

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));

    // The person gives up on it and opens something else.
    await user.click(await screen.findByText("Otro reporte"));
    land();

    await waitFor(() =>
      expect(toasts.some((t) => t.text.includes("cargado"))).toBe(true),
    );
    expect(screen.queryByText("de la anterior")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excel/i })).toBeDisabled();
  });
});

describe("paging", () => {
  it("keeps the table when the next page fails", async () => {
    // Clearing is right for Generar — rows from one configuration under a
    // header describing another is a lie on screen. It is wrong for a page: the
    // failure is usually transient (a timeout, or the thirty-a-minute limit
    // reached by holding "Siguiente"), and clearing threw away the table being
    // read, disabled both export buttons, and left the person re-running the
    // very query that had just timed out.
    api.runReporte.mockImplementation((config: ReportConfig) =>
      Promise.resolve(resultFor(config, {
        rows: [{ c0: "primera página" }],
        total: 250,
        limit: 100,
      })),
    );

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await screen.findByText("primera página");

    api.runReporte.mockRejectedValueOnce(new Error("se cayó la red"));
    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    await waitFor(() => expect(toasts[toasts.length - 1]?.kind).toBe("error"));
    expect(screen.getByText("primera página")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excel/i })).not.toBeDisabled();
  });
});

describe("what the matrix says this role may do", () => {
  // The page asked nothing and drew every button for everyone, so the server
  // answered 403 to whoever pressed one they did not hold. That cost nothing
  // while all three seeded roles held all four actions, and breaks the first
  // time someone unticks a box in Seguridad — which is the whole purpose of
  // that screen.

  it("does not offer to save without `crear`", async () => {
    grantGenerador({ crear: false });

    renderPage();
    await ready();

    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();
  });

  it("does not offer to duplicate or archive without their permissions", async () => {
    grantGenerador({ crear: false, archivar: false });
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 12, name: "De alguien", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: { root: "evento", columns: [{ path: "description" }] },
    }]));

    renderPage();
    await ready();
    await screen.findByText("De alguien");

    expect(screen.queryByRole("button", { name: /duplicar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archivar/i })).not.toBeInTheDocument();
  });

  it("still offers everything to a role that holds it", async () => {
    // The other direction matters just as much: fail-closed that hides the
    // screen from the people who may use it is the same defect wearing a
    // different coat.
    api.getReportesGuardados.mockResolvedValue(savedPage([{
      id: 13, name: "Mío", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: { root: "evento", columns: [{ path: "description" }] },
    }]));

    renderPage();
    await ready();
    await screen.findByText("Mío");

    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archivar/i })).toBeInTheDocument();
  });
});

describe("changing the level of detail", () => {
  it("asks before discarding, and keeps everything when refused", async () => {
    // The most destructive control on the page, dressed as a preference: it
    // throws away columns and filters, and it used to say so *afterwards* in a
    // message that disappears on its own. Somebody who wanted to look at the
    // other level of detail for a second lost their work and was told by a
    // toast.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await addColumn(user, /Resuelto/);

    await user.click(screen.getByLabelText("Nivel de detalle"));
    await user.click(await screen.findByRole("option", { name: /una fila por poste/i }));

    // Nothing has changed yet: it asks first, and it says what it would cost.
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Se descartarán 2 elementos/);
    expect(screen.getAllByLabelText(/Nombre de la columna/)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /dejarlo como está/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getAllByLabelText(/Nombre de la columna/)).toHaveLength(2);
  });

  it("changes and drops when accepted", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    await user.click(screen.getByLabelText("Nivel de detalle"));
    await user.click(await screen.findByRole("option", { name: /una fila por poste/i }));
    await user.click(await screen.findByRole("button", { name: /cambiar y descartar/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    // `description` does not exist under the pole root, so it is gone — and the
    // level of detail did change.
    expect(screen.queryAllByLabelText(/Nombre de la columna/)).toHaveLength(0);
  });

  it("does not ask when there is nothing to lose", async () => {
    // An empty report has nothing to discard, and a confirmation for a change
    // that costs nothing is the kind people learn to click through.
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getByLabelText("Nivel de detalle"));
    await user.click(await screen.findByRole("option", { name: /una fila por poste/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("what the screen tells you to press", () => {
  // The reason this file gained a describe block about wording: the banner said
  // "Pulse Actualizar", and the only control with that name is the save button.
  // Following the instruction wrote a half-finished configuration over the
  // stored report — for the author and for everyone it was shared with — and
  // the table still did not refresh. It came from the sibling reports screen,
  // which does rename its run button once it has generated.
  it("names the button that actually runs the report", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    // Auto off, so whatever is left on screen is the one thing telling the
    // reader what to do next.
    await user.click(screen.getByLabelText("Actualizar la tabla automáticamente"));
    await user.click(screen.getByRole("button", { name: "Generar" }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalled());

    await addColumn(user, /Resuelto/);
    await screen.findByText(/Vista previa/);

    // Read off the whole page rather than one element: the instruction lives in
    // the banner when the table survives the edit and in the preview strip when
    // it does not, and in the strip the button's name sits inside its own tag,
    // so no single element holds the phrase. What must hold across both is that
    // the screen names the button that runs the report and never names the one
    // whose only outcome is overwriting a saved report.
    expect(document.body.textContent).toMatch(/pulse Generar/i);
    expect(document.body.textContent).not.toMatch(/pulse Actualizar/i);
  });

  it("blames the filters only when there are filters", async () => {
    // A revision report whose events are all archived comes back empty through
    // the archived-parent guard, not through anything the reader typed — with
    // the filter panel beside it saying "Sin filtros".
    const user = userEvent.setup();
    api.runReporte.mockResolvedValue({
      columns: [{ key: "c0", label: "Descripción", kind: "string", path: "description" }],
      rows: [], total: 0, limit: 100, offset: 0,
    });
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: "Generar" }));

    await waitFor(() => expect(api.runReporte).toHaveBeenCalled());
    const said = toasts.map((t) => t.text).join(" | ");
    expect(said).toMatch(/no devolvió ningún registro/);
    expect(said).not.toMatch(/coincide con estos filtros/);
  });
});

describe("when the saved list cannot be read", () => {
  it("does not claim the user has never saved a report", async () => {
    // The failure only fired a toast, which disappears, and then the panel went
    // on stating "Todavía no hay reportes guardados" — a claim about somebody's
    // data made out of a failed request. Forty saved reports, told to build
    // their first.
    api.getReportesGuardados.mockRejectedValue(new Error("500"));
    renderPage();
    await ready();

    expect(await screen.findByText(/No se pudieron cargar sus reportes guardados/)).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay reportes guardados/)).not.toBeInTheDocument();
  });

  it("offers a way to try again, and clears the error when it works", async () => {
    const user = userEvent.setup();
    api.getReportesGuardados.mockRejectedValueOnce(new Error("500"));
    renderPage();
    await ready();
    await screen.findByText(/No se pudieron cargar sus reportes guardados/);

    api.getReportesGuardados.mockResolvedValue({ rows: [], total: 0, limit: 100, offset: 0 });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/Todavía no hay reportes guardados/)).toBeInTheDocument();
  });
});

describe("what the screen shows while it waits", () => {
  /** A promise that never settles, so a request can be caught mid-flight. */
  const pending = <T,>() => new Promise<T>(() => {});

  it("draws the page that is coming instead of a spinner in an empty one", async () => {
    // What used to be here was a centred spinner and then, in one frame, a
    // two-column layout with five cards in it. Nothing on screen during the
    // wait had anything to do with what arrived.
    api.getCatalogo.mockReturnValue(pending());
    renderPage();

    // The heading and the four card titles are written into this page, not
    // fetched, so they are already readable while the fields travel.
    expect(await screen.findByRole("heading", { name: "Generador de reportes" })).toBeInTheDocument();
    for (const title of ["Reportes guardados", "Nivel de detalle", "Columnas", "Filtros", "Resultado"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // And it is announced as busy, not just drawn as busy.
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("does not tell the reader they have no saved reports while the list is loading", async () => {
    // The two requests leave together and the catalog usually wins: it is a
    // fixed structure, the list joins usuarios and reads the database. So the
    // panel rendered with an empty array and stated, as a fact about somebody
    // who may have forty of them, that they had never saved one.
    api.getReportesGuardados.mockReturnValue(pending());
    renderPage();
    await ready();

    expect(screen.queryByText(/Todavía no hay reportes guardados/)).not.toBeInTheDocument();
    // Nor is it the failure state, which is a different claim again.
    expect(screen.queryByText(/No se pudieron cargar sus reportes guardados/)).not.toBeInTheDocument();
  });

  it("says there are none once the answer is actually in", async () => {
    // The skeleton must not outlive its request, or the panel waits forever.
    renderPage();
    await ready();
    expect(await screen.findByText(/Todavía no hay reportes guardados/)).toBeInTheDocument();
  });

  it("releases the skeleton when the list fails, so the error can be seen", async () => {
    api.getReportesGuardados.mockRejectedValue(new Error("500"));
    renderPage();
    await ready();
    expect(await screen.findByText(/No se pudieron cargar sus reportes guardados/)).toBeInTheDocument();
  });

  it("draws the table it is asking for, not the invitation to build one", async () => {
    // The first run had no previous table to keep, so underneath sat the empty
    // state: for the whole of the first query the screen answered "elija las
    // columnas y pulse Generar" to somebody who had just done both.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    api.runReporte.mockReturnValue(pending());
    await user.click(screen.getByRole("button", { name: "Generar" }));

    await waitFor(() => expect(api.runReporte).toHaveBeenCalled());
    expect(screen.queryByText(/Elija las columnas en el panel de configuración/)).not.toBeInTheDocument();
    // The headers are the report's own, taken from the configuration that was
    // just sent, so nothing in the header row moves when the rows land.
    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
  });

  it("hands the result a header row identical to the one it drew", async () => {
    // The claim the whole skeleton rests on: the columns do not move when the
    // rows land. It is also the failure mode that makes people say skeletons
    // feel worse than a spinner — a placeholder of the wrong shape causes a
    // bigger jump than the empty box it replaced. Without a browser here this
    // is what can be pinned: same count, same words, same order.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await addColumn(user, /Resuelto/);

    // Held open and released by hand, so the same run can be looked at twice:
    // pressing Generar again would do nothing while the first one is out.
    let release: (r: ReportResult) => void = () => {};
    let asked: ReportConfig | null = null;
    api.runReporte.mockImplementation((config: ReportConfig) => {
      asked = config;
      return new Promise<ReportResult>((resolve) => { release = resolve; });
    });

    await user.click(screen.getByRole("button", { name: "Generar" }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalled());
    const waiting = screen.getAllByRole("columnheader").map((h) => h.textContent);

    release(resultFor(asked as unknown as ReportConfig));
    await waitFor(() => expect(screen.getByText("fila")).toBeInTheDocument());
    const arrived = screen.getAllByRole("columnheader").map((h) => h.textContent);

    expect(waiting).toEqual(["Descripción", "Resuelto"]);
    expect(arrived).toEqual(waiting);
  });

  it("keeps the rows that are already on screen while the next page travels", async () => {
    // Deliberately not a skeleton. These rows are real, somebody asked for
    // them, and they stay true until the new ones land; replacing them with
    // grey bars takes away the row the reader was in the middle of.
    const user = userEvent.setup();
    api.runReporte.mockResolvedValue({
      columns: [{ key: "c0", label: "Descripción", kind: "string", path: "description" }],
      rows: [{ c0: "un evento concreto" }],
      total: 250, limit: 100, offset: 0,
    });
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: "Generar" }));
    expect(await screen.findByText("un evento concreto")).toBeInTheDocument();

    api.runReporte.mockReturnValue(pending());
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(screen.getByText("un evento concreto")).toBeInTheDocument();
  });
});

describe("the report taking shape while it is built", () => {
  it("offers reports to open before anything has been chosen", async () => {
    // What stands in the empty panel now. The bare invitation is the fallback
    // for a server that sends no templates, covered below.
    renderPage();
    await ready();

    expect(screen.getByText("Todos los eventos")).toBeInTheDocument();
    expect(screen.getByText("Listado de postes")).toBeInTheDocument();
    expect(screen.queryByText(/Vista previa/)).not.toBeInTheDocument();
  });

  it("appears with the first column, before anything has been asked for", async () => {
    // The whole point: the right-hand panel was empty until Generar was
    // pressed, so choosing a level of detail and six columns happened blind.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    expect(await screen.findByText(/Vista previa/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Descripción" })).toBeInTheDocument();
    expect(api.runReporte).not.toHaveBeenCalled();
  });

  it("grows and reorders with the column list", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await addColumn(user, /Resuelto/);

    await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent))
      .toEqual(["Descripción", "Resuelto"]));

    // Moving a column in the panel moves it in the preview: the order here is
    // the order of the exported file, and it was previously impossible to see
    // without generating.
    await user.click(screen.getByRole("button", { name: "Subir Resuelto" }));

    await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent))
      .toEqual(["Resuelto", "Descripción"]));
    expect(api.runReporte).not.toHaveBeenCalled();
  });

  it("formats its sample values the way the real table will", async () => {
    // The reason the placeholders go through `formatValue` and are not just
    // invented strings: the preview is a promise about the shape *and* the
    // formatting. A boolean column that previews "true" and returns "Sí" has
    // taught the reader the wrong thing about their own report.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Resuelto/);

    await screen.findByText(/Vista previa/);
    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(["Sí", "No"]).toContain(cell);
  });

  it("says out loud that the values are not real", async () => {
    // The one risk of a table full of invented values is somebody quoting one.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    const strip = await screen.findByText(/Vista previa/);
    expect(strip.parentElement?.textContent).toMatch(/valores son de ejemplo/i);
    // And it never states a total, which is the one placeholder that would read
    // as an answer — it is exactly the kind of number this screen produces.
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    expect(screen.queryByText(/filas en total/)).not.toBeInTheDocument();
  });

  it("gives way to the real table as soon as there is one", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await screen.findByText(/Vista previa/);

    await user.click(screen.getByRole("button", { name: "Generar" }));

    await waitFor(() => expect(screen.getByText("fila")).toBeInTheDocument());
    expect(screen.queryByText(/Vista previa/)).not.toBeInTheDocument();
  });

  it("shows fewer rows once the report groups, because a summary collapses them", async () => {
    // Grouping is the hardest idea on this screen: it turns a listing into one
    // row per distinct value. Seeing the row count drop is the cheapest way to
    // teach it, and it costs nothing to show.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await screen.findByText(/Vista previa/);
    const listing = screen.getAllByRole("row").length;

    await user.click(screen.getByRole("button", { name: "Agrupar por Descripción" }));

    await waitFor(() => expect(screen.getAllByRole("row").length).toBeLessThan(listing));
    expect(screen.getByText(/Una fila por cada grupo distinto/)).toBeInTheDocument();
  });
});

describe("the table scrolls, not the page", () => {
  it("lets both columns of the layout be narrower than their contents", async () => {
    // A class check standing in for a layout check, because jsdom has no layout
    // engine and cannot be asked how wide anything ended up.
    //
    // What it guards: a `1fr` track is `minmax(auto, 1fr)`, and that `auto`
    // minimum is the item's min-content width unless the item is a scroll
    // container. These are plain divs holding a table whose headers are
    // `whitespace-nowrap`, so the track grew to the full width of the table,
    // the grid outgrew the page, and the application's `<main>` — which is
    // `overflow-auto` — took a horizontal scrollbar. The whole page slid
    // sideways while the table sat still inside its own scroll box, never
    // asked to be any narrower.
    //
    // Losing `min-w-0` brings all of that back and nothing else fails, which
    // is why it is worth a test that only reads a class name.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    const grid = document.querySelector<HTMLElement>('[class*="lg:grid-cols-"]');
    expect(grid).not.toBeNull();
    const columns = Array.from(grid!.children) as HTMLElement[];
    expect(columns).toHaveLength(2);
    for (const column of columns) expect(column.className).toMatch(/\bmin-w-0\b/);
  });

  it("keeps the table's own scroll box around the table", async () => {
    // The other half: the column may now be narrower than the table, so
    // something has to scroll. Without this the table is simply cut off.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: "Generar" }));
    await waitFor(() => expect(screen.getByText("fila")).toBeInTheDocument());

    const table = screen.getByRole("table");
    let scrolls = false;
    for (let el = table.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/overflow-x-auto|overflow-auto/.test(el.className)) { scrolls = true; break; }
    }
    expect(scrolls).toBe(true);
  });
});

describe("something to start from", () => {
  it("says what each one is, and what a row of it will be", async () => {
    // Six names on their own are six guesses. The description is what somebody
    // chooses between them by, and the row meaning comes from the catalog —
    // which is also the quietest way to teach the level of detail.
    renderPage();
    await ready();

    // Asserted on the row itself, not on the page: "Una fila por evento" is
    // also the label of the level-of-detail option, and finding it somewhere
    // would pass with an empty gallery.
    expect(screen.getByRole("button", { name: /Todos los eventos/ }))
      .toHaveTextContent(/Cada evento con su descripción.*Una fila por evento/s);
    expect(screen.getByRole("button", { name: /Listado de postes/ }))
      .toHaveTextContent("Una fila por poste");
  });

  it("loads the report when it is pressed", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getByRole("button", { name: /Todos los eventos/ }));

    // The columns are in the builder, and the preview is already drawing them.
    await waitFor(() => expect(screen.getAllByRole("columnheader").map((h) => h.textContent))
      .toEqual(["Descripción", "Resuelto"]));
    expect(screen.getByText(/Vista previa/)).toBeInTheDocument();
  });

  it("carries the level of detail, not just the columns", async () => {
    // A template on another root is the case that breaks if only the columns
    // are copied: "Nº de poste" does not exist on the evento root, so the whole
    // configuration has to travel.
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getByRole("button", { name: /Listado de postes/ }));

    await waitFor(() => expect(screen.getByLabelText("Nivel de detalle"))
      .toHaveTextContent("Una fila por poste"));
  });

  it("cannot overwrite a saved report, because it is not one", async () => {
    // The trap this avoids. Opening a saved report makes the save button read
    // "Actualizar", and pressing it overwrites that report — for the team too,
    // if it was shared. A template is nobody's saved report, so the button has
    // to go on saying "Guardar" or the first press writes over whichever report
    // happened to be open before.
    const user = userEvent.setup();
    api.getReportesGuardados.mockResolvedValue(savedPage([
      { id: 4, name: "El mío", description: null, visibility: "private", id_usuario: 7,
        config: { root: "evento", columns: [{ path: "description" }], filters: { op: "and", conditions: [] } } },
    ]));
    renderPage();
    await ready();

    // `^` because the archive button beside it is named "Archivar «El mío»".
    await user.click(screen.getByRole("button", { name: /^El mío/ }));
    expect(await screen.findByRole("button", { name: /^Actualizar$/ })).toBeInTheDocument();

    // Not through "Nuevo": that clears the open report on its own, so it would
    // hide whether picking a template clears it. The path that actually reaches
    // the defence is emptying the report — the gallery comes back while the
    // saved report is still open, and from there one press would otherwise
    // write a template over somebody's saved report.
    await user.click(screen.getByRole("button", { name: "Quitar Descripción" }));
    await user.click(await screen.findByRole("button", { name: /Todos los eventos/ }));

    expect(await screen.findByRole("button", { name: /^Guardar$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Actualizar$/ })).not.toBeInTheDocument();
  });

  it("falls back to the plain invitation when the server sends none", async () => {
    // An older server has no templates to send. The page loses the gallery, not
    // its ability to load.
    api.getCatalogo.mockResolvedValue({ ...catalog, templates: undefined });
    renderPage();
    await ready();

    expect(screen.getByText(/Elija las columnas en el panel de configuración/)).toBeInTheDocument();
    expect(screen.queryByText("Todos los eventos")).not.toBeInTheDocument();
  });
});

describe("the explanations that sit next to what they explain", () => {
  it("states the grouping rule while the report groups, and not before", async () => {
    // Until now the only place this rule appeared was the refusal — after the
    // columns were chosen, Generar was pressed, and the answer was no.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);

    expect(screen.queryByText(/toda columna tiene que estar agrupada/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agrupar por Descripción" }));

    expect(await screen.findByText(/toda columna tiene que estar agrupada/)).toBeInTheDocument();
  });

  it("says what a «Contar…» is, in the picker that offers them", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getAllByRole("button", { name: /añadir columna/i })[0]);

    expect(await screen.findByText(/no son un dato guardado/)).toBeInTheDocument();
  });

  it("does not explain counters on a level of detail that has none", async () => {
    // The poste root has no to-many relation in this fixture, so the picker
    // offers no "Contar…" and must not carry an explanation of something the
    // reader cannot see.
    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(screen.getByRole("button", { name: /Listado de postes/ }));
    await waitFor(() => expect(screen.getByLabelText("Nivel de detalle"))
      .toHaveTextContent("Una fila por poste"));

    await user.click(screen.getAllByRole("button", { name: /añadir columna/i })[0]);

    expect(await screen.findByPlaceholderText("Buscar campo…")).toBeInTheDocument();
    expect(screen.queryByText(/no son un dato guardado/)).not.toBeInTheDocument();
  });

  it("has a help panel that names the one thing nothing else on the screen says", async () => {
    // The PDF drops photographs and no control admits it: the only hint is a
    // switch reading "Fotos en el Excel", and the column comes out of the PDF
    // as a column of "Sí".
    const user = userEvent.setup();
    renderPage();
    await ready();

    await user.click(screen.getByRole("button", { name: "Cómo funciona el generador" }));

    expect(await screen.findByText(/no lleva/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/fotograf/i);
  });
});
