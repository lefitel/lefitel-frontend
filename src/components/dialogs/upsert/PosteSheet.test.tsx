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
//   - **the ends of the tramo must keep their coordinates.** The map draws the
//     two cities of the chosen tramo, and a city with no position is simply not
//     drawn: no error, no console line. The markers are the observable thing,
//     so the test reads them.
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
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import PosteSheet from "./PosteSheet";
import { SesionContext } from "../../../context/SesionContext";
import { ThemeProvider } from "../../theme-provider";
import { usuarioExample } from "../../../data/example";
import type { Tramo } from "../../../interfaces/interfaces";

const getOpcionesPoste = vi.fn();
const getAdssPoste = vi.fn();
const getPostesDelTramo = vi.fn();
const createPoste = vi.fn();
const editPoste = vi.fn();
const uploadImage = vi.fn();
const puede = vi.fn((..._a: unknown[]) => true);
/** What the stand-in for the tramo dialog was last opened with. */
const dialogoDeTramo = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
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
  getPostesDelTramo: (...a: unknown[]) => getPostesDelTramo(...a),
  createPoste: (...a: unknown[]) => createPoste(...a),
  editPoste: (...a: unknown[]) => editPoste(...a),
}));
// The tramo dialog has its own tests; here it is a stand-in that records what
// it was handed and lets a test say what it reports.
vi.mock("./TramoSheet", () => ({
  default: (p: Record<string, unknown> & { open: boolean; onSuccess: (t: unknown) => void }) => {
    dialogoDeTramo.props = p;
    return p.open ? <div data-testid="dialogo-tramo">dialogo de tramo</div> : null;
  },
}));
// Mocked and asserted against rather than simply absent: these are the four the
// sheet used to call, and the four a tidy-up would drift back to.
vi.mock("../../../api/Adss.api", () => ({ getAdss: (...a: unknown[]) => getAdss(...a) }));
vi.mock("../../../api/Ciudad.api", () => ({ getCiudad: (...a: unknown[]) => getCiudad(...a) }));
vi.mock("../../../api/Material.api", () => ({ getMaterial: (...a: unknown[]) => getMaterial(...a) }));
vi.mock("../../../api/Propietario.api", () => ({ getPropietario: (...a: unknown[]) => getPropietario(...a) }));

vi.mock("../../../api/Upload.api", () => ({ uploadImage: (...a: unknown[]) => uploadImage(...a) }));
const fetchOrsRoute = vi.fn();
vi.mock("../../../lib/orsRoute", () => ({ fetchOrsRoute: (...a: unknown[]) => fetchOrsRoute(...a) }));
vi.mock("../../../lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/permissions")>()),
  can: (...a: unknown[]) => puede(...a),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

vi.mock("@vis.gl/react-maplibre", () => ({
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  // The position is on the element so a test can tell which dots were drawn.
  Marker: ({ children, latitude, longitude }: { children?: React.ReactNode; latitude: number; longitude: number }) => (
    <div data-testid="marcador" data-pos={`${latitude},${longitude}`}>{children}</div>
  ),
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  useMap: () => ({ current: null }),
}));
vi.mock("../../map/MapSearch", () => ({ default: () => null }));
vi.mock("../../map/SonarMarker", () => ({ SonarMarker: () => null }));

const ciudadDe = (id: number, name: string, lat: number | null, lng: number | null) => ({ id, name, lat, lng });
const TRAMO_14: Tramo = {
  id: 14, nombre: "Ilo – Tacna",
  ciudades: [ciudadDe(12, "Ilo", -17.6394, -71.3375), ciudadDe(11, "Tacna", -18.0146, -70.2536)],
  id_departamento: 4, departamento: { id: 4, name: "Tacna" }, archivado: false,
};
const TRAMO_15: Tramo = {
  id: 15, nombre: "Ilo – Moquegua",
  ciudades: [ciudadDe(12, "Ilo", -17.6394, -71.3375), ciudadDe(13, "Moquegua", null, null)],
  id_departamento: null, departamento: null, archivado: false,
};

