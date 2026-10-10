// The author filter on the Bitácora screen, which is what task B2 was about.
//
// The screen filled that dropdown from `getUsuario()` — the staff directory,
// behind `seguridad:ver`. Every account that can open this screen today also
// holds that permission, so nothing was visibly broken; but the matrix editor
// can hand out `bitacora:ver` on its own, and the moment it does, the directory
// answers 403, the page swallowed it, and the filter offered "Todos" and nothing
// else. An empty dropdown and a refused one look identical, and the first one
// reads as "nobody has ever done anything here".
//
// So the two things asserted here are the two that were wrong: **which endpoint
// fills the list**, and **whether a failure is visible**. The first is checked
// against `Usuario.api` as well as `Bitacora.api` — a revert would go back to
// exactly that module, and asserting only that the new call happened would stay
// green with both of them firing.
//
// The archived marker is the third: those accounts are in the list on purpose
// now, because somebody reviewing old work is usually looking for a person who
// has left, and an unmarked one is indistinguishable from current staff.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import BitacoraPage from "./index";
import { SesionContext, type contextProps } from "../../../context/SesionContext";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../../../lib/permissions";

const getAutoresBitacora = vi.fn();
const getAllBitacora = vi.fn();
const getVocabularioBitacora = vi.fn();
const getUsuario = vi.fn();
const toastError = vi.fn();

vi.mock("../../../api/Bitacora.api", () => ({
  getAutoresBitacora: (...args: unknown[]) => getAutoresBitacora(...args),
  getAllBitacora: (...args: unknown[]) => getAllBitacora(...args),
  getVocabularioBitacora: (...args: unknown[]) => getVocabularioBitacora(...args),
}));
// Mocked and asserted-against rather than simply absent: this is the module the
// screen used to call, and the one a change would drift back to.
vi.mock("../../../api/Usuario.api", () => ({
  getUsuario: (...args: unknown[]) => getUsuario(...args),
}));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

/** Two live authors and one archived, as the endpoint serves them. */
const AUTORES = [
  { id: 4, name: "Ana", lastname: "Quispe", deletedAt: null },
  { id: 9, name: "Bruno", lastname: "Mamani", deletedAt: "2026-05-02T00:00:00.000Z" },
];

/** What the two filter menus offer, as the server sends it. */
const VOCABULARIO = {
  families: [
    { value: "crear", label: "Crear" },
    { value: "factor", label: "Segundo factor" },
  ],
  entities: [
    { value: "Poste", label: "Poste" },
    { value: "credencial_webauthn", label: "Llave de acceso" },
  ],
};

const ROL = 3;
const sesion = { sesion: { usuario: { id: 7, id_rol: ROL } } } as unknown as contextProps;

/** `bitacora:ver`, which is what opens this screen, plus whatever is named. */
const conPermisoDe = (...modulos: Modulo[]) => {
  const p = sinPermisos();
  for (const m of ["bitacora", ...modulos] as Modulo[]) p[m].ver = true;
  setPermisos(ROL, p);
};

beforeEach(() => {
  vi.clearAllMocks();
  olvidarPermisos();
  conPermisoDe();
  getAutoresBitacora.mockResolvedValue(AUTORES);
  getAllBitacora.mockResolvedValue({ data: [], total: 0 });
  getVocabularioBitacora.mockResolvedValue(VOCABULARIO);
});

/** Prints the address, so a test can see where a link took it. */
const Aqui = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="direccion">{pathname + search}</p>;
};

const pintar = (direccion = "/app/bitacora") => render(
  <SesionContext.Provider value={sesion}>
    <MemoryRouter initialEntries={[direccion]}>
      <Routes>
        <Route path="/app/bitacora" element={<><BitacoraPage /><Aqui /></>} />
        <Route path="*" element={<Aqui />} />
      </Routes>
    </MemoryRouter>
  </SesionContext.Provider>,
);

/**
 * Opens the author combobox, which renders its options only once open.
 *
 * Not found by the word "Usuario", which appears three times on this screen — as
 * this filter's label, as a column header, and as one of the thirteen entities
 * in the list beside it. And not by taking the first popover trigger either:
 * there are three, and the first two are the Desde and Hasta calendars. The one
 * wanted is the only one showing a selected value rather than a date, which is
 * "Todos" until somebody picks a person.
 */
