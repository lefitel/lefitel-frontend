// The pole form: one request for its four lists, and what it says when that
// request is refused.
//
// This file had zero coverage before C2 — not one line of it had ever been
// executed by the suite — while being the screen that changed the most. Three
// things are asserted here and each of them fails silently in production:
//
//   - **the four old addresses must be gone, not merely joined.** Half a
//     migration leaves the screen working and every seeded role happy, so
//     nothing else in the repository would notice; and the four it replaces
//     carry no permission at all, which is precisely what makes the drift
//     invisible. Said precisely: those four spies cannot fire under today's
//     code, since the sheet no longer imports the modules at all — the
//     assertion is a guard against a future drift back, not a measurement of
//     the present.
//   - **`lat`/`lng` must survive.** The stretch line, the neighbouring poles
//     and the map framing all sit behind `if (!a?.lat || !a?.lng …) return`.
//     Lose the two columns and the sheet renders a perfectly clean map with
//     nothing drawn on it, no error, no console line. `getPosteByTramo` is the
//     one observable thing on the far side of that guard, so it is the signal
//     this test reads.
//   - **a refusal must be said out loud.** The lists now ask for `postes.ver`;
//     this sheet is opened from the home screen behind `postes.editar` alone,
//     so a role holding one and not the other reaches a form the server will
//     refuse. It used to answer with a four-second toast, four empty dropdowns
//     and the sentence "Sin ADSS registradas" — a claim about the database made
//     by a screen that had been told nothing at all.
//
// @vis.gl/react-maplibre is mocked whole: no test in this repository had ever
// rendered a map, and the real one wants a sized DOM element and a WebGL
// context that jsdom does not give it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PosteSheet from "./PosteSheet";
import { SesionContext } from "../../../context/SesionContext";
import { ThemeProvider } from "../../theme-provider";
import { usuarioExample } from "../../../data/example";

const getOpcionesPoste = vi.fn();
const getAdssPoste = vi.fn();
const getPosteByTramo = vi.fn();
const getAdss = vi.fn();
const getCiudad = vi.fn();
const getMaterial = vi.fn();
const getPropietario = vi.fn();

vi.mock("../../../api/opciones.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/opciones.api")>()),
  getOpcionesPoste: () => getOpcionesPoste(),
}));
vi.mock("../../../api/AdssPoste.api", () => ({ getAdssPoste: (...a: unknown[]) => getAdssPoste(...a) }));
vi.mock("../../../api/Poste.api", () => ({
  getPosteByTramo: (...a: unknown[]) => getPosteByTramo(...a),
  createPoste: vi.fn(),
  editPoste: vi.fn(),
}));
// Mocked and asserted against rather than simply absent: these are the four the
// sheet used to call, and the four a tidy-up would drift back to.
vi.mock("../../../api/Adss.api", () => ({ getAdss: (...a: unknown[]) => getAdss(...a) }));
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("../../../api/Material.api", () => ({ getMaterial: (...a: unknown[]) => getMaterial(...a) }));
vi.mock("../../../api/Propietario.api", () => ({ getPropietario: (...a: unknown[]) => getPropietario(...a) }));

vi.mock("../../../api/Upload.api", () => ({ uploadImage: vi.fn() }));
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: () => Promise.resolve(null) }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: () => true,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

vi.mock("@vis.gl/react-maplibre", () => ({
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  useMap: () => ({ current: null }),
}));
vi.mock("../../map/MapSearch", () => ({ default: () => null }));
vi.mock("../../map/SonarMarker", () => ({ SonarMarker: () => null }));

/** What `/api/poste/opciones` answers, with the two drawable columns. */
const OPCIONES = {
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  ciudad: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
};

const POSTE = {
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_ciudadA: 11, id_ciudadB: 12, id_usuario: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesPoste.mockResolvedValue(OPCIONES);
  getAdssPoste.mockResolvedValue([]);
  getPosteByTramo.mockResolvedValue([]);
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = (poste: typeof POSTE | null) =>
  render(
    <ThemeProvider>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <PosteSheet poste={poste} open setOpen={vi.fn()} onSuccess={vi.fn()} />
      </SesionContext.Provider>
    </ThemeProvider>,
  );

describe("where the four lists come from", () => {
  it("asks the options endpoint once and the old catalogues never", async () => {
    pintar(null);

    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalledTimes(1));
    for (const [nombre, espia] of [
      ["adss", getAdss], ["ciudad", getCiudad], ["material", getMaterial], ["propietario", getPropietario],
    ] as const) {
      expect(espia, `la ficha volvió a pedir el catálogo de ${nombre}`).not.toHaveBeenCalled();
    }
  });

  it("still asks separately which ADSS this pole already carries", async () => {
    // A different question — about this pole, not about the catalogue — so it
    // is deliberately not folded into the options response.
    pintar(POSTE);

    await waitFor(() => expect(getAdssPoste).toHaveBeenCalledWith(40));
    expect(getOpcionesPoste).toHaveBeenCalledTimes(1);
  });

  it("draws the stretch, which only happens if the cities kept their coordinates", async () => {
    // The assertion that catches a `ciudad` block projected to `{id, name}`.
    // Nothing else on this screen distinguishes that case from a healthy one:
    // the guard returns early, the map still renders, and no error is raised.
    pintar(POSTE);

    await waitFor(() => expect(getPosteByTramo).toHaveBeenCalledWith(11, 12));
  });
});

