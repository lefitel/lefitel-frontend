// The card at the right of the network map. It shows what is selected and is where
// everything is saved, so what these tests pin down is what each button sends, what
// it must not send, and that a draft typed for one tramo or city never reaches another.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import RedPanelReal, { type RedPanelProps as PropsDelPanel } from "./RedPanel";
import { SIN_FILTROS } from "./filtrosLista";
import { ESTADO_INICIAL, type EstadoRed } from "./redEstado";
import { SesionContext, type contextProps } from "../../../../context/SesionContext";
import { TooltipProvider } from "../../../../components/ui/tooltip";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../../../../lib/permissions";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";

const createTramo = vi.fn();
const editTramo = vi.fn();
const deleteTramo = vi.fn();
vi.mock("../../../../api/Tramo.api", async (original) => ({
  // `tramoDelConflicto` is the real one: it is what reads the 409 these tests build.
  ...(await original<typeof import("../../../../api/Tramo.api")>()),
  createTramo: (...a: unknown[]) => createTramo(...a),
  editTramo: (...a: unknown[]) => editTramo(...a),
  deleteTramo: (...a: unknown[]) => deleteTramo(...a),
}));

const createCiudad = vi.fn();
vi.mock("../../../../api/Ciudad.api", () => ({
  createCiudad: (...a: unknown[]) => createCiudad(...a),
}));

const uploadImage = vi.fn();
vi.mock("../../../../api/Upload.api", () => ({ uploadImage: (...a: unknown[]) => uploadImage(...a) }));


// The dropzone has its own tests; here it is a button that picks a file.
const FOTO = new File(["x"], "foto.jpg", { type: "image/jpeg" });
const OTRA_FOTO = new File(["y"], "otra.jpg", { type: "image/jpeg" });
vi.mock("../../../../components/ui/image-dropzone", () => ({
  ImageDropzone: (p: { file: File | null; existingUrl?: string; readOnly?: boolean; onChange: (f: File | null) => void }) => (
    <>
      <button
        type="button"
        data-readonly={String(Boolean(p.readOnly))}
        data-file={p.file?.name ?? ""}
        data-existing={p.existingUrl ?? ""}
        onClick={() => p.onChange(FOTO)}
      >
        Elegir foto
      </button>
      <button type="button" onClick={() => p.onChange(OTRA_FOTO)}>Elegir otra foto</button>
    </>
  ),
}));

const getEventosPendientesDelTramo = vi.fn();
vi.mock("../../../../api/Evento.api", () => ({
  getEventosPendientesDelTramo: (...a: unknown[]) => getEventosPendientesDelTramo(...a),
}));

