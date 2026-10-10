import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../../../components/ui/tooltip";
import type { CatalogRoot, ReportConfig, ReportResult, SavedReport } from "../../../api/generador.api";
import {
  emptyConfig, operatorNeedsTwoValues, operatorNeedsValue, renameColumn, updateFilter,
} from "../../../lib/reportConfig";

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
    { path: "altura", label: "Altura", kind: "number", group: "Evento", operators: ["between", "gte"], aggregates: ["count", "sum"] },
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
    await user.click(screen.getByRole("button", { name: /^Poste/ }));

    await user.click(screen.getByRole("option", { name: /^Tramo/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "poste.tramo" }));
  });

  it("opens on the root's own fields and keeps every other group folded", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    expect(screen.getByRole("button", { name: /^Evento/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Descripción" })).toBeInTheDocument();

    // The count is what says a folded group is worth opening.
    const poste = screen.getByRole("button", { name: /^Poste/ });
    expect(poste).toHaveAttribute("aria-expanded", "false");
    expect(poste).toHaveTextContent("1");
    expect(screen.queryByRole("option", { name: /^Tramo/ })).not.toBeInTheDocument();
  });

  it("folds a group again, the root's included", async () => {
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: /^Evento/ }));
    expect(screen.queryByRole("option", { name: "Descripción" })).not.toBeInTheDocument();
  });

  it("finds a field inside a folded group when searching", async () => {
    // The one way a folded list could be worse than the flat one it replaces.
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    expect(screen.queryByRole("option", { name: /^Tramo/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar campo"), "tram");

    expect(screen.getByRole("option", { name: /^Tramo/ })).toBeInTheDocument();
    // Nothing to fold while searching: every match is already in view.
    expect(screen.queryByRole("button", { name: /^Poste/ })).not.toBeInTheDocument();
  });

  it("does not walk the arrow keys into a folded group", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={onPick} />);

    await openPicker(user);
    // Up from the first entry wraps to the last one on screen, and "Tramo",
    // last in the catalog, is folded away.
    await user.type(screen.getByLabelText("Buscar campo"), "{ArrowUp}{Enter}");
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "state" }));
  });

  it("keeps typing in the search box after a group is opened", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={onPick} />);

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: /^Poste/ }));
    // Focus is back in the box and the highlight is on the group just opened.
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ path: "poste.tramo" }));
  });

  it("remembers an opened group the next time the picker opens", async () => {
    // Picking closes the picker, and columns from one group are added in runs.
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} />);

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: /^Poste/ }));
    await user.click(screen.getByRole("option", { name: /^Tramo/ }));

    await openPicker(user);
    expect(screen.getByRole("option", { name: /^Tramo/ })).toBeInTheDocument();
  });

  it("files a count under the group of the relation it counts", async () => {
    // Counts used to trail the whole list under a second copy of their header.
    const user = userEvent.setup();
    wrap(<FieldPicker root={root} chosen={new Set()} onPick={vi.fn()} onPickAggregate={vi.fn()} />);

    await openPicker(user);
    expect(screen.getAllByRole("button", { name: /^Evento/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^Evento/ })).toHaveTextContent("5");
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
    await user.click(screen.getByRole("option", { name: /contar revisiones/i }));
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
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByText(/sin columnas todavía/i)).toBeInTheDocument();
  });

  it("gives every column a handle to drag it by", () => {
    // What replaced the ↑↓ pair in every row. Two buttons that moved a column
    // one place per press is eleven presses to bring the twelfth column to the
    // front, and this list holds up to sixty.
    //
    // Only the handle drags. The row carries a text box that has to be
    // selectable, so a draggable row would fight every rename.
    wrap(
      <ColumnList
        config={config} root={root}
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );

    const handles = screen.getAllByRole("button", { name: /^Mover / });
    expect(handles).toHaveLength(config.columns.length);
    // Named after the column, not "arrastrar": one handle per row and they are
    // told apart by what they move.
    expect(handles[0]).toHaveAccessibleName("Mover Descripción");
    expect(screen.queryAllByRole("button", { name: /^Subir |^Bajar / })).toHaveLength(0);
  });

  it("leaves the handle reachable from the keyboard", () => {
    // The one thing removing the arrows could have cost. dnd-kit's keyboard
    // sensor drives the reorder from here — focus it, space, arrows, space —
    // so the handle has to be a real focusable control and not an icon in a
    // div. The gesture itself cannot be exercised in this environment, which
    // draws nothing and measures nothing; `moveColumnByKey` is where the
    // reordering rules are tested.
    wrap(
      <ColumnList
        config={config} root={root}
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );

    const handle = screen.getAllByRole("button", { name: /^Mover / })[0];
    handle.focus();
    expect(handle).toHaveFocus();
    expect(handle).toHaveAttribute("aria-roledescription");
  });

  it("removes a column by its field name", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    wrap(
      <ColumnList
        config={config} root={root}
        onReorder={vi.fn()} onRemove={onRemove} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Quitar Tramo" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("shows the catalog label as placeholder until renamed", () => {
    wrap(
      <ColumnList
        config={config} root={root}
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nombre de la columna Descripción")).toHaveAttribute("placeholder", "Descripción");
  });

  it("puts every control on the pill itself", () => {
    // They sat behind a press for a while, because the panel was a quarter of
    // the configuration band and a row had around 260 pixels to fit a text box,
    // a select and three buttons into. The band is two panels wide now, so a
    // pill has around 640 — and a control you can see and reach beats a control
    // one press away, every time.
    wrap(
      <ColumnList
        config={config} root={root}
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );

    // Asserted inside the one pill, not on the page: with two columns on
    // screen, "there is a sort button somewhere" would pass while this pill had
    // none of its own.
    const pill = screen.getByLabelText("Nombre de la columna Descripción").closest("li");
    expect(pill).not.toBeNull();
    const on = within(pill as HTMLElement);
    expect(on.getByLabelText("Resumen de Descripción")).toBeInTheDocument();
    expect(on.getByRole("button", { name: "Ordenar por Descripción" })).toBeInTheDocument();
    expect(on.getByRole("button", { name: "Agrupar por Descripción" })).toBeInTheDocument();
    expect(on.getByRole("button", { name: "Quitar Descripción" })).toBeInTheDocument();
    expect(on.getByRole("button", { name: "Mover Descripción" })).toBeInTheDocument();
  });

  it("lets a header be typed, not just its first letter", async () => {
    // This was broken, and quietly: a column's identity used to include its
    // header, the list used that identity as its React key, so every keystroke
    // produced a new key, React threw the row away and built another, and the
    // box lost focus. Renaming a column was impossible — only the first letter
    // ever landed — and nothing on screen said so.
    //
    // It needs the state to be real, which is why this drives a small harness
    // rather than a stub: with `onRename` mocked the value never changes and
    // the bug cannot happen.
    const Harness = () => {
      const [live, setLive] = useState<ReportConfig>(config);
      return (
        <ColumnList
          config={live} root={root}
          onReorder={vi.fn()} onRemove={vi.fn()}
          onRename={(i, label) => setLive((c) => renameColumn(c, i, label))}
          onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
        />
      );
    };

    const user = userEvent.setup();
    wrap(<Harness />);

    const box = screen.getByLabelText("Nombre de la columna Descripción");
    await user.click(box);
    await user.keyboard("Detalle");

    expect(screen.getByLabelText("Nombre de la columna Descripción")).toHaveValue("Detalle");
  });

  it("marks a grouped column as pressed and hides its aggregate selector", () => {
    wrap(
      <ColumnList
        config={{ ...config, groupBy: ["poste.tramo"] }} root={root}
        onReorder={vi.fn()} onRemove={vi.fn()} onRename={vi.fn()} onSetAgg={vi.fn()} onToggleGroup={vi.fn()} onToggleSort={vi.fn()}
      />,
    );
    // The rule itself is stated once, by the page, above the list.
    expect(screen.queryByText(/necesita un resumen/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dejar de agrupar/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Resumen de Tramo")).not.toBeInTheDocument();
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

  it("shows a range of dates as one span, in the reader's own notation", () => {
    // One control for both ends, not two calendars side by side: choosing a
    // period is a single act, and split in two there was no moment where the
    // span itself was on screen. What carries the value is what the trigger
    // says — and it says it the way it is read here, not the way it travels.
    wrap(
      <FilterBuilder
        config={withFilter(["2026-01-01", "2026-06-30"], "between")}
        root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );

    const trigger = screen.getByLabelText(/^Rango para Fecha del evento/);
    expect(trigger).toHaveTextContent("01/01/2026");
    expect(trigger).toHaveTextContent("30/06/2026");
    // And the pair of boxes it replaced is gone, rather than both being drawn.
    expect(screen.queryByLabelText(/^Desde, Fecha del evento/)).not.toBeInTheDocument();
  });

  it("keeps two boxes for a range of numbers, which has no picker", () => {
    // The range picker is for dates. "Entre 5 y 20" is two facts and stays two
    // boxes — the branch is on the field's kind, not on the operator alone.
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      filters: {
        op: "and",
        conditions: [{ path: "altura", operator: "between", value: ["5", "20"] }],
      },
    };
    wrap(
      <FilterBuilder config={config} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    expect(screen.getByLabelText("Desde, Altura")).toHaveValue("5");
    expect(screen.getByLabelText("Hasta, Altura")).toHaveValue("20");
    expect(screen.queryByLabelText(/^Rango para/)).not.toBeInTheDocument();
  });

  it("writes a picked date back the way the server reads it", async () => {
    // The wire format is the one thing that must not change with the control:
    // a plain "yyyy-MM-dd". And it must be the day that was clicked — building
    // the Date from the stored string with `new Date()` lands on UTC midnight,
    // which is the day before for anybody west of Greenwich, and every open of
    // the calendar would walk the filter one day back.
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    const config: ReportConfig = {
      ...emptyConfig("evento"),
      filters: {
        op: "and",
        conditions: [{ path: "date", operator: "gte", value: "2026-03-15" }],
      },
    };
    wrap(
      <FilterBuilder
        config={config}
        root={root} onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );

    const trigger = screen.getByLabelText(/^Valor para Fecha del evento/);
    expect(trigger).toHaveTextContent("15/03/2026");

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: /20 de marzo de 2026/ }));

    expect(onUpdate).toHaveBeenCalledWith(0, { value: "2026-03-20" });
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

describe("FilterBuilder — filters it cannot edit", () => {
  // Nested groups and existence filters only ever arrive inside a saved report.
  // The row used to read "Filtro avanzado" and nothing else: a condition that
  // shaped the whole report, with a button to delete it and no way to know what
  // deleting it would change.
  const advanced = (conditions: NonNullable<ReportConfig["filters"]>["conditions"]) =>
    wrap(
      <FilterBuilder
        config={{ ...emptyConfig("evento"), filters: { op: "and", conditions } }}
        root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );

  it("reads a nested group back as a sentence", () => {
    advanced([{
      op: "or",
      conditions: [
        { path: "description", operator: "like", value: "poste" },
        { path: "state", operator: "eq", value: true },
      ],
    }]);
    expect(screen.getByText("Descripción contiene «poste» o Resuelto es igual a Sí")).toBeInTheDocument();
  });

  it("writes a date the way the rest of the panel does", () => {
    advanced([{
      op: "and",
      conditions: [{ path: "date", operator: "between", value: ["2026-01-01", "2026-06-30"] }],
    }]);
    expect(screen.getByText("Fecha del evento está entre 01/01/2026 y 30/06/2026")).toBeInTheDocument();
  });

  it("brackets a group inside a group, where the order of y and o matters", () => {
    advanced([{
      op: "and",
      conditions: [
        { path: "state", operator: "eq", value: false },
        {
          op: "or",
          conditions: [
            { path: "description", operator: "isnull" },
            { path: "altura", operator: "gte", value: 12 },
          ],
        },
      ],
    }]);
    expect(
      screen.getByText("Resuelto es igual a No y (Descripción está vacío o Altura es mayor o igual que 12)"),
    ).toBeInTheDocument();
  });

  it("names the relation an existence filter asks about", () => {
    advanced([
      { exists: "revisiones" },
      { exists: "revisiones", negate: true },
      {
        exists: "revisiones",
        where: { op: "and", conditions: [{ path: "x", operator: "eq", value: 1 }] },
      },
    ]);
    expect(screen.getByText("Tiene revisiones")).toBeInTheDocument();
    expect(screen.getByText("No tiene revisiones")).toBeInTheDocument();
    expect(screen.getByText("Tiene revisiones que cumplen 1 condición")).toBeInTheDocument();
  });
});

describe("FilterBuilder — the list operator", () => {
  const inFilter = (value?: unknown): ReportConfig => ({
    ...emptyConfig("evento"),
    filters: {
      op: "and",
      conditions: [{ path: "description", operator: "in", ...(value !== undefined ? { value } : {}) }],
    },
  });

  it("lets a comma be typed", async () => {
    // The list was derived from the configuration and the configuration dropped
    // the empty last segment — correctly — so "1," turned straight back into
    // "1", React wrote that into the box, and the separator vanished under the
    // caret. Typing `poste,cable` produced the single value `postecable`: the
    // report came back empty and the screen said no record matched a filter the
    // person never built. Pasting was the only way in.
    const onUpdate = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterBuilder config={inFilter([])} root={root} onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );

    const box = screen.getByLabelText(/Valores para Descripción/i);
    await user.type(box, "poste,cable");

    expect((box as HTMLInputElement).value).toBe("poste,cable");
    expect(onUpdate).toHaveBeenLastCalledWith(0, { value: ["poste", "cable"] });
  });

  it("adopts a value that changed elsewhere", async () => {
    // Holding the text locally must not stop a saved report from filling it in.
    const { rerender } = render(
      <FilterBuilder config={inFilter([])} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );
    rerender(
      <FilterBuilder config={inFilter(["uno", "dos"])} root={root} onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()} />,
    );

    expect((screen.getByLabelText(/Valores para Descripción/i) as HTMLInputElement).value)
      .toBe("uno, dos");
  });
});

describe("FilterBuilder — the fields whose values are a closed list", () => {
  // A filter compares strings exactly, so a lowercase "tigo" or one trailing
  // space matches nothing and the report comes back empty — indistinguishable
  // from data that genuinely has none. These fields hand over the list instead.
  const conLista: CatalogRoot = {
    ...root,
    fields: [
      ...root.fields,
      {
        path: "poste.propietario.name", label: "Propietario", kind: "string",
        group: "Evento › Poste", operators: ["eq", "neq", "like", "in", "isnull"],
        aggregates: ["count"], optionList: "propietario.name",
      },
    ],
  };
  const listas = { "propietario.name": ["Cotas", "Entel", "Tigo"] };

  const filtro = (operator: string, value?: unknown): ReportConfig => ({
    ...emptyConfig("evento"),
    filters: {
      op: "and",
      conditions: [{
        path: "poste.propietario.name",
        operator: operator as "eq",
        ...(value !== undefined ? { value } : {}),
      }],
    },
  });

  it("se elige de una lista en vez de teclearse", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("eq")} root={conLista} optionLists={listas}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );

    const boton = screen.getByLabelText("Valor para Propietario");
    // Both halves matter: that the picker is there, and that there is no box to
    // mistype into. The second assertion alone passes on a component that
    // rendered nothing at all.
    expect(boton).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Valor para Propietario" })).not.toBeInTheDocument();

    await user.click(boton);
    await user.click(screen.getByText("Tigo"));
    expect(onUpdate).toHaveBeenCalledWith(0, { value: "Tigo" });
  });

  it("se puede buscar dentro de la lista", async () => {
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("eq")} root={conLista} optionLists={listas}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Valor para Propietario"));
    await user.type(screen.getByPlaceholderText("Buscar…"), "ent");
    expect(screen.getByText("Entel")).toBeInTheDocument();
    expect(screen.queryByText("Tigo")).not.toBeInTheDocument();
  });

  it("un valor guardado que ya no está en la lista se sigue viendo", () => {
    // A saved report can name an owner archived since. Dropping it would leave
    // the box reading "Elija un valor" over a filter that is set and running.
    wrap(
      <FilterBuilder
        config={filtro("eq", "Viva")} root={conLista} optionLists={listas}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByText(/Viva \(ya no está en la lista\)/)).toBeInTheDocument();
    expect(screen.queryByText("Elija un valor")).not.toBeInTheDocument();
  });

  it("«contiene» sigue siendo una caja de texto", () => {
    // It searches for a fragment on purpose: a whole value off a list is the
    // one thing nobody is trying to type there.
    wrap(
      <FilterBuilder
        config={filtro("like", "ti")} root={conLista} optionLists={listas}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Valor para Propietario" })).toHaveValue("ti");
  });

  it("al cambiar de operador dice si el valor sale de una lista", async () => {
    // Whether the typed value survives the change depends on it: a fragment
    // typed under «contiene» is not one of the list's values. The rule itself
    // is tested where it lives; this is the wire that feeds it, and with it cut
    // every other test here still passed.
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    const { unmount } = wrap(
      <FilterBuilder
        config={filtro("like", "ti")} root={conLista} optionLists={listas}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Operador para Propietario" }));
    await user.click(screen.getByRole("option", { name: "es igual a" }));
    expect(onUpdate).toHaveBeenLastCalledWith(0, { operator: "eq" }, true);
    unmount();

    // And without a list for the field, it says so too.
    wrap(
      <FilterBuilder
        config={filtro("like", "ti")} root={conLista}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Operador para Propietario" }));
    await user.click(screen.getByRole("option", { name: "es igual a" }));
    expect(onUpdate).toHaveBeenLastCalledWith(0, { operator: "eq" }, false);
  });

  it("sin listas del servidor se queda la caja de texto de siempre", () => {
    // An older server sends no lists at all, and a list can also be missing
    // because it outgrew the cap. Both mean the field the generator had before.
    wrap(
      <FilterBuilder
        config={filtro("eq", "Tigo")} root={conLista}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Valor para Propietario" })).toHaveValue("Tigo");
  });

  it("«está en la lista» pasa a ser casillas, y no la caja de comas", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("in", ["Cotas"])} root={conLista} optionLists={listas}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );

    // The comma box is gone, and what replaced it is not a box at all.
    expect(screen.queryByPlaceholderText(/separe los valores con comas/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Valores para Propietario"));

    const tigo = screen.getByRole("checkbox", { name: "Tigo" });
    expect(screen.getByRole("checkbox", { name: "Cotas" })).toBeChecked();
    expect(tigo).not.toBeChecked();

    await user.click(tigo);
    expect(onUpdate).toHaveBeenCalledWith(0, { value: ["Cotas", "Tigo"] });
  });

  it("desmarcar quita el valor", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("in", ["Cotas", "Tigo"])} root={conLista} optionLists={listas}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Valores para Propietario"));
    await user.click(screen.getByRole("checkbox", { name: "Cotas" }));
    expect(onUpdate).toHaveBeenCalledWith(0, { value: ["Tigo"] });
  });

  it("el botón dice cuántos hay elegidos", () => {
    wrap(
      <FilterBuilder
        config={filtro("in", ["Cotas", "Tigo"])} root={conLista} optionLists={listas}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Valores para Propietario")).toHaveTextContent("2 valores");
  });

  it("un valor elegido que ya no se ofrece se puede desmarcar", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("in", ["Viva"])} root={conLista} optionLists={listas}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Valores para Propietario"));
    const viva = screen.getByRole("checkbox", { name: "Viva" });
    expect(viva).toBeChecked();
    await user.click(viva);
    expect(onUpdate).toHaveBeenCalledWith(0, { value: [] });
  });
});