const abrirFiltroDeUsuario = async () => {
  const disparador = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
    .find((b) => (b.textContent ?? "").includes("Todos"));
  expect(disparador, "no se encontró el desplegable de usuario").toBeTruthy();
  await userEvent.click(disparador as HTMLElement);
};

describe("the author filter", () => {
  it("is filled from the audit log, not from the staff directory", async () => {
    pintar();

    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    // The half that a "did the new call happen" assertion would miss: the old
    // one needs a permission this screen does not, and firing both would leave
    // the 403 exactly where it was.
    expect(getUsuario, "la pantalla volvió a pedir el directorio de personal")
      .not.toHaveBeenCalled();
  });

  it("marks an author whose account has been archived", async () => {
    pintar();
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());

    await abrirFiltroDeUsuario();

    // The live one plain, the archived one marked. Both asserted: a marker on
    // everybody would be as wrong as a marker on nobody, and only checking the
    // archived one would not notice.
    expect(await screen.findByText("Ana Quispe")).toBeInTheDocument();
    expect(await screen.findByText("Bruno Mamani (archivado)")).toBeInTheDocument();
  });

  it("filters by the author's id, not by anything else on the option", async () => {
    // The end of the chain the `AutorBitacora` type exists to protect, and the
    // half the assertions above cannot see: they read the label, and the label
    // is not what gets sent. An option built with `String(a.name)` — or with the
    // optional `id` of `UsuarioInterface`, which is the mistake that type was
    // written to prevent — renders exactly the same three lines and then sends
    // `Number("Ana")`, which is `NaN`, which the server answers with a 500.
    pintar();
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    await abrirFiltroDeUsuario();

    await userEvent.click(await screen.findByText("Ana Quispe"));

    await waitFor(() =>
      expect(getAllBitacora).toHaveBeenCalledWith(expect.objectContaining({ id_usuario: 4 })),
    );
  });

  it("says so when the list cannot be loaded", async () => {
    // The defect in one line. Without this the filter shows "Todos" and nothing
    // else — which is what a system where nobody has done anything looks like.
    getAutoresBitacora.mockRejectedValue({ response: { status: 403 } });

    pintar();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/usuarios/i);
  });

  it("stays quiet when what failed was the session", async () => {
    // A 401 means `SesionProvider` is already saying "Tu sesión se cerró" and
    // sending the person to the login screen. Both reads on this page fail at
    // once behind that, so without this the one real event produces three
    // messages, two of them naming the wrong problem. Silence here is not the
    // old silence: it is deferring to a better message that is already on
    // screen.
    getAutoresBitacora.mockRejectedValue({ response: { status: 401 } });
    getAllBitacora.mockRejectedValue({ response: { status: 401 } });

    pintar();

    // Waited for rather than asserted immediately: `expect(...).not` on a
    // promise nobody has awaited passes before the rejection is even delivered.
    await waitFor(() => expect(getAutoresBitacora).toHaveBeenCalled());
    await waitFor(() => expect(getAllBitacora).toHaveBeenCalled());
    expect(toastError, "avisó por encima del aviso de sesión cerrada").not.toHaveBeenCalled();
  });
});

describe("the table itself", () => {
  it("says so when the entries cannot be loaded, instead of showing an empty table", async () => {
    // Same class of silence, one component over: `setRows([])` on a failed read
    // renders exactly what an empty log renders.
    getAllBitacora.mockRejectedValue(new Error("red caída"));

    pintar();

    await waitFor(() =>
      expect(toastError.mock.calls.some((c) => /bitácora/i.test(String(c[0])))).toBe(true),
    );
  });
});