// The audit panel is every sheet's and has its own tests: here it is a marker of what it was asked for.
vi.mock("../../../../components/BitacoraPanel", () => ({
  default: (p: { entity: string; entityId: number }) => <div data-testid="bitacora">{p.entity} {p.entityId}</div>,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ROL = 3;

const POTOSI = { id: 5, name: "Potosí" };
const CHUQUISACA = { id: 6, name: "Chuquisaca" };
const DEPARTAMENTOS = [POTOSI, CHUQUISACA];

const OLIVOS: CiudadDeRed = { id: 1, name: "Olivos", lat: -19.5, lng: -65.7, image: null };
const SUCRE: CiudadDeRed = { id: 2, name: "Sucre", lat: -19.0, lng: -65.2, image: null };
const NORTE: CiudadDeRed = { id: 3, name: "Norte", lat: null, lng: null, image: null };
const CAMARGO: CiudadDeRed = { id: 4, name: "Camargo", lat: -20.6, lng: -65.2, image: null };
const CIUDADES = [OLIVOS, SUCRE, NORTE, CAMARGO];

const tramo = (
  id: number, nombre: string, a: CiudadDeRed, b: CiudadDeRed,
  dep: { id: number; name: string } | null, postes?: number,
): TramoConCifras => ({
  id, nombre, ciudades: [a, b], id_departamento: dep?.id ?? null, departamento: dep, archivado: false,
  ...(postes === undefined ? {} : { postes }),
});

// Olivos – Sucre has no poles and no department; Camargo – Sucre has three poles.
const TRAMOS = [
  tramo(1, "Olivos – Sucre", OLIVOS, SUCRE, null, 0),
  tramo(2, "Camargo – Sucre", CAMARGO, SUCRE, CHUQUISACA, 3),
  tramo(3, "Norte – Olivos", NORTE, OLIVOS, POTOSI, 1),
];

const rechazo = (status: number, data: unknown) =>
  new AxiosError("falló", "ERR_BAD_REQUEST", undefined, undefined, {
    status, data, statusText: "", headers: {}, config: {} as never,
  } as AxiosResponse);

type Permisos = Partial<Record<Modulo, ("ver" | "crear" | "editar" | "archivar")[]>>;
const TODO: Permisos = {
  tramos: ["ver", "crear", "editar", "archivar"],
  ciudades: ["ver", "crear", "editar"],
};

const despachar = vi.fn();
const onSeleccionar = vi.fn();
const recargar = vi.fn();
const onOcupado = vi.fn();
const onDetalle = vi.fn();

const propsBase = (): RedPanelProps => ({
  tramos: TRAMOS,
  ciudades: CIUDADES,
  departamentos: DEPARTAMENTOS,
  tramoSel: null,
  estado: ESTADO_INICIAL,
  despachar,
  onSeleccionar,
  recargar,
  onOcupado,
  // Open by default: most of what is tested here is the card of a selected
  // tramo. What a tramo selected and not opened looks like is in "the list".
  detalle: true,
  onDetalle,
  vista: "resumen",
  postes: [],
  cargandoPostes: false,
});

const conPermisos = (modulos: Permisos) => {
  olvidarPermisos();
  const permisos = sinPermisos();
  for (const [m, acciones] of Object.entries(modulos) as [Modulo, string[]][]) {
    for (const a of acciones) (permisos[m] as Record<string, boolean>)[a] = true;
  }
  setPermisos(ROL, permisos);
};

// The list's filters are the page's state, because the map follows them. Here
// the card is on its own, so this stands in for the page and holds them.
type RedPanelProps = Omit<PropsDelPanel, "filtros" | "setFiltros">;
const RedPanel = (props: RedPanelProps) => {
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  return <RedPanelReal {...props} filtros={filtros} setFiltros={setFiltros} />;
};

const arbol = (props: RedPanelProps) => {
  const ctx = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;
  return (
    <MemoryRouter>
      <TooltipProvider>
        <SesionContext.Provider value={ctx}>
          <RedPanel {...props} />
        </SesionContext.Provider>
      </TooltipProvider>
    </MemoryRouter>
  );
};

/** Draws the card and hands back what a test needs to change the props afterwards. */
const pintar = (cambios: Partial<RedPanelProps> = {}, permisos: Permisos = TODO) => {
  conPermisos(permisos);
  const base = { ...propsBase(), ...cambios };
  const vista = render(arbol(base));
  return {
    user: userEvent.setup(),
    desmontar: () => vista.unmount(),
    cambiar: (mas: Partial<RedPanelProps>) => vista.rerender(arbol({ ...base, ...mas })),
  };
};

const estado = (cambios: Partial<EstadoRed>): EstadoRed => ({ ...ESTADO_INICIAL, ...cambios });

/** Picks an option of a Radix select by the select's accessible name. */
const elegirEnSelect = async (user: ReturnType<typeof userEvent.setup>, nombre: string, opcion: string) => {
  await user.click(screen.getByRole("combobox", { name: nombre }));
  await user.click(await screen.findByRole("option", { name: opcion }));
};

beforeEach(() => {
  vi.clearAllMocks();
  recargar.mockResolvedValue(undefined);
  editTramo.mockResolvedValue({});
  deleteTramo.mockResolvedValue(undefined);
  createTramo.mockResolvedValue({ id: 9 });
  createCiudad.mockResolvedValue({ id: 8 });
  uploadImage.mockResolvedValue({ ok: true, path: "/files/foto.jpg" });
});


/**
 * The word an icon button draws beside its icon below `sm`, where a phone has
 * no hover to show a tooltip: its only text, kept out of the name it already
 * has, and hidden from `sm` up.
 */
function soloEnMovil(boton: HTMLElement, palabra: string) {
  expect(boton).toHaveTextContent(palabra);
  const visible = [...boton.querySelectorAll("span")].find((el) => el.textContent === palabra);
  expect(visible).toHaveAttribute("aria-hidden");
  expect(visible).toHaveClass("sm:hidden");
}
describe("the list", () => {
  it("lists tramos and nothing else, filtered by the search box whatever the case", async () => {
    const { user } = pintar();
    // Tramos only: no count of cities, and no tab to turn the list into one of them.
    expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Buscar por nombre" }), "SUCRE");

    expect(screen.getByRole("button", { name: /^Olivos – Sucre/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Norte – Olivos/ })).not.toBeInTheDocument();
    // The department is there too, dimmed, and "Sin departamento" when there is none.
    expect(screen.getByRole("button", { name: /^Olivos – Sucre.*Sin departamento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Camargo – Sucre.*Chuquisaca/ })).toBeInTheDocument();
    // A city's own row is not among them: «Sucre» alone is no entry of this list.
    expect(screen.queryByRole("button", { name: /^Sucre/ })).not.toBeInTheDocument();
  });

  it("says under each name how many poles the tramo holds, in the singular for one", () => {
    pintar();

    // Olivos – Sucre has none, Camargo – Sucre three, Norte – Olivos one.
    expect(screen.getByRole("button", { name: /^Olivos – Sucre/ })).toHaveTextContent("Sin departamento · 0 postes");
    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).toHaveTextContent("Chuquisaca · 3 postes");
    expect(screen.getByRole("button", { name: /^Norte – Olivos/ })).toHaveTextContent("Potosí · 1 poste");
    expect(screen.getByRole("button", { name: /^Norte – Olivos/ })).not.toHaveTextContent("1 postes");
  });

  it("leaves the pole count out, rather than showing a zero, when the server did not send one", () => {
    // What a role without `postes.ver` gets: the figure is absent, not 0.
    pintar({ tramos: TRAMOS.map((t) => ({ ...t, postes: undefined })) });

    const fila = screen.getByRole("button", { name: /^Camargo – Sucre/ });
    expect(fila).toHaveTextContent("Chuquisaca");
    expect(fila).not.toHaveTextContent(/poste/);
  });

  it("says how many incidents are still open on each tramo, and that there are none when there are none", () => {
    const [a, b, c] = TRAMOS;
    pintar({ tramos: [{ ...a, pendientes: 0 }, { ...b, pendientes: 7 }, { ...c, pendientes: 1 }] });

    expect(screen.getByRole("button", { name: /^Olivos – Sucre/ })).toHaveTextContent("0 postes · sin pendientes");
    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).toHaveTextContent("3 postes · 7 pendientes");
    expect(screen.getByRole("button", { name: /^Norte – Olivos/ })).toHaveTextContent("1 poste · 1 pendiente");
    expect(screen.getByRole("button", { name: /^Norte – Olivos/ })).not.toHaveTextContent("1 pendientes");
  });

  it("leaves the open incidents out when the server did not send them", () => {
    // What a role without `eventos.ver` gets. The fixture's rows carry none.
    pintar();

    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).not.toHaveTextContent(/pendiente/);
  });

  it("counts one tramo in the singular", () => {
    pintar({ tramos: TRAMOS.slice(0, 1) });

    expect(screen.getByRole("heading", { name: "1 tramo" })).toBeInTheDocument();
  });

  it("says so when nothing matches the name", async () => {
    const { user } = pintar();

    await user.type(screen.getByRole("textbox", { name: "Buscar por nombre" }), "zzz");

    expect(screen.getByText("Nada con ese nombre.")).toBeInTheDocument();
  });

  it("offers «Añadir tramo» on the title's row only when the page hands it a way to start one", async () => {
    const onNuevoTramo = vi.fn();
    const { user, cambiar } = pintar();
    // No permission, no callback, no button.
    expect(screen.queryByRole("button", { name: "Añadir tramo" })).toBeNull();

    cambiar({ onNuevoTramo });
    const boton = screen.getByRole("button", { name: "Añadir tramo" });
    expect(screen.getByRole("heading", { name: "3 tramos" }).closest("header")).toContainElement(boton);

    await user.click(boton);
    expect(onNuevoTramo).toHaveBeenCalledTimes(1);
  });

  // The table of live tramos is gone, and its department filter with it: this
  // is where that filter lives now, beside the search box.
  it("narrows the tramos to one department, or to those with none, from the filter button", async () => {
    const { user } = pintar();

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await user.click(await screen.findByRole("option", { name: "Chuquisaca" }));

    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Olivos – Sucre/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Norte – Olivos/ })).not.toBeInTheDocument();
    // The count above is the network's, not the filter's.
    expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await user.click(await screen.findByRole("option", { name: "Sin departamento" }));

    expect(screen.getByRole("button", { name: /^Olivos – Sucre/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Camargo – Sucre/ })).not.toBeInTheDocument();
  });

  it("says on the button that a filter is on, and takes it off from the same place", async () => {
    const { user } = pintar();

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await user.click(await screen.findByRole("option", { name: "Potosí" }));

    // A filter left on and forgotten reads as missing data.
    expect(screen.getByRole("button", { name: "Filtros (1 aplicado)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar filtro" }));

    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Olivos – Sucre/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Camargo – Sucre/ })).toBeInTheDocument();
  });

  it("offers only the departments some tramo is in", async () => {
    const { user } = pintar({ tramos: TRAMOS.filter((t) => t.departamento?.id !== POTOSI.id) });

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));

    expect(await screen.findByRole("option", { name: "Chuquisaca" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Potosí" })).toBeNull();
  });

  it("says the filter is part of why nothing is listed", async () => {
    const { user } = pintar();

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await user.click(await screen.findByRole("option", { name: "Chuquisaca" }));
    await user.keyboard("{Escape}");
    await user.type(screen.getByRole("textbox", { name: "Buscar por nombre" }), "olivos");

    expect(screen.getByText("Nada con ese nombre y ese filtro.")).toBeInTheDocument();
  });

  it("selects the tramo that is pressed, and opens nothing", async () => {
    const { user } = pintar();

    await user.click(screen.getByRole("button", { name: /^Camargo – Sucre/ }));

    expect(onSeleccionar).toHaveBeenCalledTimes(1);
    expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 2 });
    expect(onDetalle).not.toHaveBeenCalled();
  });

  // Pressing a row used to open that tramo's card, and the list was gone: to
  // look at the next one the person had to come back first.
  describe("with a tramo selected and its card not opened", () => {
    const fila = (nombre: RegExp) => screen.getByRole("button", { name: nombre, pressed: true });

    it("stays the list, with that row marked and no other", () => {
      pintar({ tramoSel: 2, detalle: false });

      expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();
      expect(fila(/^Camargo – Sucre/)).toBeInTheDocument();
      expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
      // Not the card: nothing of a tramo's own is on screen.
      expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();
      expect(screen.queryByRole("combobox", { name: "Departamento" })).toBeNull();
    });

    it("opens that tramo's card from the small button at the end of its row", async () => {
      const { user } = pintar({ tramoSel: 2, detalle: false });

      await user.click(screen.getByRole("button", { name: "Editar Camargo – Sucre" }));

      expect(onDetalle).toHaveBeenCalledTimes(1);
      expect(onDetalle).toHaveBeenCalledWith(2);
      expect(onSeleccionar).not.toHaveBeenCalled();
    });

    it("has that button on every row, so a card is one press away without selecting first", async () => {
      const { user } = pintar({ tramoSel: 2, detalle: false });

      // The row that is not the selected one: its button says which tramo it opens.
      await user.click(screen.getByRole("button", { name: "Editar Olivos – Sucre" }));

      expect(onDetalle).toHaveBeenCalledWith(1);
      expect(onSeleccionar).not.toHaveBeenCalled();
    });

    it("shows the button with the pointer over its row, and always on the selected one", () => {
      pintar({ tramoSel: 2, detalle: false });

      // Nothing here lays a page out; what can be held is which rows hide it,
      // and that only a pointer that can hover is made to look for it.
      const oculto = "mouse:opacity-0";
      expect(screen.getByRole("button", { name: "Editar Camargo – Sucre" }).className).not.toContain(oculto);
      const otro = screen.getByRole("button", { name: "Editar Olivos – Sucre" }).className.split(/\s+/);
      expect(otro).toContain(oculto);
      expect(otro).toContain("mouse:group-hover/fila:opacity-100");
      expect(otro).toContain("mouse:focus-visible:opacity-100");
    });

    it("calls that button what it is for a role that can change nothing", () => {
      pintar({ tramoSel: 2, detalle: false }, { tramos: ["ver"] });

      expect(screen.getByRole("button", { name: "Ver detalle de Camargo – Sucre" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Editar/ })).toBeNull();
    });

    it("lets go of the row when it is pressed again", async () => {
      const { user } = pintar({ tramoSel: 2, detalle: false });

      await user.click(fila(/^Camargo – Sucre/));

      expect(onSeleccionar).toHaveBeenCalledWith(null);
    });

    it("moves the selection to another row that is pressed", async () => {
      const { user } = pintar({ tramoSel: 2, detalle: false });

      await user.click(screen.getByRole("button", { name: /^Olivos – Sucre/ }));

      expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 1 });
    });

    it("brings a row selected from elsewhere into sight", () => {
      const aLaVista = vi.fn();
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = aLaVista;
      try {
        const { cambiar } = pintar({ detalle: false });
        expect(aLaVista).not.toHaveBeenCalled();

        // A tramo just created, or a row pressed in a city's card.
        cambiar({ tramoSel: 3, detalle: false });

        expect(aLaVista).toHaveBeenCalledWith({ block: "nearest" });
      } finally {
        Element.prototype.scrollIntoView = original;
      }
    });

    it("opens the card once it is asked for", () => {
      const { cambiar } = pintar({ tramoSel: 2, detalle: false });

      cambiar({ tramoSel: 2, detalle: true });

      expect(screen.getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Departamento" })).toBeInTheDocument();
    });
  });

});