describe("PreviewTable", () => {
  const result: ReportResult = {
    columns: [
      { key: "c0", label: "Descripción", kind: "string", path: "description" },
      { key: "c1", label: "Resuelto", kind: "boolean", path: "state" },
      { key: "c2", label: "Días", kind: "number", path: "diasAbierto" },
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
    expect(screen.getByText(/no devolvió ningún registro/i)).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /archivar Pendientes por tramo/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/¿Archivar «Pendientes por tramo»\?/)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Archivar" }));
    expect(onDelete).toHaveBeenCalledWith(mine);
  });
});

describe("PreviewTable when the data moved under it", () => {
  const columns = [{ key: "c0", label: "Descripción", kind: "string" as const, path: "description" }];

  it("never states a range that cannot be true", () => {
    // Between two pages somebody else can archive events. On offset 300 of a
    // report that has shrunk to 250 rows the footer read "Mostrando 301–250 de
    // 250" on page 4 of 3: three impossible statements side by side, and no
    // hint of why.
    const onPage = vi.fn();
    render(
      <PreviewTable
        result={{ columns, rows: [], total: 250, limit: 100, offset: 300 }}
        onPage={onPage}
      />,
    );

    expect(screen.queryByText(/301/)).not.toBeInTheDocument();
    expect(screen.getByText(/ya no existe/)).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("offers the way back to a page that exists", async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();
    render(
      <PreviewTable
        result={{ columns, rows: [], total: 250, limit: 100, offset: 300 }}
        onPage={onPage}
      />,
    );

    await user.click(screen.getByRole("button", { name: /última página/ }));

    // Three pages of a hundred: the last one starts at 200.
    expect(onPage).toHaveBeenCalledWith(200);
  });

  it("still reads normally on a page that is fine", () => {
    render(
      <PreviewTable
        result={{ columns, rows: [{ c0: "Poste" }], total: 250, limit: 100, offset: 100 }}
        onPage={vi.fn()}
      />,
    );

    expect(screen.getByText("Mostrando 101–101 de 250")).toBeInTheDocument();
    expect(screen.queryByText(/ya no existe/)).not.toBeInTheDocument();
  });
});

describe("FilterBuilder — a named period", () => {
  // The server publishes the periods beside the catalog, and offers the
  // operator on every date field. The screen keeps neither list.
  const PERIODOS = [
    { key: "hoy" as const, label: "Hoy" },
    { key: "semana_pasada" as const, label: "La semana pasada" },
    { key: "mes_pasado" as const, label: "El mes pasado" },
  ];
  const conPeriodo: CatalogRoot = {
    ...root,
    fields: root.fields.map((f) =>
      f.path === "date" ? { ...f, operators: ["between", "period", "gte"] } : f),
  };
  const filtro = (operator: "between" | "period", value?: unknown): ReportConfig => ({
    ...emptyConfig("evento"),
    filters: { op: "and", conditions: [{ path: "date", operator, ...(value !== undefined ? { value } : {}) }] },
  });

  it("offers the operator under the words the server uses for it", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("between")} root={conPeriodo} periods={PERIODOS}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Operador para Fecha del evento" }));
    await user.click(screen.getByRole("option", { name: "está en el periodo" }));
    expect(onUpdate).toHaveBeenLastCalledWith(0, { operator: "period" }, false);
  });

  it("shows the periods as one list and writes the key, not the label", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    wrap(
      <FilterBuilder
        config={filtro("period")} root={conPeriodo} periods={PERIODOS}
        onUpdate={onUpdate} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    // No calendar: a period is chosen by name.
    expect(screen.queryByLabelText(/^Rango para/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Periodo para Fecha del evento" }));
    await user.click(screen.getByRole("option", { name: "La semana pasada" }));
    expect(onUpdate).toHaveBeenLastCalledWith(0, { value: "semana_pasada" });
  });

  it("reads a stored period back by its label", () => {
    wrap(
      <FilterBuilder
        config={filtro("period", "mes_pasado")} root={conPeriodo} periods={PERIODOS}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Periodo para Fecha del evento" })).toHaveTextContent("El mes pasado");
  });

  it("keeps a stored period on screen when the server did not send the list", () => {
    // A saved report opened against a server that publishes no periods: the
    // filter is set and running, so the row must not read as empty.
    wrap(
      <FilterBuilder
        config={filtro("period", "mes_pasado")} root={conPeriodo}
        onUpdate={vi.fn()} onRemove={vi.fn()} onSetJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Periodo para Fecha del evento" })).toHaveTextContent("mes_pasado");
  });
});

describe("a named period in the configuration rules", () => {
  const base: ReportConfig = {
    ...emptyConfig("evento"),
    filters: { op: "and", conditions: [{ path: "date", operator: "between", value: ["2026-01-01", "2026-01-31"] }] },
  };

  it("drops a date range when the operator becomes a period, and a period when it becomes a range", () => {
    // Two different shapes: a pair of days and a name. Carrying either across
    // would send the server a value the new operator cannot read.
    const aPeriodo = updateFilter(base, 0, { operator: "period" });
    expect(aPeriodo.filters?.conditions[0]).toEqual({ path: "date", operator: "period" });

    const conValor = updateFilter(aPeriodo, 0, { value: "mes_pasado" });
    const aRango = updateFilter(conValor, 0, { operator: "between" });
    expect(aRango.filters?.conditions[0]).toEqual({ path: "date", operator: "between" });
  });

  it("is one value, not two", () => {
    expect(operatorNeedsValue("period")).toBe(true);
    expect(operatorNeedsTwoValues("period")).toBe(false);
  });
});
