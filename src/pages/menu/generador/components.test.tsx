import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../../../components/ui/tooltip";
import type { CatalogRoot, ReportConfig, ReportResult, SavedReport } from "../../../api/generador.api";
import { emptyConfig } from "../../../lib/reportConfig";

import ColumnList from "./ColumnList";
import FieldPicker from "./FieldPicker";
import FilterBuilder from "./FilterBuilder";
import PreviewTable from "./PreviewTable";
import SavedReports from "./SavedReports";

const root: CatalogRoot = {
  key: "evento",
  label: "Evento",
  rowMeaning: "Una fila por evento",
  fields: [
    { path: "description", label: "Descripción", kind: "string", group: "Evento", operators: ["like", "eq", "isnull"], aggregates: ["count"] },
    { path: "date", label: "Fecha del evento", kind: "date", group: "Evento", operators: ["between", "gte"], aggregates: ["count", "min", "max"] },
    { path: "state", label: "Resuelto", kind: "boolean", group: "Evento", operators: ["eq"], aggregates: ["count"] },
    { path: "poste.tramo", label: "Tramo", kind: "string", group: "Evento › Poste", operators: ["eq"], aggregates: ["count"], calculated: true },
  ],
  aggregateOnly: [{ path: "revisiones", label: "Revisiones", group: "Evento" }],
};

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("FieldPicker", () => {
  const openPicker = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: /añadir columna/i }));

  it("lists fields grouped by origin and reports the chosen one", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={onPick} />);

    await openPicker(user);
    expect(screen.getByText("Evento › Poste")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /^Tramo/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "poste.tramo" }));
  });

  it("filters the list as the user types", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    await user.type(screen.getByLabelText("Buscar campo"), "tram");

    expect(screen.getByRole("option", { name: /^Tramo/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Descripción" })).not.toBeInTheDocument();
  });

  it("also searches by where the field comes from", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    await user.type(screen.getByLabelText("Buscar campo"), "poste");

    expect(screen.getByRole("option", { name: /^Tramo/ })).toBeInTheDocument();
  });

  it("explains when nothing matches", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    await user.type(screen.getByLabelText("Buscar campo"), "zzzz");

    expect(screen.getByText(/ningún campo coincide/i)).toBeInTheDocument();
  });

  it("picks the first match with the keyboard alone", async () => {
    // Typing and pressing Enter used to do nothing: the list was a pile of
    // buttons, so it had to be tabbed through.
    const onPick = vi.fn();
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={onPick} />);

    await openPicker(user);
    await user.type(screen.getByLabelText("Buscar campo"), "tram{Enter}");
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "poste.tramo" }));
  });

  it("moves the selection with the arrow keys", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={onPick} />);

    await openPicker(user);
    const search = screen.getByLabelText("Buscar campo");
    await user.type(search, "{ArrowDown}{Enter}");
    // Second entry of the catalog, not the first.
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "date" }));
  });

  it("marks fields already in the report", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set(["description"])} onPick={vi.fn()} />);

    await openPicker(user);
    const option = screen.getByRole("option", { name: /Descripción/ });
    expect(option).toHaveClass("text-muted-foreground");
  });

  it("offers to-many relations as aggregates, showing where they come from", async () => {
    const onPickAggregate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} onPickAggregate={onPickAggregate} />,
    );

    await openPicker(user);
    await user.click(screen.getByRole("option", { name: /nº de revisiones/i }));
    expect(onPickAggregate).toHaveBeenCalledWith("revisiones", "Revisiones");
  });
});