/** What `/api/poste/opciones` answers, with the two drawable columns. */
const OPCIONES = {
  adss: [{ id: 3, name: "Preformado" }],
  material: [{ id: 7, name: "Madera" }],
  propietario: [{ id: 2, name: "Osefi" }],
  ciudad: [
    { id: 11, name: "Tacna", lat: -18.0146, lng: -70.2536 },
    { id: 12, name: "Ilo", lat: -17.6394, lng: -71.3375 },
  ],
  tramos: [TRAMO_14, TRAMO_15],
  departamento: [{ id: 4, name: "Tacna" }],
};

const POSTE = {
  id: 40, name: "P-001", image: "", date: new Date("2026-01-05"),
  lat: -18.0, lng: -70.2, id_adss: 3, id_material: 7, id_propietario: 2,
  id_tramo: 14, tramo: TRAMO_14, id_usuario: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  getOpcionesPoste.mockResolvedValue(OPCIONES);
  getAdssPoste.mockResolvedValue([]);
  getPostesDelTramo.mockResolvedValue([]);
  fetchOrsRoute.mockResolvedValue(null);
  createPoste.mockResolvedValue({});
  editPoste.mockResolvedValue({});
  uploadImage.mockResolvedValue({ ok: true, path: "/files/p.png" });
  puede.mockImplementation(() => true);
  dialogoDeTramo.props = null;
});