describe("what a row says", () => {
  // As the server sends them: the stored code, and beside it what it is called.
  const FILAS = [
    { id: 1, id_usuario: 7, action: "STEP_UP_DENIED", action_label: "Se le pidió confirmar su identidad", entity: "Sesion", entity_label: "Sesión", entity_id: null, detail: "Faltó confirmar la contraseña", severity: "info" },
    { id: 2, id_usuario: 7, action: "UPDATE_ROL", action_label: "Editó rol", entity: "Rol", entity_label: "Rol", entity_id: 7, detail: "Editó rol #7", severity: "warning" },
    { id: 3, id_usuario: 7, action: "UPDATE_POSTE", action_label: "Editó poste", entity: "Poste", entity_label: "Poste", entity_id: 12, detail: "Editó poste #12", severity: "info" },
    { id: 4, id_usuario: 7, action: "WEBAUTHN_DELETED", action_label: "Eliminó llave de acceso", entity: "credencial_webauthn", entity_label: "Llave de acceso", entity_id: 31, detail: "Eliminó una llave", severity: "warning" },
    { id: 5, id_usuario: 99, action: "CREATE_REPORTE_VISTA", action_label: "Nueva vista de informe", entity: "ReporteVista", entity_label: "Vista de informe", entity_id: 12, detail: "Guardó un reporte", severity: "info" },
  ];

  beforeEach(() => getAllBitacora.mockResolvedValue({ data: FILAS, total: FILAS.length }));

  it("names the action and the entity as the server does, not as they are stored", async () => {
    // The report that started this: `STEP_UP_DENIED` on screen, in capitals,
    // between "Editó rol" and "Inició sesión".
    pintar();

    expect(await screen.findByText("Se le pidió confirmar su identidad")).toBeInTheDocument();
    expect(screen.queryByText("STEP_UP_DENIED")).toBeNull();
    expect(screen.getByText("Sesión")).toBeInTheDocument();
    expect(screen.getByText("Llave de acceso #31")).toBeInTheDocument();
    expect(screen.queryByText(/credencial_webauthn/)).toBeNull();
  });

  it("keeps no table of its own: a code it has never heard of is named by the server all the same", async () => {
    // The point of moving the names. A code added on the server tomorrow needs
    // nothing from this repository.
    getAllBitacora.mockResolvedValue({
      total: 1,
      data: [{ id: 9, id_usuario: 7, action: "ALGO_DE_MAÑANA", action_label: "Hizo algo nuevo", entity: "Cosa", entity_label: "Cosa nueva", entity_id: 2, detail: "…" }],
    });
    pintar();

    expect(await screen.findByText("Hizo algo nuevo")).toBeInTheDocument();
    expect(screen.getByText("Cosa nueva #2")).toBeInTheDocument();
  });

  it("draws the entity as a link only for a role that may open it", async () => {
    // With `bitacora` alone every entity is plain text. It used to be a link
    // for anyone, and the route put the person somewhere else without a word.
    pintar();
    await screen.findByText("Poste #12");

    expect(screen.queryByRole("button", { name: "Poste #12" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rol #7" })).toBeNull();
  });

  it("links a pole to its sheet and a role to its form, each on its own permission", async () => {
    conPermisoDe("postes");
    pintar();

    expect(await screen.findByRole("button", { name: "Poste #12" })).toBeInTheDocument();
    // `postes` opens poles. It does not open roles.
    expect(screen.queryByRole("button", { name: "Rol #7" })).toBeNull();
    // Nothing to open for a key, whatever the role holds.
    expect(screen.queryByRole("button", { name: "Llave de acceso #31" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Poste #12" }));
    expect(await screen.findByTestId("direccion")).toHaveTextContent("/app/postes/12");
  });

  it("takes a role's link to that role, not to the list", async () => {
    conPermisoDe("roles");
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Rol #7" }));
    expect(await screen.findByTestId("direccion")).toHaveTextContent("/app/roles?rol=7");
  });

  it("takes somebody else's saved report to the Generador, not to the report", async () => {
    // Asking for it would be refused, and written down as an attempt by
    // whoever was only reading the log.
    conPermisoDe("generador");
    pintar();

    await userEvent.click(await screen.findByRole("button", { name: "Vista de informe #12" }));
    expect(await screen.findByTestId("direccion")).toHaveTextContent(/^\/app\/generador$/);
  });
});

describe("the two menus", () => {
  it("offer what the server says exists, and filter by the family's value", async () => {
    pintar();
    await waitFor(() => expect(getVocabularioBitacora).toHaveBeenCalled());

    const disparador = Array.from(document.querySelectorAll("button"))
      .filter((b) => (b.textContent ?? "").trim() === "Todas")[1];
    expect(disparador, "no se encontró el desplegable de acción").toBeTruthy();
    await userEvent.click(disparador);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Segundo factor" }));

    await waitFor(() =>
      expect(getAllBitacora).toHaveBeenCalledWith(expect.objectContaining({ family: "factor" })),
    );
    // The family, and nothing guessed from it: prefixes were how this worked
    // while the screen kept its own table.
    expect(getAllBitacora.mock.calls.at(-1)?.[0]).not.toHaveProperty("action");
  });

  it("say so when their options cannot be loaded", async () => {
    getVocabularioBitacora.mockRejectedValue({ response: { status: 500 } });

    pintar();

    await waitFor(() =>
      expect(toastError.mock.calls.some((c) => /filtros/i.test(String(c[0])))).toBe(true),
    );
  });
});

describe("filters and page, which have to survive a trip through a link", () => {
  // Every link out of this screen is a push. State kept only in the component
  // was gone on the way back: three pages into one person's week, press
  // «Rol #7», look, press Back — and the log was at its defaults again.

  it("leaves a plain address plain", async () => {
    pintar();
    await waitFor(() => expect(getAllBitacora).toHaveBeenCalled());

    expect(screen.getByTestId("direccion")).toHaveTextContent(/^\/app\/bitacora$/);
  });

  it("writes a chosen filter into the address", async () => {
    pintar();
    await waitFor(() => expect(getVocabularioBitacora).toHaveBeenCalled());

    const disparador = Array.from(document.querySelectorAll("button"))
      .filter((b) => (b.textContent ?? "").trim() === "Todas")[1];
    await userEvent.click(disparador);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Segundo factor" }));

    await waitFor(() =>
      expect(screen.getByTestId("direccion")).toHaveTextContent("/app/bitacora?accion=factor"),
    );
  });

  it("starts from what the address says: filters, dates and page", async () => {
    pintar("/app/bitacora?desde=2026-09-01&hasta=2026-09-05&entidad=Poste&accion=factor&severidad=warning&usuario=4&pagina=3");

    await waitFor(() => expect(getAllBitacora).toHaveBeenCalled());
    const pedido = getAllBitacora.mock.calls[0][0] as Record<string, unknown>;

    expect(pedido).toMatchObject({
      page: 3, entity: "Poste", family: "factor", severity: "warning", id_usuario: 4,
    });
    // The days asked for, whole: from the first minute of one to the last of
    // the other, in the reader's own time.
    expect(new Date(String(pedido.from)).getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
    expect(new Date(String(pedido.to)).getTime()).toBe(new Date(2026, 8, 5, 23, 59, 59, 0).getTime());
    // And the address is left as it came.
    expect(screen.getByTestId("direccion")).toHaveTextContent(/pagina=3/);
    expect(await screen.findByText(/Página 3 de/)).toBeInTheDocument();
  });

  it("goes back to the first page when a filter changes", async () => {
    getAllBitacora.mockResolvedValue({ data: [], total: 500 });
    pintar("/app/bitacora?pagina=3");
    await waitFor(() => expect(getAllBitacora).toHaveBeenCalledWith(expect.objectContaining({ page: 3 })));

    const disparador = Array.from(document.querySelectorAll("button"))
      .filter((b) => (b.textContent ?? "").trim() === "Todas")[1];
    await userEvent.click(disparador);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Segundo factor" }));

    await waitFor(() =>
      expect(getAllBitacora).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, family: "factor" })),
    );
    await waitFor(() =>
      expect(screen.getByTestId("direccion")).toHaveTextContent(/^\/app\/bitacora\?accion=factor$/),
    );
  });

  it("ignores an address that makes no sense, instead of asking the server for it", async () => {
    pintar("/app/bitacora?desde=ayer&pagina=-4&porPagina=abc");

    await waitFor(() => expect(getAllBitacora).toHaveBeenCalled());
    const pedido = getAllBitacora.mock.calls[0][0] as Record<string, unknown>;

    expect(pedido.page).toBe(1);
    expect(pedido.limit).toBe(50);
    expect(Number.isNaN(new Date(String(pedido.from)).getTime())).toBe(false);
  });
});
