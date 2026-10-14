import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import EstadoTramos from "./EstadoTramos";

const Ruta = () => <output data-testid="ruta">{useLocation().pathname}</output>;

const pintar = (actual: "activos" | "archivados") =>
  render(<MemoryRouter><EstadoTramos actual={actual} /><Ruta /></MemoryRouter>);

describe("EstadoTramos", () => {
  it.each([
    ["activos", "Activos", "Archivados"],
    ["archivados", "Archivados", "Activos"],
  ] as const)("marks only %s as the current page", (actual, activo, otro) => {
    pintar(actual);

    expect(screen.getByRole("link", { name: activo })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: otro })).not.toHaveAttribute("aria-current");
  });

  it("links Activos to the map and Archivados to their list", async () => {
    const user = userEvent.setup();
    pintar("activos");

    expect(screen.getByRole("link", { name: "Activos" })).toHaveAttribute("href", "/app/tramos");
    expect(screen.getByRole("link", { name: "Archivados" })).toHaveAttribute("href", "/app/tramos/archivados");
    await user.click(screen.getByRole("link", { name: "Archivados" }));
    expect(screen.getByTestId("ruta")).toHaveTextContent("/app/tramos/archivados");
  });
});