const sesion = { usuario: usuarioExample, autenticado: true };
const pintar = (poste: typeof POSTE | null, onSuccess = vi.fn()) =>
  render(
    <ThemeProvider>
      <SesionContext.Provider
        value={{ sesion, setSesion: vi.fn(), loading: false, logout: vi.fn() } as never}
      >
        <PosteSheet poste={poste} open setOpen={vi.fn()} onSuccess={onSuccess} />
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

  it("loads the other poles of the tramo by its id when editing", async () => {
    pintar(POSTE);

    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(14));
    expect(getPostesDelTramo).toHaveBeenCalledTimes(1);
  });

  it("does not reload the neighbours or the route when the options bring the same tramo as another object", async () => {
    // In production the pole's own tramo and the options' entry are two objects
    // with the same values; the effect must follow the values, not the object.
    getOpcionesPoste.mockResolvedValue({ ...OPCIONES, tramos: [structuredClone(TRAMO_14), TRAMO_15] });
    pintar(POSTE);

    await waitFor(() => expect(getOpcionesPoste).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalled());
    await screen.findByText("Ilo – Tacna");
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(getPostesDelTramo).toHaveBeenCalledTimes(1);
    expect(fetchOrsRoute.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("does reload when the options' copy of the same tramo has other end coordinates", async () => {
    const movido = structuredClone(TRAMO_14);
    movido.ciudades[0].lat = -17.7;
    getOpcionesPoste.mockResolvedValue({ ...OPCIONES, tramos: [movido, TRAMO_15] });
    pintar(POSTE);

    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledTimes(2));
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
    expect(await screen.findByText("Tramo Ilo – Tacna")).toBeTruthy();
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


// ── The tramo: one field, no cities ────────────────────────────────────────

const falla = (status: number, message: string) =>
  new AxiosError("falló", "ERR_BAD_REQUEST", undefined, undefined, {
    status, data: { message }, statusText: "", headers: {}, config: {} as never,
  } as AxiosResponse);

/** The tramo field's button. */
const campoTramo = () => screen.findByRole("button", { name: "Tramo" });
const elegirTramo = async (user: ReturnType<typeof userEvent.setup>, nombre: RegExp) => {
  await user.click(await campoTramo());
  await user.click(await screen.findByRole("button", { name: nombre }));
};
const marcadores = () => screen.queryAllByTestId("marcador").map((m) => m.getAttribute("data-pos"));

/** Fills everything a new pole needs but the tramo. */
const rellenarNuevoSinTramo = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole("button", { name: /Crear poste/i });
  await user.type(await screen.findByLabelText(/Número/), "P-900");
  const [propietario, material] = await screen.findAllByRole("button", { name: "Seleccionar..." });
  await user.click(propietario);
  await user.click(await screen.findByRole("button", { name: "Osefi" }));
  await user.keyboard("{Escape}");
  await user.click(material);
  await user.click(await screen.findByRole("button", { name: "Madera" }));
  await user.keyboard("{Escape}");
  await user.click(await screen.findByRole("checkbox", { name: "Preformado" }));
  const archivo = new File(["x"], "p.png", { type: "image/png" });
  for (const input of document.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    await user.upload(input, archivo);
  }
};
const crear = async (user: ReturnType<typeof userEvent.setup>) => {
  const boton = await screen.findByRole("button", { name: /Crear poste/i });
  await waitFor(() => expect(boton).not.toBeDisabled());
  await user.click(boton);
};

describe("the tramo field", () => {
  it("offers one tramo field, fed by the options, and saves its id", async () => {
    const user = userEvent.setup();
    pintar(null);
    await rellenarNuevoSinTramo(user);

    await elegirTramo(user, /Ilo – Tacna/);
    await crear(user);

    await waitFor(() => expect(createPoste).toHaveBeenCalledTimes(1));
    const cuerpo = createPoste.mock.calls[0][0] as Record<string, unknown>;
    expect(cuerpo.id_tramo).toBe(14);
    for (const clave of ["id_ciudadA", "id_ciudadB", "ciudadA", "ciudadB", "tramo"]) {
      expect(Object.keys(cuerpo), `el cuerpo lleva «${clave}»`).not.toContain(clave);
    }
    // One field, and the two cities are not asked for any more.
    expect(screen.queryByRole("button", { name: "Inicio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fin" })).toBeNull();
  });

  it("sends only the id of the tramo when editing too, not the object the pole came with", async () => {
    const user = userEvent.setup();
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);
    pintar(POSTE);
    const guardar = await screen.findByRole("button", { name: /Guardar/i });
    await waitFor(() => expect(guardar).not.toBeDisabled());

    await elegirTramo(user, /Ilo – Moquegua/);
    await user.click(guardar);

    await waitFor(() => expect(editPoste).toHaveBeenCalledTimes(1));
    const cuerpo = editPoste.mock.calls[0][0] as Record<string, unknown>;
    expect(cuerpo.id_tramo).toBe(15);
    expect(Object.keys(cuerpo)).not.toContain("tramo");
    expect(Object.keys(cuerpo)).not.toContain("id_ciudadA");
    expect(Object.keys(cuerpo)).not.toContain("id_ciudadB");
  });

  it("refuses to save without a tramo, with one sentence under the field", async () => {
    const user = userEvent.setup();
    pintar(null);
    await rellenarNuevoSinTramo(user);

    await crear(user);

    expect(await screen.findByText("Selecciona el tramo")).toBeInTheDocument();
    expect(createPoste).not.toHaveBeenCalled();
    expect(screen.getAllByText("Selecciona el tramo")).toHaveLength(1);
  });

  it("shows 'Crear tramo nuevo' only to a role that may create tramos", async () => {
    const user = userEvent.setup();
    puede.mockImplementation((_rol, modulo, accion) => !(modulo === "tramos" && accion === "crear"));
    pintar(null);

    await user.click(await campoTramo());
    await screen.findByPlaceholderText("Buscar tramo...");

    expect(screen.queryByRole("button", { name: "Crear tramo nuevo" })).toBeNull();
  });

  it("does not offer 'Crear tramo nuevo' when the form's options were denied, so it never opens on empty lists", async () => {
    const user = userEvent.setup();
    getOpcionesPoste.mockRejectedValue({ response: { status: 403 } });
    pintar(null);

    await screen.findByText(/No tiene permiso para consultar los catálogos/i);
    await user.click(await campoTramo());
    await screen.findByPlaceholderText("Buscar tramo...");

    expect(screen.queryByRole("button", { name: "Crear tramo nuevo" })).toBeNull();
  });

  it("offers 'Crear tramo nuevo' to a role that may", async () => {
    const user = userEvent.setup();
    pintar(null);

    await user.click(await campoTramo());

    expect(await screen.findByRole("button", { name: "Crear tramo nuevo" })).toBeInTheDocument();
    expect(puede).toHaveBeenCalledWith(expect.anything(), "tramos", "crear");
  });

  it("selects the tramo that was just created and adds it to the list", async () => {
    const user = userEvent.setup();
    pintar(null);
    await user.click(await campoTramo());
    await user.click(await screen.findByRole("button", { name: "Crear tramo nuevo" }));
    expect(await screen.findByTestId("dialogo-tramo")).toBeInTheDocument();

    const nuevo: Tramo = {
      id: 77, nombre: "Camana – Ilo",
      ciudades: [ciudadDe(20, "Camana", null, null), ciudadDe(12, "Ilo", -17.6394, -71.3375)],
      id_departamento: null, departamento: null, archivado: false,
    };
    act(() => (dialogoDeTramo.props!.onSuccess as (t: Tramo) => void)(nuevo));

    expect(await campoTramo()).toHaveTextContent("Camana – Ilo");
    await user.click(await campoTramo());
    // Chosen AND in the list, once (the trigger is named "Tramo", so it does not count here).
    expect(await screen.findAllByRole("button", { name: /Camana – Ilo/ })).toHaveLength(1);
  });

  it("selects the existing tramo when the dialog reports the pair already existed", async () => {
    const user = userEvent.setup();
    pintar(null);
    await user.click(await campoTramo());
    await user.click(await screen.findByRole("button", { name: "Crear tramo nuevo" }));

    // The dialog answers with a tramo that is already in the list: chosen, not added a second time.
    act(() => (dialogoDeTramo.props!.onSuccess as (t: Tramo) => void)({ ...TRAMO_15 }));

    expect(await campoTramo()).toHaveTextContent("Ilo – Moquegua");
    await user.click(await campoTramo());
    expect(await screen.findAllByRole("button", { name: /Ilo – Moquegua/ })).toHaveLength(1);
  });

  it("hands the tramo dialog the cities and departments it already has, so it asks for no options of its own", async () => {
    pintar(null);
    await waitFor(() => expect(dialogoDeTramo.props?.ciudades).toEqual(OPCIONES.ciudad));

    expect(dialogoDeTramo.props?.departamentos).toEqual(OPCIONES.departamento);
  });

  it("draws the two ends of the chosen tramo, and nothing for an end with no coordinates", async () => {
    const user = userEvent.setup();
    pintar(POSTE);
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalled());

    // Ilo and Tacna. The pole itself is drawn by a stand-in that makes no marker.
    await waitFor(() => expect(marcadores()).toEqual(["-17.6394,-71.3375", "-18.0146,-70.2536"]));

    // Moquegua has no position: its end is not drawn, Ilo's still is.
    await elegirTramo(user, /Ilo – Moquegua/);
    await waitFor(() => expect(marcadores()).toEqual(["-17.6394,-71.3375"]));
  });

  describe("the neighbours follow the chosen tramo", () => {
    const VECINO_14 = { id: 41, name: "P-002", lat: -18.1, lng: -70.3 };
    const VECINO_15 = { id: 51, name: "P-050", lat: -17.7, lng: -71.2 };
    const POS_14 = "-18.1,-70.3";
    const POS_15 = "-17.7,-71.2";
    const porTramo = (r: Record<number, Promise<unknown> | unknown>) =>
      getPostesDelTramo.mockImplementation((id: number) => Promise.resolve(r[id] ?? []));

    it("replaces the neighbours with those of the new tramo, and asks for them by its id", async () => {
      const user = userEvent.setup();
      porTramo({ 14: [VECINO_14], 15: [VECINO_15] });
      pintar(POSTE);
      await waitFor(() => expect(marcadores()).toContain(POS_14));

      await elegirTramo(user, /Ilo – Moquegua/);

      expect(getPostesDelTramo).toHaveBeenLastCalledWith(15);
      await waitFor(() => expect(marcadores()).toContain(POS_15));
      expect(marcadores()).not.toContain(POS_14);
    });

    it("clears the old neighbours while the new ones are on their way", async () => {
      const user = userEvent.setup();
      let llegan!: (p: unknown[]) => void;
      getPostesDelTramo.mockImplementation((id: number) =>
        id === 14 ? Promise.resolve([VECINO_14]) : new Promise((r) => { llegan = r; }));
      pintar(POSTE);
      await waitFor(() => expect(marcadores()).toContain(POS_14));

      await elegirTramo(user, /Ilo – Moquegua/);

      // Nothing of the old tramo is left beside the new ends, even before the answer.
      await waitFor(() => expect(marcadores()).not.toContain(POS_14));
      await act(async () => llegan([VECINO_15]));
      await waitFor(() => expect(marcadores()).toContain(POS_15));
    });

    it("ignores a slow answer for a tramo that is no longer the chosen one", async () => {
      const user = userEvent.setup();
      let tarde!: (p: unknown[]) => void;
      getPostesDelTramo.mockImplementation((id: number) =>
        id === 15 ? new Promise((r) => { tarde = r; }) : Promise.resolve([VECINO_14]));
      pintar(POSTE);
      await waitFor(() => expect(marcadores()).toContain(POS_14));

      await elegirTramo(user, /Ilo – Moquegua/);
      await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalledWith(15));
      await user.keyboard("{Escape}"); // the list stays open after a pick
      await elegirTramo(user, /Ilo – Tacna/);
      await waitFor(() => expect(marcadores()).toContain(POS_14));

      await act(async () => tarde([VECINO_15]));
      expect(marcadores()).not.toContain(POS_15);
    });
  });

  it("shows the server sentence when the save is refused", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);
    editPoste.mockRejectedValue(falla(400, "El tramo elegido no está disponible."));
    pintar(POSTE);
    const guardar = await screen.findByRole("button", { name: /Guardar/i });
    await waitFor(() => expect(guardar).not.toBeDisabled());

    await user.click(guardar);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El tramo elegido no está disponible."));
  });

  it("closes without asking while nothing has been changed (the control for the next test)", async () => {
    const user = userEvent.setup();
    pintar(POSTE);
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalled());

    // Untouched: closing does not ask.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
  });

  it("asks before closing once the tramo has been changed", async () => {
    const user = userEvent.setup();
    pintar(POSTE);
    await waitFor(() => expect(getPostesDelTramo).toHaveBeenCalled());

    await elegirTramo(user, /Ilo – Moquegua/);
    await user.keyboard("{Escape}"); // closes the list
    await user.keyboard("{Escape}"); // asks to close the form

    expect(await screen.findByText("¿Descartar los cambios?")).toBeInTheDocument();
  });
});