describe("a tramo", () => {
  it("keeps «Guardar» off until the department changes, then sends only the department and reloads", async () => {
    const { user } = pintar({ tramoSel: 1 });
    expect(screen.getByRole("heading", { name: "Olivos – Sucre" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await elegirEnSelect(user, "Departamento", "Potosí");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(editTramo).toHaveBeenCalledTimes(1);
    expect(editTramo).toHaveBeenCalledWith(1, { id_departamento: 5 });
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("sends null for «Sin departamento»", async () => {
    const { user } = pintar({ tramoSel: 2 });

    await elegirEnSelect(user, "Departamento", "Sin departamento");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(editTramo).toHaveBeenCalledWith(2, { id_departamento: null });
  });

  // «Descartar» was taken out once — leaving the card does the same — and
  // Isaias asked for it back: undoing should not mean leaving and returning.
  it("undoes a change with «Descartar», which is off until there is one, and sends nothing", async () => {
    const { user } = pintar({ tramoSel: 2 });
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();

    await elegirEnSelect(user, "Departamento", "Potosí");
    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Potosí");
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Chuquisaca");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    expect(editTramo).not.toHaveBeenCalled();
  });

  // Leaving still discards: the way back is in the app's header, and the card
  // starts afresh when it is opened again.
  it("loses a change that was not saved once the card is left and opened again", async () => {
    const { user, desmontar } = pintar({ tramoSel: 2 });

    await elegirEnSelect(user, "Departamento", "Potosí");
    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Potosí");

    desmontar();
    pintar({ tramoSel: 2 });

    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Chuquisaca");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(editTramo).not.toHaveBeenCalled();
    expect(recargar).not.toHaveBeenCalled();
  });

  it("draws «Guardar» and «Archivar» as icons that name themselves to the pointer, even when off", async () => {
    const { user } = pintar({ tramoSel: 2 });
    const guardar = screen.getByRole("button", { name: "Guardar" });

    // No word on the button itself where there is a pointer: the row is 384px
    // and the title needs it. Only a phone draws it.
    soloEnMovil(guardar, "Guardar");
    soloEnMovil(screen.getByRole("button", { name: "Archivar" }), "Archivar");
    // Off, because nothing has changed — which is when somebody wonders what
    // it is. The pointer rests on the wrapper, which a disabled button cannot hear.
    expect(guardar).toBeDisabled();
    await user.hover(guardar.parentElement!);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardar");
  });

  it("starts the department select from the tramo that is selected, not from the one before", async () => {
    const { user, cambiar } = pintar({ tramoSel: 1 });
    await elegirEnSelect(user, "Departamento", "Potosí");
    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Potosí");

    // Camargo – Sucre is in Chuquisaca: the unsaved Potosí must not follow along.
    cambiar({ tramoSel: 2 });

    expect(screen.getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Chuquisaca");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("says the pole count once: in the lock's note when there is one, on a line of its own when there is not", () => {
    // Camargo – Sucre has three, and an editor is told so by the note about its cities.
    const { cambiar } = pintar({ tramoSel: 2 });
    expect(screen.getByText("Tiene 3 postes: no se pueden cambiar sus ciudades.")).toBeInTheDocument();
    expect(screen.queryByText(/postes? en este tramo/)).not.toBeInTheDocument();

    // Olivos – Sucre has none: no note, so the line is where the figure is read.
    cambiar({ tramoSel: 1 });
    expect(screen.getByText(/postes en este tramo/).closest("p")).toHaveTextContent("0 postes en este tramo");

    // And a row that does not carry the figure says nothing about it.
    const sinCifra: TramoConCifras = tramo(1, "Olivos – Sucre", OLIVOS, SUCRE, null);
    cambiar({ tramoSel: 1, tramos: [sinCifra] });
    expect(screen.queryByText(/postes? en este tramo/)).not.toBeInTheDocument();
  });

  it("keeps the pole count on its own line for a role that cannot edit, which is told nothing about a lock", () => {
    pintar({ tramoSel: 3 }, { tramos: ["ver"], ciudades: ["ver"] });

    expect(screen.queryByText(/no se pueden cambiar/)).toBeNull();
    // One pole, in the singular.
    expect(screen.getByText(/poste en este tramo/).closest("p")).toHaveTextContent("1 poste en este tramo");
  });

  // The two cities used to be rows that opened each city's card, and changing
  // them was a button that opened a dialog. They are the card's own fields now.
  describe("its two cities", () => {
    const ciudad = () => screen.getByRole("button", { name: "Ciudad" });
    const otra = () => screen.getByRole("button", { name: "Otra ciudad" });

    it("are two selectors holding what is stored, with no dialog to change them", () => {
      pintar({ tramoSel: 2 });

      expect(ciudad()).toHaveTextContent("Camargo");
      expect(otra()).toHaveTextContent("Sucre");
      expect(screen.queryByRole("button", { name: "Cambiar ciudades" })).toBeNull();
    });

    it("have each a small link to that city's own sheet, where a city is changed", () => {
      pintar({ tramoSel: 2 });

      // A link, not a button that opens a card here: there is none any more.
      expect(screen.getByRole("link", { name: "Editar ciudad Camargo" })).toHaveAttribute("href", "/app/ciudades/4");
      expect(screen.getByRole("link", { name: "Editar ciudad Sucre" })).toHaveAttribute("href", "/app/ciudades/2");
      expect(onSeleccionar).not.toHaveBeenCalled();
    });

    it("call that link what it is for a role that cannot change a city", () => {
      pintar({ tramoSel: 2 }, { tramos: ["ver", "editar"], ciudades: ["ver"] });

      expect(screen.getByRole("link", { name: "Ver ciudad Camargo" })).toHaveAttribute("href", "/app/ciudades/4");
      expect(screen.queryByRole("link", { name: /^Editar ciudad/ })).toBeNull();
    });

    it("have no link at all for a role that may not read cities", () => {
      pintar({ tramoSel: 2 }, { tramos: ["ver", "editar"] });

      expect(screen.queryByRole("link", { name: /ciudad Camargo/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Ciudad" })).toHaveTextContent("Camargo");
    });

    it("are locked on a tramo that has poles, and say why right there", () => {
      // Camargo – Sucre has three.
      pintar({ tramoSel: 2 });

      expect(ciudad()).toBeDisabled();
      expect(otra()).toBeDisabled();
      expect(screen.getByText("Tiene 3 postes: no se pueden cambiar sus ciudades.")).toBeInTheDocument();
    });

    it("say it in the singular for one pole", () => {
      pintar({ tramoSel: 3 });

      expect(screen.getByText("Tiene 1 poste: no se pueden cambiar sus ciudades.")).toBeInTheDocument();
    });

    it("are locked too when the row does not say how many poles it has, and say that instead of a number", () => {
      // What a role without `postes.ver` gets: absent, not zero. The server
      // refuses the change if there are poles, so it is not offered.
      pintar({ tramoSel: 1, tramos: [tramo(1, "Olivos – Sucre", OLIVOS, SUCRE, null)] });

      expect(ciudad()).toBeDisabled();
      expect(screen.getByText(/tu rol no ve si este los tiene/)).toBeInTheDocument();
    });

    it("are free on a tramo with no poles, and say nothing about a lock", () => {
      // Olivos – Sucre has none.
      pintar({ tramoSel: 1 });

      expect(ciudad()).toBeEnabled();
      expect(otra()).toBeEnabled();
      expect(screen.queryByText(/no se pueden cambiar/)).toBeNull();
    });

    it("never offer one end the city the other end already is", async () => {
      const { user } = pintar({ tramoSel: 1 });

      await user.click(otra());

      // Olivos is the first end. Camargo, a city that is neither, is on offer.
      expect(screen.getByRole("button", { name: "Camargo" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Olivos" })).not.toBeInTheDocument();
    });

    it("save a changed city with the card's own «Guardar», sending the pair and nothing else", async () => {
      const { user } = pintar({ tramoSel: 1 });
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

      // Olivos – Sucre becomes Olivos – Norte... which exists; Camargo does not pair with Olivos yet.
      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Camargo" }));
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      expect(editTramo).toHaveBeenCalledTimes(1);
      // The department was not touched, so its key does not travel: a key sent is a key written.
      expect(editTramo).toHaveBeenCalledWith(1, { ciudades: [1, 4] });
      expect(toast.success).toHaveBeenCalledWith("Tramo actualizado");
      expect(recargar).toHaveBeenCalledTimes(1);
    });

    it("send the department along only when it changed too", async () => {
      const { user } = pintar({ tramoSel: 1 });

      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Camargo" }));
      await elegirEnSelect(user, "Departamento", "Potosí");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      expect(editTramo).toHaveBeenCalledWith(1, { id_departamento: 5, ciudades: [1, 4] });
    });

    it("do not count the same two cities the other way round as a change", async () => {
      // A tramo has no direction. Sucre is taken out of the second end, put in
      // the first, and Olivos in the second: the same tramo.
      const { user } = pintar({ tramoSel: 1 });

      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Camargo" }));
      await user.click(ciudad());
      await user.click(await screen.findByRole("button", { name: "Sucre" }));
      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Olivos" }));

      expect(ciudad()).toHaveTextContent("Sucre");
      expect(otra()).toHaveTextContent("Olivos");
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    });

    it("say so, and keep «Guardar» off, when the pair chosen is already another tramo", async () => {
      // Olivos – Sucre turned into Olivos – Norte, which is tramo 3.
      const { user } = pintar({ tramoSel: 1 });

      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Norte" }));

      expect(screen.getByRole("status")).toHaveTextContent("Ese tramo ya existe: Norte – Olivos.");
      expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    });

    it("show the server's sentence when it refuses the pair, and keep what was chosen", async () => {
      editTramo.mockRejectedValue(rechazo(409, { message: "Ese par de ciudades pertenece a un tramo archivado: desarchívalo en lugar de mover este." }));
      const { user } = pintar({ tramoSel: 1 });

      await user.click(otra());
      await user.click(await screen.findByRole("button", { name: "Camargo" }));
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
        "Ese par de ciudades pertenece a un tramo archivado: desarchívalo en lugar de mover este.",
      ));
      expect(otra()).toHaveTextContent("Camargo");
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
      expect(recargar).not.toHaveBeenCalled();
    });

    it("are plain text, with the way into each city still there, for a role that cannot edit a tramo", () => {
      pintar({ tramoSel: 2 }, { tramos: ["ver"], ciudades: ["ver"] });

      expect(screen.queryByRole("button", { name: "Ciudad" })).toBeNull();
      // The name is also the caption of the city's photo at the head of the
      // card; what is asked for here is the one that stands where the field was.
      const fuera = screen.getAllByText("Camargo").filter((el) => !el.closest('[aria-label="Fotos de las ciudades del tramo"]'));
      expect(fuera).toHaveLength(1);
      expect(screen.getByRole("link", { name: "Ver ciudad Camargo" })).toBeInTheDocument();
      // And nothing about a lock it could do nothing about anyway.
      expect(screen.queryByText(/no se pueden cambiar/)).toBeNull();
    });
  });

  it("archives after confirming, clears the selection and reloads", async () => {
    const { user } = pintar({ tramoSel: 1 });

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    expect(deleteTramo).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Archivar" }));

    expect(deleteTramo).toHaveBeenCalledTimes(1);
    expect(deleteTramo).toHaveBeenCalledWith(1);
    expect(onSeleccionar).toHaveBeenCalledWith(null);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("shows the server's sentence when archiving is refused, and clears nothing", async () => {
    deleteTramo.mockRejectedValue(rechazo(409, { message: "El tramo tiene 3 postes vivos." }));
    const { user } = pintar({ tramoSel: 2 });

    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archivar" }));

    expect(toast.error).toHaveBeenCalledWith("El tramo tiene 3 postes vivos.");
    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(recargar).not.toHaveBeenCalled();
  });
});

// Every card keeps what it does in the same place: on its title's row. It
// used to sit at the foot, under however much the card held. One exception,
// asked for by Isaias on 2026-10-13: a tramo's card has photos at its head, and
// saving sits over them, as it does on a city's sheet.
describe("what a card does", () => {
  it("saves and discards a tramo from the head of its card, above the title, where a city's sheet does", () => {
    pintar({ tramoSel: 2 });

    const cabecera = screen.getByRole("heading", { level: 2 }).closest("header")!;
    for (const nombre of ["Guardar", "Descartar"]) {
      const boton = screen.getByRole("button", { name: nombre });
      expect(cabecera).not.toContainElement(boton);
      // Before the title in the document: in the head, over the photos.
      expect(boton.compareDocumentPosition(cabecera) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it.each<[string, Partial<RedPanelProps>, string[]]>([
    ["a tramo's card", { tramoSel: 2 }, ["Archivar"]],
    ["a new tramo", { estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) }, ["Cancelar", "Guardar tramo"]],
    ["the city a new tramo lacks", { estado: estado({ modo: "ciudadNueva", borrador: { lat: -19, lng: -65 } }) }, ["Volver al tramo", "Guardar ciudad"]],
  ])("in %s is on the title's row, and the card has no foot", (_, props, botones) => {
    pintar(props);

    const cabecera = screen.getByRole("heading", { level: 2 }).closest("header")!;
    for (const nombre of botones) {
      expect(cabecera).toContainElement(screen.getByRole("button", { name: nombre }));
    }
    expect(document.querySelector("footer")).toBeNull();
  });

  it.each<[string, Partial<RedPanelProps>, string]>([
    ["a tramo's card", { tramoSel: 2 }, "Guardar"],
    ["a new tramo", { estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) }, "Guardar tramo"],
    ["the city a new tramo lacks", { estado: estado({ modo: "ciudadNueva", borrador: { lat: -19, lng: -65 } }) }, "Guardar ciudad"],
  ])("saves, in %s, from an icon that names itself to the pointer", async (_, props, nombre) => {
    const { user } = pintar(props);
    const guardar = screen.getByRole("button", { name: nombre });

    // The same control in all three: no word on it but on a phone, its name on hover.
    soloEnMovil(guardar, nombre);
    await user.hover(guardar.parentElement!);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(nombre);
  });

  // A city used to have a card here too, where it was renamed, moved and given
  // a photo. It is read on the map now, and changed on its own sheet.
  it("has no card for a city: the panel stays the list whatever is pressed on the map", () => {
    pintar();

    expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mover" })).toBeNull();
  });

  it("keeps a way out, as a word, in the two cards that have no back arrow", () => {
    const { cambiar } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4] }) });
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveTextContent("Cancelar");

    cambiar({ estado: estado({ modo: "ciudadNueva", borrador: null }) });
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();
    expect(screen.getByRole("button", { name: "Volver al tramo" })).toHaveTextContent("Volver");
  });

  it("is not drawn for a role that can change nothing", () => {
    pintar({ tramoSel: 2 }, { tramos: ["ver"], ciudades: ["ver"] });

    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });
});

// The rail beside a tramo's card chooses what the card shows. The summary is
// the card as it always was; each of the others takes the whole card.
describe("the views of a tramo's card", () => {
  const poste = (id: number, name: string) => ({ id, name }) as unknown as PosteInterface;
  const evento = (id: number, description: string, date: string, extra: Partial<EventoInterface> = {}) =>
    ({ id, description, date: new Date(date), ...extra }) as unknown as EventoInterface;

  // Braces: a `beforeEach` that returns a function is handed it back as its
  // cleanup, and `mockResolvedValue` returns the mock.
  beforeEach(() => { getEventosPendientesDelTramo.mockResolvedValue([]); });

  describe("its poles", () => {
    it("lists every pole of the tramo as a link to that pole's sheet, under the tramo's own header", () => {
      pintar({ tramoSel: 2, vista: "postes", postes: [poste(9, "P-9"), poste(10, "P-10")] });

      expect(screen.getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
      const lista = screen.getByRole("list", { name: "Postes de Camargo – Sucre" });
      expect(within(lista).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
        ["Poste P-9", "/app/postes/9"],
        ["Poste P-10", "/app/postes/10"],
      ]);
      // Not the summary: nothing of the tramo can be changed from this view.
      expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    });

    it("says under each pole who owns it, what it is made of and how many incidents it has open", () => {
      const conDatos = (id: number, name: string, pendingEvents: number | string) => ({
        id, name, pendingEvents, propietario: { id: 1, name: "ENTEL" }, material: { id: 2, name: "Hormigón" },
      }) as unknown as PosteInterface;
      // The server sends the count as text: PostgreSQL's COUNT is a bigint.
      pintar({ tramoSel: 2, vista: "postes", postes: [conDatos(9, "P-9", "0"), conDatos(10, "P-10", "1"), conDatos(11, "P-11", 4)] }, { ...TODO, eventos: ["ver"] });

      expect(screen.getByRole("link", { name: /Poste P-9/ })).toHaveTextContent("ENTEL · Hormigón · sin pendientes");
      expect(screen.getByRole("link", { name: /Poste P-10/ })).toHaveTextContent("ENTEL · Hormigón · 1 pendiente");
      expect(screen.getByRole("link", { name: /Poste P-10/ })).not.toHaveTextContent("1 pendientes");
      expect(screen.getByRole("link", { name: /Poste P-11/ })).toHaveTextContent("ENTEL · Hormigón · 4 pendientes");
    });

    it("leaves the open incidents out for a role that may not read incidents", () => {
      const p = { id: 9, name: "P-9", pendingEvents: 3, propietario: { id: 1, name: "ENTEL" }, material: { id: 2, name: "Hormigón" } } as unknown as PosteInterface;
      pintar({ tramoSel: 2, vista: "postes", postes: [p] });

      const fila = screen.getByRole("link", { name: /Poste P-9/ });
      expect(fila).toHaveTextContent("ENTEL · Hormigón");
      expect(fila).not.toHaveTextContent(/pendiente/);
    });

    it("leaves out whatever the row does not carry, without dashes or a line of its own", () => {
      pintar({ tramoSel: 2, vista: "postes", postes: [poste(9, "P-9")] }, { ...TODO, eventos: ["ver"] });

      const fila = screen.getByRole("link", { name: /Poste P-9/ });
      expect(fila).toHaveTextContent(/^Poste P-9$/);
    });

    it("does not say the tramo has none while they are still on their way", () => {
      pintar({ tramoSel: 2, vista: "postes", postes: [], cargandoPostes: true });

      expect(screen.getByRole("status", { name: "Cargando" })).toBeInTheDocument();
      expect(screen.queryByText("Este tramo no tiene postes.")).toBeNull();
    });

    it("says so once they are in and there are none", () => {
      pintar({ tramoSel: 1, vista: "postes" });

      expect(screen.getByText("Este tramo no tiene postes.")).toBeInTheDocument();
    });
  });

  describe("its pending incidents", () => {
    it("asks for them when the view is opened, and not with the card", async () => {
      const { cambiar } = pintar({ tramoSel: 2 });
      expect(getEventosPendientesDelTramo).not.toHaveBeenCalled();

      cambiar({ tramoSel: 2, vista: "pendientes" });

      await waitFor(() => expect(getEventosPendientesDelTramo).toHaveBeenCalledTimes(1));
      expect(getEventosPendientesDelTramo).toHaveBeenCalledWith(2);
    });

    it("lists each as a link to that incident's sheet, with its pole, the priority ones first and then the oldest", async () => {
      getEventosPendientesDelTramo.mockResolvedValue([
        evento(1, "Cable suelto", "2026-10-01", { poste: { name: "P-1" } as PosteInterface }),
        evento(2, "Poste inclinado", "2026-09-01"),
        evento(3, "Aislador roto", "2026-10-05", { priority: true }),
      ]);
      pintar({ tramoSel: 2, vista: "pendientes" });

      const lista = await screen.findByRole("list", { name: "Eventos pendientes de Camargo – Sucre" });
      const enlaces = within(lista).getAllByRole("link");
      expect(enlaces.map((a) => a.getAttribute("href"))).toEqual(["/app/eventos/3", "/app/eventos/2", "/app/eventos/1"]);
      expect(enlaces[0]).toHaveTextContent("Aislador roto");
      expect(enlaces[0]).toHaveTextContent("prioritario");
      expect(enlaces[2]).toHaveTextContent("Poste P-1");
      expect(enlaces[1]).not.toHaveTextContent("prioritario");
    });

    it("says there are none, which is not what it says while it does not know", async () => {
      const respuesta = diferida<EventoInterface[]>();
      getEventosPendientesDelTramo.mockReturnValue(respuesta.promesa);
      pintar({ tramoSel: 2, vista: "pendientes" });

      expect(screen.getByRole("status", { name: "Cargando" })).toBeInTheDocument();
      expect(screen.queryByText("Este tramo no tiene eventos pendientes.")).toBeNull();

      await act(async () => { respuesta.ok([]); });
      expect(screen.getByText("Este tramo no tiene eventos pendientes.")).toBeInTheDocument();
    });

    it("says it could not ask, with the server's sentence, instead of showing an empty list — and asks again on «Reintentar»", async () => {
      getEventosPendientesDelTramo.mockRejectedValueOnce(rechazo(403, { message: "No tiene permiso para ver eventos" }));
      const { user } = pintar({ tramoSel: 2, vista: "pendientes" });

      expect(await screen.findByText("No tiene permiso para ver eventos")).toBeInTheDocument();
      expect(screen.queryByText("Este tramo no tiene eventos pendientes.")).toBeNull();

      getEventosPendientesDelTramo.mockResolvedValue([evento(1, "Cable suelto", "2026-10-01")]);
      await user.click(screen.getByRole("button", { name: "Reintentar" }));

      expect(await screen.findByRole("link", { name: /Cable suelto/ })).toBeInTheDocument();
      expect(getEventosPendientesDelTramo).toHaveBeenCalledTimes(2);
    });

    it("asks afresh for another tramo, and does not show the one before's meanwhile", async () => {
      getEventosPendientesDelTramo.mockResolvedValueOnce([evento(1, "Cable suelto", "2026-10-01")]);
      const { cambiar } = pintar({ tramoSel: 2, vista: "pendientes" });
      await screen.findByRole("link", { name: /Cable suelto/ });

      const otra = diferida<EventoInterface[]>();
      getEventosPendientesDelTramo.mockReturnValue(otra.promesa);
      cambiar({ tramoSel: 3, vista: "pendientes" });

      expect(screen.queryByRole("link", { name: /Cable suelto/ })).toBeNull();
      expect(getEventosPendientesDelTramo).toHaveBeenLastCalledWith(3);
    });

    it("drops an answer that lands after the view was left", async () => {
      const respuesta = diferida<EventoInterface[]>();
      getEventosPendientesDelTramo.mockReturnValue(respuesta.promesa);
      const { cambiar } = pintar({ tramoSel: 2, vista: "pendientes" });

      cambiar({ tramoSel: 2, vista: "resumen" });
      await act(async () => { respuesta.ok([evento(1, "Cable suelto", "2026-10-01")]); });

      expect(screen.queryByRole("link", { name: /Cable suelto/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    });
  });

  it("shows the tramo's own audit log, under the tramo's header", () => {
    pintar({ tramoSel: 2, vista: "bitacora" });

    expect(screen.getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
    expect(screen.getByTestId("bitacora")).toHaveTextContent("Tramo 2");
  });

  it("shows the list, whatever view was on, for a tramo that is selected and not opened", () => {
    pintar({ tramoSel: 2, detalle: false, vista: "postes" });

    expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();
  });
});

describe("the back arrow", () => {
  // It used to sit in the card, left of its title. It is in the app's header
  // now, left of the trail, and the page puts it there: the card has none.
  it("is not in a tramo's card, nor in any of its views", () => {
    const { cambiar } = pintar({ tramoSel: 1 });
    expect(screen.getByRole("heading", { name: "Olivos – Sucre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();

    for (const vista of ["postes", "pendientes", "bitacora"] as const) {
      cambiar({ tramoSel: 1, vista });
      expect(screen.queryByRole("button", { name: "Volver a la lista" })).toBeNull();
    }
  });

  it("is not in the views for a new tramo or a new city, whose «Cancelar» is the way out", () => {
    const { cambiar } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [] }) });
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).not.toBeInTheDocument();

    cambiar({ estado: estado({ modo: "ciudadNueva", borrador: null }) });
    expect(screen.queryByRole("button", { name: "Volver a la lista" })).not.toBeInTheDocument();
  });
});

describe("a role that can only look", () => {
  const ACCIONES = /guardar|descartar|mover|archivar|cambiar ciudades|tramo desde aquí/i;

  it("has no button that changes anything on a tramo", () => {
    pintar({ tramoSel: 1 }, { tramos: ["ver"] });

    expect(screen.getByRole("heading", { name: "Olivos – Sucre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCIONES })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Departamento" })).not.toBeInTheDocument();
    // The department is text for them.
    expect(screen.getByText("Sin departamento")).toBeInTheDocument();
  });

});

describe("a new tramo", () => {
  const nuevo = (elegidas: number[]) => estado({ modo: "tramoNuevo", elegidas });

  it("asks for two cities until it has them, then names the pair in order", () => {
    const { cambiar } = pintar({ estado: nuevo([2]) });
    expect(screen.getByRole("heading", { name: "Elige dos ciudades" })).toBeInTheDocument();
    expect(screen.getByText("Tramo nuevo")).toBeInTheDocument();

    // Picked Sucre first, Camargo second: the title does not keep that order.
    cambiar({ estado: nuevo([2, 4]) });
    expect(screen.getByRole("heading", { name: "Camargo – Sucre" })).toBeInTheDocument();
  });

  it("shows the first chosen city in the first selector and the second in the second", () => {
    pintar({ estado: nuevo([4]) });

    // After the first selector is cleared the remaining city is the first one: it shows there.
    expect(screen.getByRole("button", { name: "Ciudad" })).toHaveTextContent("Camargo");
    expect(screen.getByRole("button", { name: "Otra ciudad" })).toHaveTextContent("Elige o pincha en el mapa");
  });

  it("sends the chosen city to its own slot, and never offers the other slot's city", async () => {
    const { user } = pintar({ estado: nuevo([4]) });

    await user.click(screen.getByRole("button", { name: "Otra ciudad" }));
    expect(screen.queryByRole("button", { name: "Camargo" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Sucre" }));

    expect(despachar).toHaveBeenCalledWith({ tipo: "fijar", hueco: 1, id: 2 });
  });

  it("warns that the pair exists, blocks saving, and opens the existing tramo", async () => {
    // Sucre then Olivos: the stored tramo is Olivos – Sucre, the other way round.
    const { user } = pintar({ estado: nuevo([2, 1]) });

    expect(screen.getByText(/Ese tramo ya existe\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar tramo" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Abrirlo" }));

    expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 1 });
    expect(despachar).toHaveBeenCalledWith({ tipo: "terminar" });
    expect(createTramo).not.toHaveBeenCalled();
  });

  it("saves the two cities and the department, then selects the tramo that was created", async () => {
    const { user } = pintar({ estado: nuevo([4, 1]) });
    expect(screen.getByRole("button", { name: "Guardar tramo" })).toBeEnabled();

    await elegirEnSelect(user, "Departamento", "Potosí");
    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(createTramo).toHaveBeenCalledTimes(1);
    expect(createTramo).toHaveBeenCalledWith({ ciudades: [4, 1], id_departamento: 5 });
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(despachar).toHaveBeenCalledWith({ tipo: "terminar" });
    expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 9 });
  });

  it("sends no department at all when none was chosen", async () => {
    const { user } = pintar({ estado: nuevo([4, 1]) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(createTramo).toHaveBeenCalledWith({ ciudades: [4, 1] });
  });

  it("selects the tramo a 409 points at when it is alive", async () => {
    createTramo.mockRejectedValue(rechazo(409, { message: "Ya existe", tramo: { id: 7, nombre: "Camargo – Olivos", archivado: false } }));
    const { user } = pintar({ estado: nuevo([4, 1]) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 7 });
    expect(despachar).toHaveBeenCalledWith({ tipo: "terminar" });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tells the person the tramo already existed and reloads, since a tramo this screen has not loaded is what a live 409 points at", async () => {
    createTramo.mockRejectedValue(rechazo(409, { message: "Ya existe", tramo: { id: 7, nombre: "Camargo – Olivos", archivado: false } }));
    const { user } = pintar({ estado: nuevo([4, 1]) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(toast.info).toHaveBeenCalledWith("Ese tramo ya existía: Camargo – Olivos");
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(onSeleccionar.mock.invocationCallOrder[0]).toBeLessThan(recargar.mock.invocationCallOrder[0]);
  });

  it("says the tramo is archived, and selects nothing, when a 409 points at an archived one", async () => {
    createTramo.mockRejectedValue(rechazo(409, { message: "Ya existe", tramo: { id: 7, nombre: "Camargo – Olivos", archivado: true } }));
    const { user } = pintar({ estado: nuevo([4, 1]) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(toast.error).toHaveBeenCalledWith("Ese tramo existe archivado. Recupéralo en Archivados.");
    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(despachar).not.toHaveBeenCalled();
  });

  it("has its two buttons on the title's row, not at the foot of the form", () => {
    pintar({ estado: nuevo([4, 1]) });

    const cabecera = screen.getByRole("heading", { name: "Camargo – Olivos" }).closest("header")!;
    expect(cabecera).toContainElement(screen.getByRole("button", { name: "Cancelar" }));
    expect(cabecera).toContainElement(screen.getByRole("button", { name: "Guardar tramo" }));
    expect(document.querySelector("footer")).toBeNull();
  });

  it("offers to make the city it lacks, to whoever may create cities, and keeps its place meanwhile", async () => {
    const { user } = pintar({ estado: nuevo([4]) });

    await user.click(screen.getByRole("button", { name: "Crear ciudad" }));

    // Not «terminar»: what is picked so far is the tramo the city is for.
    expect(despachar).toHaveBeenCalledTimes(1);
    expect(despachar).toHaveBeenCalledWith({ tipo: "ciudadParaTramo" });
  });

  it("does not offer it without ciudades.crear", () => {
    pintar({ estado: nuevo([4]) }, { tramos: ["ver", "crear"], ciudades: ["ver"] });

    expect(screen.queryByRole("button", { name: "Crear ciudad" })).toBeNull();
  });

  it("cancels back to the map", async () => {
    const { user } = pintar({ estado: nuevo([4]) });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(despachar).toHaveBeenCalledWith({ tipo: "terminar" });
  });
});

describe("a new city", () => {
  const BORRADOR = { lat: -19.123456, lng: -65.654321 };
  const nueva = (borrador: { lat: number; lng: number } | null) => estado({ modo: "ciudadNueva", borrador });

  it("cannot be saved before the map is pressed", () => {
    pintar({ estado: nueva(null) });

    expect(screen.getByText("Pincha en el mapa donde va la ciudad.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar ciudad" })).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
  });

  it("cannot be saved with a blank name, and shows the position with five decimals", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });
    const campo = screen.getByRole("textbox", { name: "Nombre" });

    expect(campo).toHaveFocus();
    expect(screen.getByText("-19.12346, -65.65432")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar ciudad" })).toBeDisabled();
    await user.type(campo, "   ");
    expect(screen.getByRole("button", { name: "Guardar ciudad" })).toBeDisabled();
  });

  it("saves without a photo with an empty image, then goes back to the tramo with the new city", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "  Tarija ");
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    expect(uploadImage).not.toHaveBeenCalled();
    expect(createCiudad).toHaveBeenCalledTimes(1);
    expect(createCiudad).toHaveBeenCalledWith({ name: "Tarija", image: "", lat: BORRADOR.lat, lng: BORRADOR.lng });
    expect(recargar).toHaveBeenCalledTimes(1);
    // Back to the tramo it was made for, and no city card opened on the way.
    await waitFor(() => expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: 8 }));
    expect(despachar).toHaveBeenCalledTimes(1);
    expect(onSeleccionar).not.toHaveBeenCalled();
  });

  it("goes back to the tramo, with nothing new, on «Volver al tramo»", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.click(screen.getByRole("button", { name: "Volver al tramo" }));

    expect(despachar).toHaveBeenCalledTimes(1);
    expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: undefined });
    expect(createCiudad).not.toHaveBeenCalled();
  });

  it("uploads the photo first and sends the path it was given", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Elegir foto" }));
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    expect(uploadImage).toHaveBeenCalledWith(FOTO);
    expect(createCiudad).toHaveBeenCalledWith({ name: "Tarija", image: "/files/foto.jpg", lat: BORRADOR.lat, lng: BORRADOR.lng });
    expect(uploadImage.mock.invocationCallOrder[0]).toBeLessThan(createCiudad.mock.invocationCallOrder[0]);
  });

  it("creates nothing when the upload is refused, and says why", async () => {
    uploadImage.mockResolvedValue({ ok: false, message: "la imagen supera el máximo de 5 MB" });
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Elegir foto" }));
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    expect(toast.error).toHaveBeenCalledWith("la imagen supera el máximo de 5 MB");
    expect(createCiudad).not.toHaveBeenCalled();
  });

  it("warns about a name already taken, offers to use that city in the tramo, and still lets it be saved", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "  oLiVoS ");

    expect(screen.getByText(/Ya existe una ciudad con ese nombre\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar ciudad" })).toBeEnabled();

    // The city was not missing after all: it is the one the tramo wanted.
    await user.click(screen.getByRole("button", { name: "Usarla en el tramo" }));
    expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: 1 });
    expect(onSeleccionar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(createCiudad).toHaveBeenCalledWith({ name: "oLiVoS", image: "", lat: BORRADOR.lat, lng: BORRADOR.lng });
  });

  it("does not warn while the name matches no city", async () => {
    const { user } = pintar({ estado: nueva(BORRADOR) });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");

    expect(screen.queryByText(/Ya existe una ciudad/)).not.toBeInTheDocument();
  });
});

/** A promise the test settles by hand, to look at the card while a request is in the air. */
const diferida = <T,>() => {
  let ok!: (v: T) => void;
  let ko!: (e: unknown) => void;
  const promesa = new Promise<T>((resolve, reject) => { ok = resolve; ko = reject; });
  return { promesa, ok, ko };
};

describe("a save in flight", () => {
  const BORRADOR = { lat: -19.1, lng: -65.6 };

  it("keeps a new city's buttons off while it is created and while the lists reload, so it is created once", async () => {
    const crear = diferida<{ id: number }>();
    const lista = diferida<void>();
    createCiudad.mockReturnValue(crear.promesa);
    recargar.mockReturnValue(lista.promesa);
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    const guardar = screen.getByRole("button", { name: "Guardar ciudad" });

    await user.click(guardar);
    expect(guardar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volver al tramo" })).toBeDisabled();
    await user.click(guardar);
    expect(createCiudad).toHaveBeenCalledTimes(1);

    await act(async () => { crear.ok({ id: 8 }); });
    // Created, the reload still in the air: the form is still on screen (the
    // dispatch is a mock here) and must not take a second press.
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(guardar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volver al tramo" })).toBeDisabled();
    await user.click(guardar);
    expect(createCiudad).toHaveBeenCalledTimes(1);

    // Only now, with the city in the lists, is the tramo gone back to.
    expect(despachar).not.toHaveBeenCalled();
    await act(async () => { lista.ok(); });
    expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: 8 });
    expect(guardar).toBeDisabled();
    expect(createCiudad).toHaveBeenCalledTimes(1);
  });

  it("keeps a new tramo's buttons off while it is created and while the lists reload, so it is created once", async () => {
    const crear = diferida<{ id: number }>();
    const lista = diferida<void>();
    createTramo.mockReturnValue(crear.promesa);
    recargar.mockReturnValue(lista.promesa);
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });
    const guardar = screen.getByRole("button", { name: "Guardar tramo" });

    await user.click(guardar);
    expect(guardar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.click(guardar);
    expect(createTramo).toHaveBeenCalledTimes(1);

    await act(async () => { crear.ok({ id: 9 }); });
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(guardar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.click(guardar);
    expect(createTramo).toHaveBeenCalledTimes(1);

    await act(async () => { lista.ok(); });
    expect(guardar).toBeDisabled();
    expect(createTramo).toHaveBeenCalledTimes(1);
  });

  it("waits for the reload before going back to the tramo, so the new city has a name to show there", async () => {
    const lista = diferida<void>();
    recargar.mockReturnValue(lista.promesa);
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Ciudad creada");
    expect(despachar).not.toHaveBeenCalled();

    await act(async () => { lista.ok(); });
    expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: 8 });
  });

  it("does not go back to the tramo if the card was left while the reload was out", async () => {
    const lista = diferida<void>();
    recargar.mockReturnValue(lista.promesa);
    const { user, desmontar } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));

    desmontar();
    await act(async () => { lista.ok(); });

    expect(despachar).not.toHaveBeenCalled();
  });

  it("leaves the map and selects the new tramo before the reload has answered", async () => {
    const lista = diferida<void>();
    recargar.mockReturnValue(lista.promesa);
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(despachar).toHaveBeenCalledWith({ tipo: "terminar" });
    expect(onSeleccionar).toHaveBeenCalledWith({ tramo: 9 });
    expect(onSeleccionar.mock.invocationCallOrder[0]).toBeLessThan(recargar.mock.invocationCallOrder[0]);
  });

  it("enables «Guardar ciudad» again after a refused create, with the server's sentence, and the retry goes through", async () => {
    createCiudad.mockRejectedValueOnce(rechazo(400, { message: "Coordenadas fuera de rango" }));
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    const guardar = screen.getByRole("button", { name: "Guardar ciudad" });

    await user.click(guardar);

    expect(toast.error).toHaveBeenCalledWith("Coordenadas fuera de rango");
    expect(guardar).toBeEnabled();
    expect(screen.getByRole("button", { name: "Volver al tramo" })).toBeEnabled();
    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(despachar).not.toHaveBeenCalled();

    await user.click(guardar);
    expect(createCiudad).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(despachar).toHaveBeenCalledWith({ tipo: "volverAlTramo", nueva: 8 }));
  });

  it("enables «Guardar tramo» again after a refused create", async () => {
    createTramo.mockRejectedValueOnce(rechazo(400, { message: "Elige dos ciudades distintas" }));
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });
    const guardar = screen.getByRole("button", { name: "Guardar tramo" });

    await user.click(guardar);

    expect(toast.error).toHaveBeenCalledWith("Elige dos ciudades distintas");
    expect(guardar).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(onSeleccionar).not.toHaveBeenCalled();
  });

  it("enables «Guardar tramo» again after a 409 that points at an archived tramo", async () => {
    createTramo.mockRejectedValueOnce(rechazo(409, { message: "Ya existe", tramo: { id: 7, nombre: "x", archivado: true } }));
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(screen.getByRole("button", { name: "Guardar tramo" })).toBeEnabled();
  });

  it("enables the department's «Guardar» again after a refused change, with the server's sentence", async () => {
    editTramo.mockRejectedValue(rechazo(400, { message: "Departamento inexistente" }));
    const { user } = pintar({ tramoSel: 1 });
    await elegirEnSelect(user, "Departamento", "Potosí");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(toast.error).toHaveBeenCalledWith("Departamento inexistente");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(recargar).not.toHaveBeenCalled();
  });

  it("keeps the department's «Guardar» off while the change is in the air and while the lists reload", async () => {
    const poner = diferida<object>();
    const lista = diferida<void>();
    editTramo.mockReturnValue(poner.promesa);
    recargar.mockReturnValue(lista.promesa);
    const { user } = pintar({ tramoSel: 1 });
    await elegirEnSelect(user, "Departamento", "Potosí");
    const guardar = screen.getByRole("button", { name: "Guardar" });

    await user.click(guardar);
    await user.click(guardar);
    expect(editTramo).toHaveBeenCalledTimes(1);

    await act(async () => { poner.ok({}); });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(editTramo).toHaveBeenCalledTimes(1);

    await act(async () => { lista.ok(); });
    await waitFor(() => expect(guardar).toBeEnabled());
  });

  it("uploads the photo once when the create fails and is tried again with the same file", async () => {
    createCiudad.mockRejectedValueOnce(rechazo(500, {}));
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Elegir foto" }));

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(createCiudad).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    expect(createCiudad).toHaveBeenCalledTimes(2);
    expect(createCiudad).toHaveBeenLastCalledWith({ name: "Tarija", image: "/files/foto.jpg", lat: BORRADOR.lat, lng: BORRADOR.lng });
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });
});

