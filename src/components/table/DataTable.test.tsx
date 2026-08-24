// What every table in this application has to keep doing.
//
// `DataTable` draws Postes, Ciudades, Eventos, Seguridad, Archivos, Bitácora,
// Reportes and the five paramétricos — and until this file it had no test at
// all, nor did any page that renders it. That was survivable while the library
// underneath stayed put. It stops being survivable the moment TanStack Table
// moves a major, because the v9 type system covers the mechanical half of that
// migration and says nothing about the half that matters here: whether a filter
// still filters, whether a sort still sorts, and — the one with real money on
// it — whether the server-side callbacks still fire with the arguments the
// Postes screen builds its query from.
//
// So these tests are written against v8, which works today, and their job is to
// still pass afterwards. A test that only passes on the new version proves
// nothing; one that passes on both is what makes the upgrade a fact instead of
// a hope.
//
// The assertions deliberately read the rendered table rather than the library's
// internals — visible row order, the "Mostrando x–y de z" line, the arguments a
// callback received. Those are what a person sees and what the server is sent,
// and they are the two things a migration is allowed to keep identical.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SortingState } from "@tanstack/react-table";
import type { Col } from "./tableFeatures";
import DataTable, { type ActiveFilter } from "./DataTable";
import type { CiudadInterface } from "../../interfaces/interfaces";

/**
 * Four rows whose two sortable columns disagree on order, on purpose: sorted by
 * name the sequence is Ayacucho, Beni, Cochabamba, Deseada, and sorted by
 * latitude it is exactly the reverse. A test that sorts and then reads the
 * first row can only pass for the right reason.
 */
const CIUDADES: CiudadInterface[] = [
  { id: 1, name: "Cochabamba", image: "", lat: -17.4, lng: -66.2 },
  { id: 2, name: "Ayacucho", image: "", lat: -13.2, lng: -74.2 },
  { id: 3, name: "Deseada", image: "", lat: -21.5, lng: -64.7 },
  { id: 4, name: "Beni", image: "", lat: -14.8, lng: -64.9 },
];

const COLUMNS: Col<CiudadInterface>[] = [
  { accessorKey: "name", header: "Nombre" },
  { accessorKey: "lat", header: "Latitud" },
];

/** The data rows, in the order they are painted. Header row excluded. */
function visibleRows() {
  const rows = screen.getAllByRole("row");
  return rows.slice(1);
}

/** The first cell of each data row, which is the name column unless hidden. */
function firstColumn() {
  return visibleRows().map((row) => within(row).getAllByRole("cell")[0]?.textContent?.trim());
}

/**
 * A column header by name, asked for as a header and not as text.
 *
 * "Nombre" is on the screen twice — once over the column and once as the label
 * of the filter bar's column picker — so `getByText` matches both and throws.
 * Asking for the `columnheader` role also makes the assertion say what it
 * means: that this is the heading of a column, not merely a word in the page.
 */
function header(name: string | RegExp) {
  return screen.getByRole("columnheader", { name });
}

function noHeader(name: string | RegExp) {
  return screen.queryByRole("columnheader", { name });
}

/**
 * Clicks a column heading to sort by it.
 *
 * The handler sits on a `div` inside the `th`, not on the `th` itself, so
 * clicking the header cell does nothing — a click dispatches to the element
 * under the pointer and does not reach a child's handler. That is worth a
 * helper rather than a comment at four call sites, because a test that clicks
 * the wrong node fails by reporting that sorting is broken.
 */
async function sortBy(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(header(name).firstElementChild as HTMLElement);
}

function mount(props: Partial<Parameters<typeof DataTable<CiudadInterface>>[0]> = {}) {
  return render(
    <DataTable<CiudadInterface>
      data={CIUDADES}
      actions={null}
      columns={COLUMNS}
      {...props}
    />
  );
}

