import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import TramoFotos, { TRAMO_FOTO_MS } from "./TramoFotos";

const AIQUILE = { id: 1, name: "Aiquile", image: "/aiquile.webp" };
const CHACO = { id: 2, name: "Chaco", image: "/chaco.webp" };

/** The photo in turn: the others are mounted under it, and out of reach. */
const aLaVista = () => screen.getAllByRole("listitem").map((li) => li.querySelector("img")?.getAttribute("alt"));
const pasar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("the photos at the head of a tramo's card", () => {
  it("shows one city at a time, across the whole head, and names it", () => {
    render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);

    expect(aLaVista()).toEqual(["Aiquile"]);
    expect(screen.getByRole("img", { name: "Aiquile" })).toHaveAttribute("src", expect.stringContaining("aiquile.webp"));
    expect(screen.getByText("Aiquile")).toBeInTheDocument();
  });

  it("gives way to the other on its own, and comes back round", () => {
    render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);

    pasar(TRAMO_FOTO_MS);
    expect(aLaVista()).toEqual(["Chaco"]);
    pasar(TRAMO_FOTO_MS);
    expect(aLaVista()).toEqual(["Aiquile"]);
  });

  it("waits while the pointer is on it, and goes on once it leaves", () => {
    const { container } = render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);
    const cabecera = container.firstElementChild!;

    fireEvent.mouseEnter(cabecera);
    pasar(TRAMO_FOTO_MS * 3);
    expect(aLaVista()).toEqual(["Aiquile"]);

    fireEvent.mouseLeave(cabecera);
    pasar(TRAMO_FOTO_MS);
    expect(aLaVista()).toEqual(["Chaco"]);
  });

  it("does not move by itself for whoever asked for less motion, and still answers a press", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);

    pasar(TRAMO_FOTO_MS * 3);
    expect(aLaVista()).toEqual(["Aiquile"]);

    fireEvent.click(screen.getByRole("button", { name: "Ver foto de Chaco" }));
    expect(aLaVista()).toEqual(["Chaco"]);
  });

  it("brings up the city whose dot is pressed, and gives it its whole time", () => {
    render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);

    // Pressed a moment before the change that was already due.
    pasar(TRAMO_FOTO_MS - 100);
    fireEvent.click(screen.getByRole("button", { name: "Ver foto de Chaco" }));
    expect(aLaVista()).toEqual(["Chaco"]);
    expect(screen.getByRole("button", { name: "Ver foto de Chaco" })).toHaveAttribute("aria-current", "true");

    pasar(200);
    expect(aLaVista()).toEqual(["Chaco"]);
    pasar(TRAMO_FOTO_MS);
    expect(aLaVista()).toEqual(["Aiquile"]);
  });

  it("stands still on the one photo there is, with nothing to choose between", () => {
    render(<TramoFotos ciudades={[AIQUILE, { ...CHACO, image: null }]} />);

    pasar(TRAMO_FOTO_MS * 2);
    expect(aLaVista()).toEqual(["Aiquile"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says once that there is no photo when neither city has one", () => {
    render(<TramoFotos ciudades={[{ ...AIQUILE, image: null }, { ...CHACO, image: null }]} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Sin imagen")).toBeInTheDocument();
  });

  it("says there is no city when neither end has been chosen yet", () => {
    render(<TramoFotos ciudades={[null, undefined]} />);

    expect(screen.getByText("Sin ciudad")).toBeInTheDocument();
  });

  it("names a city that has no name as the server does, by its id", () => {
    render(<TramoFotos ciudades={[{ id: 7, name: null, image: "/x.webp" }, null]} />);

    expect(screen.getByRole("img", { name: "#7" })).toBeInTheDocument();
  });

  it("stays on a photo that exists when a city is taken away under it", () => {
    const { rerender } = render(<TramoFotos ciudades={[AIQUILE, CHACO]} />);
    pasar(TRAMO_FOTO_MS);
    expect(aLaVista()).toEqual(["Chaco"]);

    rerender(<TramoFotos ciudades={[AIQUILE, null]} />);
    expect(aLaVista()).toEqual(["Aiquile"]);
  });
});