describe("a save whose answer comes after the view is gone", () => {
  const BORRADOR = { lat: -19.1, lng: -65.6 };

  it("creates the city, reloads, and neither selects nor ends anything once its view was unmounted", async () => {
    const crear = diferida<{ id: number }>();
    createCiudad.mockReturnValue(crear.promesa);
    const { user, desmontar } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));

    desmontar();
    await act(async () => { crear.ok({ id: 8 }); });

    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(despachar).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("does the same for a new tramo", async () => {
    const crear = diferida<{ id: number }>();
    createTramo.mockReturnValue(crear.promesa);
    const { user, desmontar } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });
    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    desmontar();
    await act(async () => { crear.ok({ id: 9 }); });

    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(despachar).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("does the same when a 409 points at a live tramo", async () => {
    const crear = diferida<{ id: number }>();
    createTramo.mockReturnValue(crear.promesa);
    const { user, desmontar } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });
    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    desmontar();
    await act(async () => {
      crear.ko(rechazo(409, { message: "Ya existe", tramo: { id: 7, nombre: "Camargo – Olivos", archivado: false } }));
    });

    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(despachar).not.toHaveBeenCalled();
  });

  it("archives the tramo and reloads, but does not clear a selection that is no longer this tramo's", async () => {
    const borrar = diferida<void>();
    deleteTramo.mockReturnValue(borrar.promesa);
    const { user, desmontar } = pintar({ tramoSel: 1 });
    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archivar" }));

    desmontar();
    await act(async () => { borrar.ok(); });

    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

});