describe("when the server refuses", () => {
  beforeEach(() => {
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });
  });

  it("says the form cannot be completed, and does not blame the network", async () => {
    pintar(null);

    const aviso = await screen.findByText(/No tiene permiso para consultar los catálogos/i);
    expect(aviso).toBeTruthy();
  });

  it("stops claiming there are no ADSS registered", async () => {
    pintar(null);

    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalled());
    expect(screen.queryByText("Sin ADSS registradas")).toBeNull();
    expect(screen.getByText("Lista no disponible")).toBeTruthy();
  });

  it("disables saving, because none of the four required fields can be filled", async () => {
    pintar(null);

    const guardar = await screen.findByRole("button", { name: /Crear poste/i });
    await waitFor(() => expect((guardar as HTMLButtonElement).disabled).toBe(true));
  });
});

describe("when it is the pole's own ADSS that fails", () => {
  it("does not blame the catalogues for it", async () => {
    // One shared `catch` for two different questions emptied four lists that
    // had arrived perfectly well, printed "No se pudieron cargar los
    // catálogos" — which was false — and disabled saving, all because a
    // request about *this pole* had failed.
    getAdssPoste.mockRejectedValue(new Error("Network Error"));

    pintar(POSTE);

    await waitFor(() => expect(getAdssPoste).toHaveBeenCalled());
    expect(screen.queryByText(/No se pudieron cargar los catálogos/i)).toBeNull();
    const guardar = await screen.findByRole("button", { name: /Guardar/i });
    await waitFor(() => expect((guardar as HTMLButtonElement).disabled).toBe(false));
  });

  it("says so, because the boxes it leaves unticked are not this pole's answer", async () => {
    // Saving stays possible, so the sentence is the only thing between an
    // editor and a form that shows every ADSS unticked for a pole that has
    // three: whatever gets ticked next *replaces* the real set on save. The
    // toast was written and never fired — it compared the failure with
    // `"listas"`, which a failure is never classified as.
    const { toast } = await import("sonner");
    getAdssPoste.mockRejectedValue(new Error("Network Error"));

    pintar(POSTE);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo cargar el ADSS de este poste"),
    );
  });

  it("stays quiet when it was refused, since the catalogues already said so", async () => {
    const { toast } = await import("sonner");
    const denegado = Object.assign(new Error("Forbidden"), { isAxiosError: true, response: { status: 403 } });
    getOpcionesPoste.mockRejectedValue(denegado);
    getAdssPoste.mockRejectedValue(denegado);

    pintar(POSTE);

    await waitFor(() => expect(getAdssPoste).toHaveBeenCalled());
    await screen.findByText(/No tiene permiso/i);
    expect(toast.error).not.toHaveBeenCalledWith("No se pudo cargar el ADSS de este poste");
  });
});

describe("when the request simply fails", () => {
  it("offers to retry instead of talking about permissions", async () => {
    getOpcionesPoste.mockRejectedValue(new Error("Network Error"));

    pintar(null);

    expect(await screen.findByText(/No se pudieron cargar los catálogos/i)).toBeTruthy();
    expect(screen.queryByText(/No tiene permiso/i)).toBeNull();
  });
});

describe("a location that is not a place", () => {
  // The two boxes take whatever is typed, and nothing checked the result: a
  // decimal point left out was saved as a latitude of minus twenty-two thousand
  // million, and that pole then cost its whole stretch the road route.
  const guardar = async () => {
    const boton = await screen.findByRole("button", { name: /Guardar/i });
    await waitFor(() => expect(boton).not.toBeDisabled());
    boton.click();
  };

  it("is refused beside the boxes, and nothing is sent", async () => {
    const { editPoste } = await import("../../../api/Poste.api");
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);

    pintar({ ...POSTE, lat: -22048385017.82594 });
    await guardar();

    expect(await screen.findByText(/Esa ubicación no existe/)).toBeTruthy();
    expect(editPoste).not.toHaveBeenCalled();
  });

  it("says nothing about a pole that is somewhere", async () => {
    // The control: the same pole, with the latitude it was meant to have.
    // And it has to reach the save, or "no message" is true of a button that
    // did nothing at all.
    const { editPoste } = await import("../../../api/Poste.api");
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);

    pintar({ ...POSTE, lat: -22.048385 });
    await guardar();

    await waitFor(() => expect(editPoste).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Esa ubicación no existe/)).toBeNull();
  });
});

describe("what the form shows at a glance", () => {
  it("names the stretch the pole is on, in the header", async () => {
    pintar(POSTE);
    expect(await screen.findByText("Tramo Tacna — Ilo")).toBeTruthy();
  });

  it("marks the ADSS the pole carries, and counts them", async () => {
    // They were a column of boxes to be scanned one by one. They are toggles
    // now, and still have to answer as checkboxes to whoever cannot see them.
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);
    pintar(POSTE);

    const preformado = await screen.findByRole("checkbox", { name: "Preformado" });
    await waitFor(() => expect(preformado.getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByText("1 elegida")).toBeTruthy();

    preformado.click();
    await waitFor(() => expect(preformado.getAttribute("aria-checked")).toBe("false"));
    expect(screen.queryByText(/elegida/)).toBeNull();
  });

  it("says beside the button everything a new pole still needs", async () => {
    pintar(null);
    const crear = await screen.findByRole("button", { name: /Crear poste/i });
    await waitFor(() => expect(crear).not.toBeDisabled());
    crear.click();

    // Six and not seven: "Ubicación" is not among them, because a new pole
    // opens already placed on the example coordinates. That is how the form
    // has always started, and it means a pole can be saved where nobody put it.
    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toBe(
      "Faltan 6 campos: Número, Propietario, Material, Tramo, Ferretería y Foto",
    );
  });
});
