// The department selector of the home map, and where the map looks after it.
//
// The department belongs to the tramo, and until tramos existed there was
// nothing to narrow the map by but the three tabs. What is filtered is decided
// in `useInicioData`; this file is about the control that asks for it and the
// one thing the map itself does in answer — frame what is left.
//
// The map is a stand-in here: no canvas, no tiles. `FitView` is replaced by a
// recorder, because what it is told is the whole of the behaviour and where a
// real map then flies to is `useFitCoords`' business, tested beside it.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OperationsMap } from "./OperationsMap";
import { SesionContext } from "../../../context/SesionContext";
import { usuarioExample } from "../../../data/example";
import type { MapDepartamento, MapMarker } from "./types";

const fitView = vi.hoisted(() => vi.fn());

vi.mock("../../../components/map/BaseMap", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/map/MapPointsLayer", () => ({ default: () => null }));
vi.mock("../../../components/map/useFitCoords", () => ({
  FitView: (props: unknown) => { fitView(props); return null; },
}));
vi.mock("../../../components/theme-provider", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("../../../components/dialogs/ResolverEventoSheet", () => ({ default: () => null }));
vi.mock("../../../components/dialogs/AddRevisionSheet", () => ({ default: () => null }));

const LA_PAZ = { id: 2, name: "La Paz" };
const POTOSI = { id: 5, name: "Potosí" };

const marcador = (id: number, lat: number, lng: number): MapMarker => ({
  lat, lng, label: `P-${id}`, isPoste: true,
  item: { id, name: `P-${id}`, lat, lng, date: new Date("2026-01-05") },
});

const pintar = (props: {
  departamento?: MapDepartamento;
  departamentos?: { id: number; name: string }[];
  sinDepartamento?: boolean;
  mapMarkers?: MapMarker[];
  setDepartamento?: (d: MapDepartamento) => void;
} = {}) =>
  render(
    <MemoryRouter>
      <SesionContext.Provider
        value={{ sesion: { usuario: usuarioExample, autenticado: true }, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <OperationsMap
          mapMarkers={props.mapMarkers ?? [marcador(1, -16.5, -68.1), marcador(2, -19.6, -65.7)]}
          mapTab="postes" setMapTab={vi.fn()} load={vi.fn()}
          setOpenEditPoste={vi.fn()} setDataPoste={vi.fn()}
          departamento={props.departamento ?? "all"}
          setDepartamento={props.setDepartamento ?? vi.fn()}
          departamentos={props.departamentos ?? [LA_PAZ, POTOSI]}
          sinDepartamento={props.sinDepartamento ?? false}
        />
      </SesionContext.Provider>
    </MemoryRouter>,
  );

const selector = () => screen.getByRole("combobox", { name: "Departamento" });
/** Opens the list the way a mouse does; Radix listens for the pointer, not the click. */
const abrir = () => fireEvent.pointerDown(selector(), { button: 0, ctrlKey: false, pointerType: "mouse" });
const opciones = () => screen.getAllByRole("option").map((o) => o.textContent);
const ultimoEncuadre = () => fitView.mock.calls[fitView.mock.calls.length - 1][0];

beforeEach(() => fitView.mockClear());

describe("the department selector of the home map", () => {
  it("opens on every department", () => {
    pintar();

    expect(selector().textContent).toContain("Todos los departamentos");
  });

  it("offers every department, and nothing for poles without one when there are none", () => {
    pintar();
    abrir();

    expect(opciones()).toEqual(["Todos los departamentos", "La Paz", "Potosí"]);
  });

  it("offers the poles without a department last, when there are any", () => {
    pintar({ sinDepartamento: true });
    abrir();

    expect(opciones()).toEqual(["Todos los departamentos", "La Paz", "Potosí", "Sin departamento"]);
  });

  it("asks for a department by its id, as a number", () => {
    // The control deals in strings; the filter compares against numeric ids.
    const setDepartamento = vi.fn();
    pintar({ setDepartamento });
    abrir();

    fireEvent.click(screen.getByRole("option", { name: "Potosí" }));

    expect(setDepartamento).toHaveBeenCalledWith(5);
  });

  it("asks for the poles without one, and for all of them again", () => {
    const setDepartamento = vi.fn();
    pintar({ setDepartamento, sinDepartamento: true, departamento: 5 });
    abrir();
    fireEvent.click(screen.getByRole("option", { name: "Sin departamento" }));
    expect(setDepartamento).toHaveBeenLastCalledWith("none");

    abrir();
    fireEvent.click(screen.getByRole("option", { name: "Todos los departamentos" }));
    expect(setDepartamento).toHaveBeenLastCalledWith("all");
  });

  it("is not drawn when there is nothing to choose between", () => {
    // No pole carries a department and none lacks one: there are no poles.
    pintar({ departamentos: [], sinDepartamento: false, mapMarkers: [] });

    expect(screen.queryByRole("combobox", { name: "Departamento" })).toBeNull();
  });
});

describe("where the home map looks", () => {
  it("stays on the whole country while every department is shown", () => {
    pintar();

    expect(ultimoEncuadre().fit).toBe(false);
    expect(ultimoEncuadre().zoom).toBe(5);
  });

  it("frames the points that are left once a department is chosen", () => {
    pintar({ departamento: 5, mapMarkers: [marcador(2, -19.6, -65.7), marcador(3, -19.9, -65.2)] });

    expect(ultimoEncuadre().fit).toBe(true);
    expect(ultimoEncuadre().coords).toEqual([{ lat: -19.6, lng: -65.7 }, { lat: -19.9, lng: -65.2 }]);
  });

  it("goes to the point itself when only one is left", () => {
    // Two points make a box to fit; one does not, and without this the map
    // would answer a department with a single pole by showing the country.
    pintar({ departamento: 5, mapMarkers: [marcador(2, -19.6, -65.7)] });

    expect(ultimoEncuadre().center).toEqual({ lat: -19.6, lng: -65.7 });
    expect(ultimoEncuadre().zoom).toBeGreaterThan(5);
  });

  it("leaves out of the frame the points with no coordinates yet", () => {
    // A pole at 0,0 has not been placed. Framing it would stretch the view to
    // the Gulf of Guinea.
    pintar({ departamento: 5, mapMarkers: [marcador(2, -19.6, -65.7), marcador(3, -19.9, -65.2), marcador(9, 0, 0)] });

    expect(ultimoEncuadre().coords).toEqual([{ lat: -19.6, lng: -65.7 }, { lat: -19.9, lng: -65.2 }]);
  });
});

// The map lost its floating title: it sat on the map saying what the map is,
// and the corner it took is the department selector's now. What explains the
// three tabs — the info button — moved to the corner that already holds a
// figure about what is drawn, the marker count.
describe("the corners of the home map", () => {
  it("has no title written over the map, but still has a name", () => {
    pintar();

    expect(screen.queryByText("Mapa de Operaciones")).toBeNull();
    // Nothing on screen names the card any more, so its label has to.
    expect(screen.getByRole("region", { name: "Mapa de Operaciones" })).toBeTruthy();
  });

  it("keeps the info button, beside the marker count", () => {
    pintar();

    const info = screen.getByRole("button", { name: "Información sobre el mapa" });
    expect(info.parentElement?.textContent).toContain("2 marcadores");
  });

  it("leaves the selector alone in its corner", () => {
    pintar();

    expect(selector().parentElement?.textContent).toBe(selector().textContent);
  });
});