describe("telling the page a save is in flight", () => {
  const BORRADOR = { lat: -19.1, lng: -65.6 };

  it("reports busy from the moment a new city is sent, and free again once it is refused", async () => {
    const crear = diferida<{ id: number }>();
    createCiudad.mockReturnValue(crear.promesa);
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    expect(onOcupado).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(onOcupado).toHaveBeenLastCalledWith(true);

    await act(async () => { crear.ko(rechazo(400, { message: "no" })); });
    expect(onOcupado).toHaveBeenLastCalledWith(false);
  });

  it("reports free when the view that was busy goes away", async () => {
    createCiudad.mockReturnValue(new Promise(() => {}));
    const { user, desmontar } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(onOcupado).toHaveBeenLastCalledWith(true);

    desmontar();

    expect(onOcupado).toHaveBeenLastCalledWith(false);
  });

  it("reports busy while a new tramo is in the air", async () => {
    createTramo.mockReturnValue(new Promise(() => {}));
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(onOcupado).toHaveBeenLastCalledWith(true);
  });

  it("reports busy while an archive is in the air", async () => {
    deleteTramo.mockReturnValue(new Promise(() => {}));
    const { user } = pintar({ tramoSel: 1 });
    await user.click(screen.getByRole("button", { name: "Archivar" }));

    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archivar" }));

    expect(onOcupado).toHaveBeenLastCalledWith(true);
  });

  it("reports busy while a department change is in the air", async () => {
    editTramo.mockReturnValue(new Promise(() => {}));
    const { user } = pintar({ tramoSel: 1 });
    await elegirEnSelect(user, "Departamento", "Potosí");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onOcupado).toHaveBeenLastCalledWith(true);
  });

  it("disables both city pickers and the department of a new tramo while it is created, and frees them if it is refused", async () => {
    const crear = diferida<{ id: number }>();
    createTramo.mockReturnValue(crear.promesa);
    const { user } = pintar({ estado: estado({ modo: "tramoNuevo", elegidas: [4, 1] }) });
    expect(screen.getByRole("button", { name: "Ciudad" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Guardar tramo" }));

    expect(screen.getByRole("button", { name: "Ciudad" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Otra ciudad" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Departamento" })).toBeDisabled();

    await act(async () => { crear.ko(rechazo(400, { message: "no" })); });
    expect(screen.getByRole("button", { name: "Ciudad" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Otra ciudad" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Departamento" })).toBeEnabled();
  });

  it("freezes the new city's photo while the create is out, and unfreezes it if it is refused", async () => {
    const crear = diferida<{ id: number }>();
    createCiudad.mockReturnValue(crear.promesa);
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Tarija");
    await user.click(screen.getByRole("button", { name: "Elegir foto" }));
    expect(screen.getByRole("button", { name: "Elegir foto" })).toHaveAttribute("data-readonly", "false");

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(screen.getByRole("button", { name: "Elegir foto" })).toHaveAttribute("data-readonly", "true");
    expect(screen.getByRole("button", { name: "Elegir foto" })).toHaveAttribute("data-file", "foto.jpg");

    await act(async () => { crear.ko(rechazo(400, { message: "no" })); });
    expect(screen.getByRole("button", { name: "Elegir foto" })).toHaveAttribute("data-readonly", "false");
  });

  it("makes the new city's name read-only while the create is out, and editable again if it is refused", async () => {
    const crear = diferida<{ id: number }>();
    createCiudad.mockReturnValue(crear.promesa);
    const { user } = pintar({ estado: estado({ modo: "ciudadNueva", borrador: BORRADOR }) });
    const campo = screen.getByRole("textbox", { name: "Nombre" });
    await user.type(campo, "Tarija");
    expect(campo).not.toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: "Guardar ciudad" }));
    expect(campo).toHaveAttribute("readonly");
    await user.type(campo, "X");
    expect(campo).toHaveValue("Tarija");

    await act(async () => { crear.ko(rechazo(400, { message: "no" })); });
    expect(campo).not.toHaveAttribute("readonly");
  });
});