describe("a pole whose tramo has been archived", () => {
  const ARCHIVADO: Tramo = { ...TRAMO_14, id: 30, nombre: "Viejo – Antiguo", archivado: true };
  const DEL_ARCHIVADO = { ...POSTE, id_tramo: 30, tramo: ARCHIVADO };

  it("shows it as the current value, marked archivado, and still saves when it is left alone", async () => {
    const user = userEvent.setup();
    getAdssPoste.mockResolvedValue([{ id_adss: 3 }]);
    pintar(DEL_ARCHIVADO);

    expect(await campoTramo()).toHaveTextContent("Viejo – Antiguoarchivado");
    const guardar = await screen.findByRole("button", { name: /Guardar/i });
    await waitFor(() => expect(guardar).not.toBeDisabled());
    await user.click(guardar);

    await waitFor(() => expect(editPoste).toHaveBeenCalledTimes(1));
    expect((editPoste.mock.calls[0][0] as { id_tramo: number }).id_tramo).toBe(30);
  });

  it("is not offered again once another tramo is chosen", async () => {
    const user = userEvent.setup();
    pintar(DEL_ARCHIVADO);
    // Offered while it is the value...
    await user.click(await campoTramo());
    expect(await screen.findByRole("button", { name: /Viejo – Antiguo/ })).toBeInTheDocument();

    // ...and gone from the list the moment another one is chosen (the list stays open).
    await user.click(await screen.findByRole("button", { name: /Ilo – Tacna/ }));
    expect(screen.queryByRole("button", { name: /Viejo – Antiguo/ })).toBeNull();
  });
});