describe("DataTable, reading the table a person sees", () => {
  it("paints a row per record and a header per column", () => {
    mount();
    expect(header(/Nombre/)).toBeInTheDocument();
    expect(header(/Latitud/)).toBeInTheDocument();
    expect(visibleRows()).toHaveLength(4);
    expect(firstColumn()).toEqual(["Cochabamba", "Ayacucho", "Deseada", "Beni"]);
  });

  it("says so when there is nothing to show, instead of an empty frame", () => {
    mount({ data: [] });
    expect(screen.getByText("Sin datos.")).toBeInTheDocument();
  });

  it("tells an empty result apart from a failed one", () => {
    const onRetry = vi.fn();
    mount({ data: null, onRetry });
    // Not "Sin datos.": nothing is known about the data, the request failed.
    expect(screen.queryByText("Sin datos.")).not.toBeInTheDocument();
    expect(screen.getByText("Error al cargar los datos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("sorts on a header click, and reverses on the second", async () => {
    const user = userEvent.setup();
    mount();

    await sortBy(user, /Nombre/);
    expect(firstColumn()).toEqual(["Ayacucho", "Beni", "Cochabamba", "Deseada"]);

    await sortBy(user, /Nombre/);
    expect(firstColumn()).toEqual(["Deseada", "Cochabamba", "Beni", "Ayacucho"]);
  });

  /**
   * A number column starts descending and a text column starts ascending, and
   * that asymmetry is the library's, not this component's — a first click is
   * meant to answer "which is the biggest" for a quantity and "where does the A
   * section start" for a name. It is pinned because it is exactly the kind of
   * default a major version is free to change, and if it ever does, every
   * numeric column in the ERP silently reverses on first click.
   */
  it("sorts a numeric column from the largest down on the first click", async () => {
    const user = userEvent.setup();
    mount();

    await sortBy(user, /Latitud/);
    // -13.2 is the northernmost, -21.5 the southernmost.
    expect(firstColumn()).toEqual(["Ayacucho", "Beni", "Cochabamba", "Deseada"]);

    await sortBy(user, /Latitud/);
    expect(firstColumn()).toEqual(["Deseada", "Cochabamba", "Beni", "Ayacucho"]);
  });

  it("replaces the sort rather than stacking it, when one column is clicked after another", async () => {
    const user = userEvent.setup();
    mount();

    await sortBy(user, /Nombre/);
    await sortBy(user, /Latitud/);

    // Latitude descending, and no trace of the name sort underneath: an ordinary
    // click is a new sort. Only the server-side tables stack them, and that is
    // `isMultiSortEvent` doing it on purpose.
    expect(firstColumn()).toEqual(["Ayacucho", "Beni", "Cochabamba", "Deseada"]);
    expect(header(/Latitud/).textContent).not.toMatch(/\d/);
  });

  it("honours the sorting it was handed on mount", () => {
    mount({ initialSorting: [{ id: "name", desc: false }] });
    expect(firstColumn()).toEqual(["Ayacucho", "Beni", "Cochabamba", "Deseada"]);
  });

  it("narrows the rows as a filter is typed", async () => {
    const user = userEvent.setup();
    mount();

    // The filter bar defaults to the first filterable column, which is Nombre.
    const box = screen.getAllByPlaceholderText(/Filtrar por Nombre/)[0];
    await user.type(box, "co");

    expect(firstColumn()).toEqual(["Cochabamba"]);
  });

  it("gives the filter back when it is cleared", async () => {
    const user = userEvent.setup();
    mount();

    const box = screen.getAllByPlaceholderText(/Filtrar por Nombre/)[0];
    await user.type(box, "co");
    expect(visibleRows()).toHaveLength(1);

    await user.clear(box);
    expect(visibleRows()).toHaveLength(4);
  });

  it("hides a column when it is unticked, and counts one cell fewer", async () => {
    const user = userEvent.setup();
    mount();
    expect(within(visibleRows()[0]).getAllByRole("cell")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Columnas/ }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Latitud" }));
    // The menu stays open on purpose — `onSelect` calls `preventDefault` so
    // several columns can be ticked in one go — and while it is open Radix hides
    // the rest of the page from the accessibility tree, so the table is
    // unreachable until it closes.
    await user.keyboard("{Escape}");

    expect(noHeader(/Latitud/)).not.toBeInTheDocument();
    expect(within(visibleRows()[0]).getAllByRole("cell")).toHaveLength(1);
  });

  it("starts with the columns it was told to hide already hidden", () => {
    mount({ initialColumnVisibility: { lat: false } });
    expect(noHeader(/Latitud/)).not.toBeInTheDocument();
    expect(within(visibleRows()[0]).getAllByRole("cell")).toHaveLength(1);
  });

  it("hands the clicked record to the caller, not the row wrapper", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    mount({ onRowClick });

    await user.click(screen.getByText("Deseada"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toMatchObject({ id: 3, name: "Deseada" });
  });
});

describe("DataTable pagination, client side", () => {
  it("shows one page of rows and counts the whole set", () => {
    mount({ initialPageSize: 2 });
    expect(visibleRows()).toHaveLength(2);
    expect(screen.getByText("Mostrando 1–2 de 4")).toBeInTheDocument();
  });

  it("advances a page and moves the count with it", async () => {
    const user = userEvent.setup();
    mount({ initialPageSize: 2 });
    expect(firstColumn()).toEqual(["Cochabamba", "Ayacucho"]);

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(firstColumn()).toEqual(["Deseada", "Beni"]);
    expect(screen.getByText("Mostrando 3–4 de 4")).toBeInTheDocument();
  });

  it("counts what the filter left, not what arrived", async () => {
    const user = userEvent.setup();
    mount({ initialPageSize: 2 });

    const box = screen.getAllByPlaceholderText(/Filtrar por Nombre/)[0];
    await user.type(box, "co");

    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  });

  it("shows every row at once when pagination is off", () => {
    mount({ hasPaginated: false });
    expect(visibleRows()).toHaveLength(4);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  /**
   * The row number, which every screen builds the same way and none of them
   * tested.
   *
   * Fourteen files declare a "#" column whose cell is
   * `pageIndex * pageSize + visibleIndex + 1` — it has to keep counting across
   * pages, so page two of fifteen starts at 16 and not back at 1. It reads the
   * pagination off the table instance, which is the one piece of the v9 move
   * that changed shape (`getState()` is gone; the controlled slices are read
   * from `options.state`), so it is covered here once on behalf of all
   * fourteen.
   */
  it("numbers the rows continuously across pages, not from one each time", async () => {
    const user = userEvent.setup();
    render(
      <DataTable<CiudadInterface>
        data={CIUDADES}
        actions={null}
        initialPageSize={2}
        columns={[
          {
            id: "n",
            header: "#",
            enableSorting: false,
            cell: ({ row, table }) => {
              const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
              const { pageIndex, pageSize } = table.options.state?.pagination ?? { pageIndex: 0, pageSize: 0 };
              return <span>{pageIndex * pageSize + visibleIndex + 1}</span>;
            },
          },
          ...COLUMNS,
        ]}
      />
    );

    expect(firstColumn()).toEqual(["1", "2"]);

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(firstColumn()).toEqual(["3", "4"]);
  });
});

/**
 * The server-side path, which is the one with a query behind it.
 *
 * Postes runs this way: thousands of rows, so the page, the filter and the sort
 * are all resolved by the API and the table is told only what to display. The
 * three callbacks below *are* the contract — a page number that arrives 0-based
 * instead of 1-based, or a filter list that arrives empty, is a screen that
 * quietly shows the wrong rows. None of that is visible to a type checker.
 */
describe("DataTable, server side", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * A fresh set of server-side props, with the three callbacks as spies.
   *
   * Written out rather than spread over a `Partial`, because spreading widens
   * the return type to "a mock or the declared handler" and `.mock` then stops
   * existing as far as the compiler is concerned — the assertions below read the
   * arguments, so that has to survive.
   */
  const serverSideProps = (total = 137) => ({
    total,
    onPageChange: vi.fn<(page: number, pageSize: number) => void>(),
    onFilterChange: vi.fn<(filters: ActiveFilter[]) => void>(),
    onSortingChange: vi.fn<(sorting: SortingState) => void>(),
  });

  it("counts with the server's total, not with the rows it was handed", () => {
    mount({ serverSide: serverSideProps(), initialPageSize: 2 });
    // Four rows in hand, 137 on the server. The second number is the true one.
    expect(screen.getByText("Mostrando 1–2 de 137")).toBeInTheDocument();
  });

  it("does not slice the rows itself — the server already did", () => {
    mount({ serverSide: serverSideProps(), initialPageSize: 2 });
    // `manualPagination` means every row supplied is a row to paint, even when
    // there are more of them than the page size.
    expect(visibleRows()).toHaveLength(4);
  });

  it("asks for the next page as a 1-based number, with the page size", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = serverSideProps();
    mount({ serverSide: server, initialPageSize: 2 });

    // Nothing on mount: the caller already has page one.
    expect(server.onPageChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(server.onPageChange).toHaveBeenCalledTimes(1);
    expect(server.onPageChange).toHaveBeenCalledWith(2, 2);
  });

  /**
   * Server-side tables stack their sorts, and that is deliberate:
   * `isMultiSortEvent: () => true` makes every click add a column instead of
   * replacing one, so "por ciudad y dentro de eso por fecha" is reachable
   * without holding a modifier key on a phone. The consequence is that the
   * server is handed a *list* whose order is the sort precedence — drop that
   * and Postes silently sorts by one column when the user asked for two.
   */
  it("stacks the clicked column onto the sort it already had, and reports the whole list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = serverSideProps();
    mount({ serverSide: server, initialSorting: [{ id: "name", desc: false }] });

    expect(server.onSortingChange).not.toHaveBeenCalled();

    await sortBy(user, /Latitud/);

    expect(server.onSortingChange).toHaveBeenCalled();
    const reported = server.onSortingChange.mock.calls.at(-1)?.[0];
    // Name first because it was already there, latitude second and descending
    // because it is a number. Both halves matter to the query that follows.
    expect(reported).toEqual([
      { id: "name", desc: false },
      { id: "lat", desc: true },
    ]);
  });

  it("waits out the typing before asking the server, and asks once", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = serverSideProps();
    mount({ serverSide: server });

    const box = screen.getAllByPlaceholderText(/Filtrar por Nombre/)[0];
    await user.type(box, "coch");

    // Four keystrokes, and the request has not left yet.
    expect(server.onFilterChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // One request for the whole word, not one per letter.
    expect(server.onFilterChange).toHaveBeenCalledTimes(1);
    expect(server.onFilterChange).toHaveBeenCalledWith([{ column: "name", value: "coch" }]);
  });

  it("reports an emptied filter as an empty list, so the server drops it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = serverSideProps();
    mount({ serverSide: server });

    const box = screen.getAllByPlaceholderText(/Filtrar por Nombre/)[0];
    await user.type(box, "co");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await user.clear(box);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // A blank box has to arrive as "no filter" and not as `value: ""`, or the
    // server filters everything out and the screen goes empty.
    const last = server.onFilterChange.mock.calls.at(-1)?.[0] as ActiveFilter[];
    expect(last).toEqual([]);
  });
});