describe("a city without a name", () => {
  const SIN_NOMBRE: CiudadDeRed = { id: 10, name: null, lat: -21, lng: -64, image: null };
  const CON_ELLA = [...CIUDADES, SIN_NOMBRE];

  it("does not stop a new city's name from being checked against the others", async () => {
    const { user } = pintar({
      ciudades: CON_ELLA, estado: estado({ modo: "ciudadNueva", borrador: { lat: -19, lng: -65 } }),
    });

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "olivos");

    expect(screen.getByText(/Ya existe una ciudad con ese nombre\./)).toBeInTheDocument();
  });

  it("is offered as #<id> when picking the cities of a new tramo", () => {
    pintar({ ciudades: CON_ELLA, estado: estado({ modo: "tramoNuevo", elegidas: [10] }) });

    expect(screen.getByRole("button", { name: "Ciudad" })).toHaveTextContent("#10");
  });
});

describe("a tramo that ends in an archived city", () => {
  const VIEJA = { id: 9, name: "Vieja", lat: -30, lng: -70 };
  const CON_ARCHIVADA: TramoConCifras = {
    ...tramo(4, "Olivos – Vieja", OLIVOS, OLIVOS, null, 0),
    ciudades: [OLIVOS, VIEJA],
  };

  it("names the archived end in its selector, marked «(archivada)», and gives it no card to open", () => {
    pintar({ tramos: [CON_ARCHIVADA], tramoSel: 4 });

    // A selector with no option for its value would show nothing at all.
    expect(screen.getByRole("button", { name: "Otra ciudad" })).toHaveTextContent("Vieja (archivada)");
    expect(screen.getByRole("link", { name: "Editar ciudad Olivos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ciudad Vieja/ })).not.toBeInTheDocument();
  });

  it("calls an archived end with no name #<id>", () => {
    const sinNombre: TramoConCifras = { ...CON_ARCHIVADA, ciudades: [OLIVOS, { ...VIEJA, name: null }] };
    pintar({ tramos: [sinNombre], tramoSel: 4 });

    expect(screen.getByRole("button", { name: "Otra ciudad" })).toHaveTextContent("#9 (archivada)");
  });
});

describe("a tramo whose department changes elsewhere", () => {
  it("shows the new department and keeps «Guardar» off, instead of offering to revert it", () => {
    const { cambiar } = pintar({ tramoSel: 1 });
    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Sin departamento");

    // A reload brought tramo 1 a department.
    cambiar({ tramoSel: 1, tramos: [tramo(1, "Olivos – Sucre", OLIVOS, SUCRE, POTOSI, 0), TRAMOS[1], TRAMOS[2]] });

    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Potosí");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

describe("a selection the loaded data does not hold yet", () => {

  it("shows the list for a tramo that is not loaded, and its view once the data has it", () => {
    const { cambiar } = pintar({ tramoSel: 99 });
    expect(screen.getByRole("heading", { name: "3 tramos" })).toBeInTheDocument();

    cambiar({ tramoSel: 99, tramos: [...TRAMOS, tramo(99, "Camargo – Norte", CAMARGO, NORTE, null, 0)] });

    expect(screen.getByRole("heading", { name: "Camargo – Norte" })).toBeInTheDocument();
  });
});

describe("what each permission adds", () => {
  it("lets whoever may edit a tramo change its cities, but not archive it", () => {
    pintar({ tramoSel: 1 }, { tramos: ["ver", "editar"] });

    expect(screen.getByRole("button", { name: "Ciudad" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Departamento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).not.toBeInTheDocument();
  });

  it("lets whoever may only archive a tramo archive it, with the department as text", () => {
    pintar({ tramoSel: 1 }, { tramos: ["ver", "archivar"] });

    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Departamento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ciudad" })).not.toBeInTheDocument();
  });

});
