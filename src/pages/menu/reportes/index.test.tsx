// Which report is open is chosen in the app's header, where every other
// screen's page-level choice went when the screens lost their title row.
//
// Six tabs are the better control — all six reports in sight, one click each —
// but they need some 610px and the header is a single row shared with the
// trail. So the screen draws the tabs when it is wide enough to afford them
// and a select when it is not, and never both.
//
// Mounted on its own, as here, a screen has no header to draw into and
// `HeaderSlot` renders its children in place: what is asserted is which control
// is drawn and what it does, not where. jsdom lays nothing out, so the width is
// whatever the stand-in observer is told.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportePage, { REPORT_TABS_MIN_WIDTH } from "./index";

vi.mock("./ReportGeneralSec", () => ({ default: () => <p>Informe general</p> }));
vi.mock("./ReportTramoSec", () => ({ default: () => <p>Informe por tramo</p> }));
vi.mock("./ReportRecorrido", () => ({ default: () => <p>Informe de recorrido</p> }));
vi.mock("./ReportEstadoRedSec", () => ({ default: () => <p>Informe de estado</p> }));
vi.mock("./ReportObsFrecuenciaSec", () => ({ default: () => <p>Informe de observaciones</p> }));
vi.mock("./ReportTiemposSec", () => ({ default: () => <p>Informe de tiempos</p> }));

const NOMBRES = ["General", "Por Tramo", "Recorrido", "Estado de la Red", "Observaciones", "Tiempos"];

let medir: (width: number) => void;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        medir = (width) =>
          cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

const pintar = (width: number) => {
  render(<ReportePage />);
  act(() => medir(width));
};

describe("choosing a report", () => {
  it("is a select while the screen has not been measured, or is narrow", () => {
    render(<ReportePage />);
    expect(screen.getByRole("combobox", { name: "Informe" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();

    act(() => medir(REPORT_TABS_MIN_WIDTH - 1));
    expect(screen.getByRole("combobox", { name: "Informe" }).textContent).toContain("General");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("is the six tabs once there is room for them, and the select is gone", () => {
    pintar(REPORT_TABS_MIN_WIDTH);

    const tabs = within(screen.getByRole("tablist", { name: "Informe" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(NOMBRES);
    expect(screen.queryByRole("combobox", { name: "Informe" })).toBeNull();
  });

  it("opens the report whose tab is pressed", async () => {
    pintar(1200);
    expect(screen.getByText("Informe general")).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Tiempos" }));

    expect(screen.getByText("Informe de tiempos")).toBeTruthy();
    expect(screen.queryByText("Informe general")).toBeNull();
  });

  it("opens the report picked in the select", () => {
    pintar(600);

    // Radix listens for the pointer, not the click.
    fireEvent.pointerDown(screen.getByRole("combobox", { name: "Informe" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(NOMBRES);
    fireEvent.click(screen.getByRole("option", { name: "Recorrido" }));

    expect(screen.getByText("Informe de recorrido")).toBeTruthy();
  });

  it("keeps the open report when the screen is resized across the line", async () => {
    // The sidebar opening is enough to cross it. Swapping the control must not
    // send whoever was reading «Tiempos» back to «General».
    pintar(1200);
    await userEvent.click(screen.getByRole("tab", { name: "Tiempos" }));

    act(() => medir(600));

    expect(screen.getByRole("combobox", { name: "Informe" }).textContent).toContain("Tiempos");
    expect(screen.getByText("Informe de tiempos")).toBeTruthy();
  });
});
