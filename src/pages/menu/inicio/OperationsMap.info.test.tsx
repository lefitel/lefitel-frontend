// The ⓘ of the home map sits in an overlay over the map. It was a tooltip, which
// a finger cannot open; it opens on a click now, and that click must not reach
// the map underneath (a click on the map picks a pole).
//
// The map is a stand-in: the overlay is its sibling in the DOM, not its child,
// which is what keeps a press on the overlay from being a press on the map.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OperationsMap } from "./OperationsMap";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";

const mapClick = vi.hoisted(() => vi.fn());

vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="mapa" onClick={mapClick}>{children}</div>,
}));
vi.mock("../../../components/map/MapPointsLayer", () => ({ default: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({ FitView: () => null }));
vi.mock("../../../components/theme-provider", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));

const pintar = () =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <OperationsMap
          mapMarkers={[]}
          mapTab="postes" setMapTab={vi.fn()} load={vi.fn()}
          setOpenEditPoste={vi.fn()} setDataPoste={vi.fn()}
          departamento="all" setDepartamento={vi.fn()} departamentos={[]} sinDepartamento={false}
        />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

describe("the explanation of the home map", () => {
  it("opens on a click, closes on another, and never reaches the map", async () => {
    const user = userEvent.setup();
    pintar();
    const boton = screen.getByRole("button", { name: "Información sobre el mapa" });

    await user.click(boton);

    const frase = screen.getByText(/postes con al menos una revisión registrada/);
    expect(frase.closest('[data-slot="popover-content"]')).not.toBeNull();
    await user.click(boton);
    expect(screen.queryByText(/postes con al menos una revisión registrada/)).toBeNull();
    expect(mapClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("mapa").contains(boton)).toBe(false);
  });
});
