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
  getReportesGuardados: vi.fn(),
  crearReporte: vi.fn(),
  actualizarReporte: vi.fn(),
  eliminarReporte: vi.fn(),
  duplicarReporte: vi.fn(),
};

vi.mock("../../../api/generador.api", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../api/generador.api");
  return {
    ...actual,
    getCatalogo: (...a: unknown[]) => api.getCatalogo(...a),
    runReporte: (...a: unknown[]) => api.runReporte(...a),
    getReportesGuardados: (...a: unknown[]) => api.getReportesGuardados(...a),
    crearReporte: (...a: unknown[]) => api.crearReporte(...a),
    actualizarReporte: (...a: unknown[]) => api.actualizarReporte(...a),
    eliminarReporte: (...a: unknown[]) => api.eliminarReporte(...a),
    duplicarReporte: (...a: unknown[]) => api.duplicarReporte(...a),
  };
});

const toasts: { kind: string; text: string }[] = [];
vi.mock("sonner", () => ({
  toast: {
    success: (t: string) => toasts.push({ kind: "success", text: t }),
    error: (t: string) => toasts.push({ kind: "error", text: t }),
    warning: (t: string) => toasts.push({ kind: "warning", text: t }),
    info: (t: string) => toasts.push({ kind: "info", text: t }),
  },
}));

vi.mock("../../../lib/exports/dynamicExcel", () => ({ exportDynamicExcel: vi.fn() }));
vi.mock("../../../lib/exports/dynamicPdf", () => ({ exportDynamicPdf: vi.fn() }));

const GeneradorPage = (await import("./index")).default;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const catalog: Catalog = {
  limits: { maxColumns: 60, maxConditions: 100, maxSorts: 10, maxRows: 50000, maxDepth: 3 },
  roots: [
    {
      key: "evento", label: "Evento", rowMeaning: "Una fila por evento",
      fields: [
        { path: "description", label: "Descripción", kind: "string", group: "Evento", operators: ["like"], aggregates: ["count"] },
        { path: "state", label: "Resuelto", kind: "boolean", group: "Evento", operators: ["eq"], aggregates: ["count"] },
      ],
      aggregateOnly: [],
    },
    {
      key: "poste", label: "Poste", rowMeaning: "Una fila por poste",
      fields: [{ path: "name", label: "Nº de poste", kind: "string", group: "Poste", operators: ["like"], aggregates: ["count"] }],
      aggregateOnly: [],
    },
  ],
};

const resultFor = (config: ReportConfig, over: Partial<ReportResult> = {}): ReportResult => ({
  columns: config.columns.map((c, i) => ({ key: `c${i}`, label: c.path, kind: "string" as const })),
  rows: [{ c0: "fila" }],
  total: 1,
  limit: config.limit ?? 100,
  offset: config.offset ?? 0,
  ...over,
});

const sesion = {
  sesion: { token: "t0", usuario: { ...usuarioExample, id: 7 } },
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

/** Waits until the catalog has loaded and the builder is on screen. */
const ready = async () => {
  await waitFor(() => expect(screen.getByText("Columnas")).toBeInTheDocument());
};

const addColumn = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getAllByRole("button", { name: /añadir columna/i })[0]);
  await user.click(screen.getByRole("option", { name }));
};

beforeEach(() => {
  vi.clearAllMocks();
  toasts.length = 0;
  api.getCatalogo.mockResolvedValue(catalog);
  api.getReportesGuardados.mockResolvedValue([]);
  api.runReporte.mockImplementation((config: ReportConfig) => Promise.resolve(resultFor(config)));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("catalog loading", () => {
  it("fetches the catalog once, not on every token renewal", async () => {
    // The server re-issues the token on every response. When the effect
    // depended on it, generating a report wiped the configuration and reset
    // the detail level to "evento".
    const { rerender } = renderPage();
    await ready();
    expect(api.getCatalogo).toHaveBeenCalledTimes(1);

    rerender(
      <SesionContext.Provider value={{ ...sesion, sesion: { ...sesion.sesion, token: "t1" } } as never}>
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

  it("warns that the table no longer matches the configuration", async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(api.runReporte).toHaveBeenCalled());

    await addColumn(user, /Resuelto/);
    expect(await screen.findByRole("status")).toHaveTextContent(/Cambió la configuración/);
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

    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
    expect(toasts[toasts.length - 1]?.kind).toBe("error");
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

    // Edit after generating, then page.
    await addColumn(user, /Resuelto/);
    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    const paged = api.runReporte.mock.calls[api.runReporte.mock.calls.length - 1]?.[0] as ReportConfig;
    expect(paged.offset).toBe(100);
    expect(paged.columns).toHaveLength(1);   // the configuration that was run
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
    api.getReportesGuardados.mockResolvedValue([theirs]);
    api.crearReporte.mockResolvedValue({ ...theirs, id: 6, id_usuario: 7 });

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("De Ana"));

    // The action reads "Guardar", never "Actualizar", for a report that is not ours.
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    expect(screen.getByText(/se guardará como copia suya/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar reporte/i }));
    await waitFor(() => expect(api.crearReporte).toHaveBeenCalled());
    expect(api.actualizarReporte).not.toHaveBeenCalled();
  });

  it("says what it dropped when a saved report names unavailable fields", async () => {
    api.getReportesGuardados.mockResolvedValue([{
      id: 8, name: "Con campos ajenos", description: null, id_usuario: 7,
      visibility: "private", favorite: false,
      config: {
        root: "evento",
        columns: [{ path: "description" }, { path: "usuario.name" }, { path: "usuario.phone" }],
      },
    }]);

    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(await screen.findByText("Con campos ajenos"));

    expect(toasts[toasts.length - 1]?.text).toMatch(/sin 2 elementos que su perfil no puede consultar/);
    expect(screen.getAllByLabelText(/Nombre de la columna/)).toHaveLength(1);
  });
});

describe("exporting", () => {
  it("fetches every row rather than exporting the page on screen", async () => {
    api.runReporte.mockImplementation((config: ReportConfig) =>
      Promise.resolve(resultFor(config, { total: 4300, rows: [{ c0: "x" }] })));

    const user = userEvent.setup();
    renderPage();
    await ready();
    await addColumn(user, /Descripción/);
    await user.click(screen.getByRole("button", { name: /generar/i }));
    await waitFor(() => expect(screen.getByText(/Mostrando/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /excel/i }));

    await waitFor(() => {
      const last = api.runReporte.mock.calls[api.runReporte.mock.calls.length - 1]?.[0] as ReportConfig;
      expect(last.limit).toBe(4300);
      expect(last.offset).toBe(0);
    });
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