describe("ColumnList", () => {
  const config: ReportConfig = {
    ...emptyConfig("evento"),
    columns: [{ path: "description" }, { path: "poste.tramo" }],
  };

  it("invites the user to start when there are no columns", () => {
    wrap(
      <ColumnList
        config={emptyConfig("evento")} root={root}
        onMove={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByText(/sin columnas todavía/i)).toBeInTheDocument();
  });

  it("cannot move the first column up nor the last down", () => {
    wrap(
      <ColumnList
        config={config} root={root}
        onMove={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    const up = screen.getAllByRole("button", { name: /^Subir / });
    const down = screen.getAllByRole("button", { name: /^Bajar / });
    expect(up[0]).toBeDisabled();
    expect(down[down.length - 1]).toBeDisabled();
  });

  it("moves a column down", async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    wrap(
      <ColumnList
        config={config} root={root}
        onMove={onMove} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: /^Bajar / })[0]);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it("removes a column by its field name", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    wrap(
      <ColumnList
        config={config} root={root}
        onMove={vi.fn()} onRemove={onRemove} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Quitar Tramo" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("shows the catalog label as placeholder until renamed", () => {
    wrap(
      <ColumnList
        config={config} root={root}
        onMove={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nombre de la columna Descripción")).toHaveAttribute("placeholder", "Descripción");
  });

  it("marks a grouped column as pressed and hides its aggregate selector", () => {
    wrap(
      <ColumnList
        config={{ ...config, groupBy: ["poste.tramo"] }} root={root}
        onMove={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /dejar de agrupar/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Resumen de Tramo")).not.toBeInTheDocument();
    expect(screen.getByText(/cada columna no agrupada necesita un resumen/i)).toBeInTheDocument();
  });
});

describe("FilterBuilder", () => {
  const withFilter = (value?: unknown, operator: "like" | "between" | "isnull" = "like"): ReportConfig => ({
    ...emptyConfig("evento"),
    filters: {
      op: "and",
      conditions: [{ path: operator === "between" ? "date" : "description", operator, ...(value !== undefined ? { value } : {}) }],
    },
  });

  it("says so when there are no filters", () => {
    wrap(
      <FilterBuilder config={emptyConfig("evento")} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    expect(screen.getByText(/incluirá todos los registros/i)).toBeInTheDocument();
  });

  it("edits the value of a text filter", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder config={withFilter("")} root={root} onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Valor para Descripción"), "roto");
    expect(onUpdate).toHaveBeenCalledWith(0, { value: "r" });
  });

  it("shows two inputs for a range", () => {
    wrap(
      <FilterBuilder
        config={withFilter(["2026-01-01", "2026-06-30"], "between")}
        root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Desde, Fecha del evento")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Hasta, Fecha del evento")).toHaveValue("2026-06-30");
  });

  it("hides the value input for is-empty filters", () => {
    wrap(
      <FilterBuilder config={withFilter(undefined, "isnull")} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    expect(screen.queryByLabelText(/valor para/i)).not.toBeInTheDocument();
  });

  it("offers the and/or choice only with more than one filter", () => {
    const { rerender } = wrap(
      <FilterBuilder config={withFilter("x")} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Combinación de filtros")).not.toBeInTheDocument();

    const two: ReportConfig = {
      ...emptyConfig("evento"),
      filters: {
        op: "and",
        conditions: [
          { path: "description", operator: "like", value: "a" },
          { path: "state", operator: "eq", value: true },
        ],
      },
    };
    rerender(
      <TooltipProvider>
        <FilterBuilder config={two} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText("Combinación de filtros")).toBeInTheDocument();
  });
});

describe("PreviewTable", () => {
  const result: ReportResult = {
    columns: [
      { key: "c0", label: "Descripción", kind: "string" },
      { key: "c1", label: "Resuelto", kind: "boolean" },
      { key: "c2", label: "Días", kind: "number" },
    ],
    rows: [
      { c0: "Poste inclinado", c1: false, c2: 12 },
      { c0: null, c1: true, c2: 3.14159 },
    ],
    total: 250,
    limit: 100,
    offset: 100,
  };

  it("formats each cell according to its type", () => {
    wrap(<PreviewTable result={result} onPage={vi.fn()} />);
    expect(screen.getByText("Poste inclinado")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Sí")).toBeInTheDocument();
    expect(screen.getByText("3,14")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("reports the visible range and the page", () => {
    wrap(<PreviewTable result={result} onPage={vi.fn()} />);
    expect(screen.getByText("Mostrando 101–102 de 250")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("pages backwards and forwards from the current offset", async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();
    wrap(<PreviewTable result={result} onPage={onPage} />);

    await user.click(screen.getByRole("button", { name: /anterior/i }));
    expect(onPage).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(onPage).toHaveBeenCalledWith(200);
  });

  it("disables paging at the edges", () => {
    wrap(<PreviewTable result={{ ...result, offset: 0, total: 2 }} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("explains an empty result rather than showing a blank table", () => {
    wrap(<PreviewTable result={{ ...result, rows: [], total: 0, offset: 0 }} onPage={vi.fn()} />);
    expect(screen.getByText(/ningún registro coincide/i)).toBeInTheDocument();
  });
});

describe("SavedReports", () => {
  const mine: SavedReport = {
    id: 1, name: "Pendientes por tramo", description: "Los que faltan",
    config: emptyConfig("evento"), id_usuario: 7, visibility: "private", favorite: false,
  };
  const theirs: SavedReport = {
    id: 2, name: "Resumen mensual", description: null,
    config: emptyConfig("evento"), id_usuario: 9, visibility: "shared", favorite: false,
    usuario: { id: 9, name: "Ana", lastname: "Rojas" },
  };

  it("invites the user to save the first one", () => {
    wrap(
      <SavedReports
        reports={[]} currentId={null} currentUserId={7}
        onOpen={vi.fn()} onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/todavía no hay reportes guardados/i)).toBeInTheDocument();
  });

  it("opens a report when its name is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    wrap(
      <SavedReports
        reports={[mine]} currentId={null} currentUserId={7}
        onOpen={onOpen} onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Pendientes por tramo"));
    expect(onOpen).toHaveBeenCalledWith(mine);
  });

  it("only offers favourite and delete on your own reports", () => {
    wrap(
      <SavedReports
        reports={[mine, theirs]} currentId={null} currentUserId={7}
        onOpen={vi.fn()} onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /marcar Pendientes por tramo como favorito/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resumen mensual como favorito/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar Resumen mensual/i })).not.toBeInTheDocument();
    // Duplicating someone else's shared report is allowed.
    expect(screen.getByRole("button", { name: /duplicar Resumen mensual/i })).toBeInTheDocument();
  });

  it("credits the author of a shared report", () => {
    wrap(
      <SavedReports
        reports={[theirs]} currentId={null} currentUserId={7}
        onOpen={vi.fn()} onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("De Ana Rojas")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    wrap(
      <SavedReports
        reports={[mine]} currentId={null} currentUserId={7}
        onOpen={vi.fn()} onToggleFavorite={vi.fn()} onDuplicate={vi.fn()} onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: /eliminar Pendientes por tramo/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/¿Eliminar «Pendientes por tramo»\?/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(onDelete).toHaveBeenCalledWith(mine);
  });
});
