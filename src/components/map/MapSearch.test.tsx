import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import MapSearch from "./MapSearch";

const flyTo = vi.fn();
vi.mock("@vis.gl/react-maplibre", () => ({ useMap: () => ({ current: { flyTo } }) }));

describe("MapSearch", () => {
  beforeEach(() => {
    flyTo.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => [
        { place_id: 1, display_name: "Sucre, Bolivia", lat: "-19.03", lon: "-65.26" },
      ],
    }));
    // The search box debounces input by 400ms (see MapSearch.tsx); fake timers
    // with shouldAdvanceTime keep testing-library's own polling (findByText,
    // waitFor) alive on the real clock while letting the debounce be fast-
    // forwarded deterministically instead of waiting it out in wall time.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flies to the chosen place with longitude first", async () => {
    const { getByPlaceholderText, findByText } = render(<MapSearch />);

    fireEvent.change(getByPlaceholderText("Buscar lugar..."), { target: { value: "Sucre" } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const option = await findByText("Sucre");
    fireEvent.click(option);

    await waitFor(() => {
      expect(flyTo).toHaveBeenCalledWith({ center: [-65.26, -19.03], zoom: 14 });
    });
  });

  it("sits alone in the top-left corner, 300 px wide at most, when it has nothing beside it", () => {
    const { getByPlaceholderText } = render(<MapSearch />);

    const caja = getByPlaceholderText("Buscar lugar...").parentElement!.parentElement!;
    expect(caja).toHaveStyle({ position: "absolute", top: "10px", left: "10px", maxWidth: "300px", width: "calc(100% - 20px)" });
  });

  it("puts what it is given on its own row, after the box, at the same top offset, and wrapping", () => {
    const { getByPlaceholderText, getByText } = render(<MapSearch><span>herramientas</span></MapSearch>);

    const fila = getByText("herramientas").parentElement!.parentElement!;
    expect(fila).toHaveStyle({ position: "absolute", top: "10px", left: "10px", display: "flex", flexWrap: "wrap" });
    const caja = getByPlaceholderText("Buscar lugar...").parentElement!.parentElement!;
    // The box comes first in the row, so what it is given is on its right.
    expect(caja.parentElement).toBe(fila);
    expect(fila.firstElementChild).toBe(caja);
    expect(caja).toHaveStyle({ width: "300px", maxWidth: "100%" });
    // And against the right edge, not hugging the box: the two hold a corner each.
    expect(getByText("herramientas").parentElement).toHaveStyle({ marginLeft: "auto" });
  });

  it("lets the pointer through the row, so the map is still draggable beside the controls", () => {
    const { getByText, getByPlaceholderText } = render(<MapSearch><span>herramientas</span></MapSearch>);

    expect(getByText("herramientas").parentElement!.parentElement).toHaveStyle({ pointerEvents: "none" });
    expect(getByText("herramientas").parentElement).toHaveStyle({ pointerEvents: "auto" });
    expect(getByPlaceholderText("Buscar lugar...").parentElement!.parentElement).toHaveStyle({ pointerEvents: "auto" });
  });

  it("opens the results inside the box's own column, not under what sits beside it", async () => {
    const { getByPlaceholderText, findByText, getByText } = render(<MapSearch><span>herramientas</span></MapSearch>);

    fireEvent.change(getByPlaceholderText("Buscar lugar..."), { target: { value: "Sucre" } });
    await act(async () => { vi.advanceTimersByTime(400); });
    const opcion = await findByText("Sucre");

    const caja = getByPlaceholderText("Buscar lugar...").parentElement!.parentElement!;
    expect(caja).toContainElement(opcion);
    expect(caja).not.toContainElement(getByText("herramientas"));
  });

  it("keeps guarding the box's events when the controls beside it appear or go away after it mounted", () => {
    const fuera = vi.fn();
    document.addEventListener("mousedown", fuera);
    const { getByPlaceholderText, rerender } = render(<MapSearch />);

    rerender(<MapSearch><span>herramientas</span></MapSearch>);
    fireEvent.mouseDown(getByPlaceholderText("Buscar lugar..."));
    expect(fuera).not.toHaveBeenCalled();

    rerender(<MapSearch />);
    fireEvent.mouseDown(getByPlaceholderText("Buscar lugar..."));
    expect(fuera).not.toHaveBeenCalled();
    document.removeEventListener("mousedown", fuera);
  });

  it("still closes the results on a press on the controls beside it, when they appeared after it mounted", async () => {
    const { getByPlaceholderText, findByText, getByText, rerender, queryByText } = render(<MapSearch />);
    rerender(<MapSearch><span>herramientas</span></MapSearch>);
    fireEvent.change(getByPlaceholderText("Buscar lugar..."), { target: { value: "Sucre" } });
    await act(async () => { vi.advanceTimersByTime(400); });
    await findByText("Sucre");

    fireEvent.mouseDown(getByText("herramientas"));

    expect(queryByText("Sucre")).toBeNull();
  });

  it("closes the results when something beside the box is pressed, like any press outside it", async () => {
    const { getByPlaceholderText, findByText, getByText, queryByText } = render(<MapSearch><span>herramientas</span></MapSearch>);
    fireEvent.change(getByPlaceholderText("Buscar lugar..."), { target: { value: "Sucre" } });
    await act(async () => { vi.advanceTimersByTime(400); });
    await findByText("Sucre");

    fireEvent.mouseDown(getByText("herramientas"));

    expect(queryByText("Sucre")).toBeNull();
  });
});
