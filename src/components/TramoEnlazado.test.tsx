// A tramo's name where each city in it is a link to its page. The name itself
// always belongs to the server: when the two labels do not add up to it, the
// component prints the server's name and links nothing.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TramoEnlazado from "./TramoEnlazado";
import type { Tramo } from "../interfaces/interfaces";

const tramo = (extra: Partial<Tramo> = {}): Tramo => ({
  id: 14,
  nombre: "Potosí – Sucre",
  ciudades: [
    { id: 3, name: "Potosí", lat: -19.5, lng: -65.7 },
    { id: 8, name: "Sucre", lat: -19, lng: -65.2 },
  ],
  id_departamento: null,
  departamento: null,
  archivado: false,
  ...extra,
});

const pintar = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("TramoEnlazado", () => {
  it("links both cities to their pages and reads exactly as the server's name", () => {
    const { container } = pintar(<TramoEnlazado tramo={tramo()} />);
    expect(screen.getByRole("link", { name: "Potosí" })).toHaveAttribute("href", "/app/ciudades/3");
    expect(screen.getByRole("link", { name: "Sucre" })).toHaveAttribute("href", "/app/ciudades/8");
    expect(container.textContent).toBe("Potosí – Sucre");
  });

  it("follows the order of ciudades", () => {
    pintar(
      <TramoEnlazado
        tramo={tramo({
          nombre: "Sucre – Potosí",
          ciudades: [
            { id: 8, name: "Sucre", lat: null, lng: null },
            { id: 3, name: "Potosí", lat: null, lng: null },
          ],
        })}
      />,
    );
    const enlaces = screen.getAllByRole("link");
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual(["/app/ciudades/8", "/app/ciudades/3"]);
  });

  it("shows #id for a city with no name, and still links it", () => {
    const { container } = pintar(
      <TramoEnlazado
        tramo={tramo({
          nombre: "Potosí – #8",
          ciudades: [
            { id: 3, name: "Potosí", lat: null, lng: null },
            { id: 8, name: null, lat: null, lng: null },
          ],
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "#8" })).toHaveAttribute("href", "/app/ciudades/8");
    expect(container.textContent).toBe("Potosí – #8");
  });

  it("prints the server's name as plain text, with no links, when the labels do not add up to it", () => {
    const { container } = pintar(<TramoEnlazado tramo={tramo({ nombre: "Potosí – Oruro" })} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.textContent).toBe("Potosí – Oruro");
  });

  it("renders nothing for a missing tramo, or what the caller asked for in its place", () => {
    const { container, rerender } = pintar(<TramoEnlazado tramo={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MemoryRouter><TramoEnlazado tramo={undefined} vacio="—" /></MemoryRouter>);
    expect(container.textContent).toBe("—");
  });

  it("a click on a city does not reach the row it sits in", () => {
    const fila = vi.fn();
    pintar(
      <div onClick={fila}>
        <TramoEnlazado tramo={tramo()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Sucre" }));
    expect(fila).not.toHaveBeenCalled();
  });
});
