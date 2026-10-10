// The list shows what hangs from each city, and only to a role that may see it.
//
// The figures come from two other modules. The server leaves each block out for
// a role without `postes.ver` or `eventos.ver`; the screen has to leave the
// column out too, or that role gets a column of zeros that reads as "this city
// has no incidents" when the truth is "you may not know".

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CiudadesPage from "./CiudadesPage";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../../../lib/permissions";
import type { CiudadConCifras } from "../../../api/Ciudad.api";

const getCiudad = vi.fn();
vi.mock("../../../api/Ciudad.api", () => ({
  getCiudad: (...a: unknown[]) => getCiudad(...a),
  deleteCiudad: vi.fn(),
  desarchivarCiudad: vi.fn(),
}));
vi.mock("../../../components/dialogs/upsert/CiudadSheet", () => ({ default: () => null }));

const ROL = 3;

/** Three cities: one busy, one quiet, one nothing runs through yet. */
const CIUDADES: CiudadConCifras[] = [
  { id: 1, name: "Ipati", image: "", lat: 0, lng: 0, postes: 0, vecinas: [], pendientes: 0, prioritarios: 0, ultimoEvento: null },
  { id: 2, name: "Robore", image: "", lat: 0, lng: 0, postes: 231, vecinas: [3], pendientes: 3, prioritarios: 0, ultimoEvento: "2026-04-20T04:00:00.000Z" },
  { id: 3, name: "Puerto Suarez", image: "", lat: 0, lng: 0, postes: 184, vecinas: [2], pendientes: 7, prioritarios: 2, ultimoEvento: "2026-05-08T04:00:00.000Z" },
];

const pintar = (...modulos: Modulo[]) => {
  const permisos = sinPermisos();
  permisos.ciudades.ver = true;
  for (const m of modulos) permisos[m].ver = true;
  setPermisos(ROL, permisos);
  const ctx = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;
  return render(
    <MemoryRouter>
      <SesionContext.Provider value={ctx}>
        <CiudadesPage />
      </SesionContext.Provider>
    </MemoryRouter>,
  );
};

const cabeceras = () => screen.getAllByRole("columnheader").map((th) => th.textContent?.trim() ?? "");
const filas = () => screen.getAllByRole("row").slice(1);

describe("the city list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    olvidarPermisos();
    getCiudad.mockResolvedValue(CIUDADES);
  });

  it("draws every figure for a role that reads poles and incidents", async () => {
    pintar("postes", "eventos");
    await screen.findByText("Robore");

    const vistas = cabeceras();
    for (const titulo of ["Ciudad", "Tramos", "Postes", "Eventos pendientes", "Última actividad"]) {
      expect(vistas.some((c) => c.startsWith(titulo)), titulo).toBe(true);
    }
  });

  it("draws no pole column and no neighbours without postes.ver", async () => {
    pintar("eventos");
    await screen.findByText("Robore");

    const vistas = cabeceras();
    expect(vistas.some((c) => c.startsWith("Postes"))).toBe(false);
    expect(vistas.some((c) => c.startsWith("Tramos"))).toBe(false);
    expect(vistas.some((c) => c.startsWith("Eventos pendientes"))).toBe(true);
  });

  it("draws no incident column without eventos.ver", async () => {
    pintar("postes");
    await screen.findByText("Robore");

    const vistas = cabeceras();
    expect(vistas.some((c) => c.startsWith("Eventos pendientes"))).toBe(false);
    expect(vistas.some((c) => c.startsWith("Última actividad"))).toBe(false);
    expect(vistas.some((c) => c.startsWith("Postes"))).toBe(true);
  });

  it("puts the cities with the most pending incidents first", async () => {
    pintar("postes", "eventos");
    await screen.findByText("Robore");

    const orden = filas().map((tr) => ["Puerto Suarez", "Robore", "Ipati"].find((n) => within(tr).queryByText(n)));
    expect(orden).toEqual(["Puerto Suarez", "Robore", "Ipati"]);
  });

  it("names the neighbours, and says so when priority incidents are among the pending", async () => {
    pintar("postes", "eventos");
    await screen.findByText("Robore");

    const puerto = filas().find((tr) => within(tr).queryByText("Puerto Suarez"))!;
    expect(within(puerto).getByText("conecta con Robore")).toBeTruthy();
    expect(within(puerto).getByText(/7 · 2 prioritarios/)).toBeTruthy();

    const ipati = filas().find((tr) => within(tr).queryByText("Ipati"))!;
    expect(within(ipati).getByText("sin tramos")).toBeTruthy();
  });

  it("hides the two dates until they are asked for", async () => {
    pintar("postes", "eventos");
    await screen.findByText("Robore");

    const vistas = cabeceras();
    expect(vistas.some((c) => c.startsWith("Registrada"))).toBe(false);
    expect(vistas.some((c) => c.startsWith("Última edición"))).toBe(false);
  });
});
