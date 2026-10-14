// The card a pole opens on the home map names its tramo from the pole's own
// `tramo`; the two city names it used to join are no longer sent.

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OperationsMap } from "./OperationsMap";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { MapMarker } from "./types";

let renderPopup: ((m: MapMarker) => React.ReactNode) | null = null;

vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/map/MapPointsLayer", () => ({
  default: (p: { renderPopup: (m: MapMarker) => React.ReactNode }) => { renderPopup = p.renderPopup; return null; },
}));
vi.mock("../../../components/theme-provider", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));

const MARCADOR: MapMarker = {
  lat: -19.3, lng: -65.5, label: "Poste P-001", isPoste: true,
  item: {
    id: 40, name: "P-001", lat: -19.3, lng: -65.5, date: new Date("2026-01-05"),
    tramo: {
      id: 14, nombre: "Potosí – Sucre", id_departamento: null, departamento: null, archivado: false,
      ciudades: [{ id: 11, name: "Potosí", lat: -19.58, lng: -65.75 }, { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 }],
    },
  },
};

const abrirCard = (marcador: MapMarker) => {
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <OperationsMap
          mapMarkers={[marcador]} mapTab="postes" setMapTab={vi.fn()} load={vi.fn()}
          setOpenEditPoste={vi.fn()} setDataPoste={vi.fn()}
          departamento="all" setDepartamento={vi.fn()} departamentos={[]} sinDepartamento={false}
        />
      </SesionContext.Provider>
    </MemoryRouter>,
  );
  return render(<>{renderPopup!(marcador)}</>, { container: document.body.appendChild(document.createElement("div")) });
};

describe("the pole card on the home map", () => {
  it("shows the tramo's name as the server built it, with no two cities joined here", () => {
    const { container } = abrirCard(MARCADOR);

    expect(container.textContent).toContain("Potosí – Sucre");
    for (const unir of [" > ", " → ", " — "]) expect(container.textContent).not.toContain(unir);
  });

  it("says nothing about the tramo for a pole that came without one", () => {
    const sinTramo = { ...MARCADOR, item: { ...(MARCADOR as Extract<MapMarker, { isPoste: true }>).item, tramo: null } } as MapMarker;
    const { container } = abrirCard(sinTramo);

    expect(container.textContent).toContain("Poste P-001");
    expect(container.textContent).not.toMatch(/→|undefined/);
  });
});
