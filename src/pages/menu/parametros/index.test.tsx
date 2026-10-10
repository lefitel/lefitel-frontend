// The Parámetros page and the address — `?tab=material&id=5`, which is how the
// Bitácora links to a catalogue entry.
//
// `useRegistroEnlazado.test.ts` holds the search through the lists. This holds
// what joins it to the screen, which had no test at all and is where a wrong
// wire would do its damage unseen: which section is handed the request, that
// "look among the archived" really flips the switch the section reads, and that
// the request leaves the address — when it is answered, and when the person
// walks away from it.
//
// The five sections are replaced by a stand-in that shows what it was handed
// and offers the three calls a real one makes. The real ones load five
// catalogues each; none of that is what is being asked here.

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import ParametrosPage from "./index";
import type { RegistroEnlazado } from "./useRegistroEnlazado";

const seccion = vi.hoisted(() => (nombre: string) => ({
  default: ({ innerTab, enlace }: { innerTab: string; enlace?: RegistroEnlazado }) => (
    <section aria-label={nombre}>
      <p>pestaña interior: {innerTab}</p>
      <p>registro pedido: {enlace ? enlace.id : "ninguno"}</p>
      {enlace && (
        <>
          <button type="button" onClick={enlace.verArchivados}>buscar en archivados</button>
          <button type="button" onClick={enlace.verActivos}>volver a activos</button>
          <button type="button" onClick={enlace.atendido}>atender</button>
        </>
      )}
    </section>
  ),
}));

vi.mock("./MaterialSec", () => seccion("material"));
vi.mock("./PropiedadSec", () => seccion("propietario"));
vi.mock("./AdssSec", () => seccion("adss"));
vi.mock("./TipoObsSec", () => seccion("tipoobs"));
vi.mock("./ObsSec", () => seccion("obs"));

const Direccion = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="direccion">{pathname + search}</p>;
};

const pintar = (direccion: string) => {
  render(
    <MemoryRouter initialEntries={[direccion]}>
      <ParametrosPage />
      <Direccion />
    </MemoryRouter>,
  );
  return userEvent.setup();
};

const direccion = () => screen.getByTestId("direccion").textContent;
/** The one section on screen: the inactive tabs are not mounted. */
const montada = () => {
  const secciones = screen.getAllByRole("region");
  expect(secciones).toHaveLength(1);
  return secciones[0];
};

describe("arriving with a record in the address", () => {
  it("shows the tab it names and hands the record to that section", () => {
    pintar("/app/parametros?tab=adss&id=3");

    expect(montada()).toHaveAccessibleName("adss");
    expect(within(montada()).getByText("registro pedido: 3")).toBeInTheDocument();
    expect(within(montada()).getByText("pestaña interior: activos")).toBeInTheDocument();
  });

  it("starts on the first tab, with nothing asked, when the address is plain", () => {
    pintar("/app/parametros");

    expect(montada()).toHaveAccessibleName("material");
    expect(within(montada()).getByText("registro pedido: ninguno")).toBeInTheDocument();
    expect(direccion()).toBe("/app/parametros");
  });

  it("ignores a tab that does not exist, and a record that is not a number", () => {
    pintar("/app/parametros?tab=inventada&id=3");
    expect(montada()).toHaveAccessibleName("material");
    expect(within(montada()).getByText("registro pedido: ninguno")).toBeInTheDocument();
  });

  it("switches to the archived list when the section asks, and back", async () => {
    // The section cannot look among the archived by itself: the switch is the
    // page's. This is the wire between the two.
    const user = pintar("/app/parametros?tab=material&id=5");

    await user.click(screen.getByRole("button", { name: "buscar en archivados" }));
    expect(within(montada()).getByText("pestaña interior: archivados")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "volver a activos" }));
    expect(within(montada()).getByText("pestaña interior: activos")).toBeInTheDocument();
  });
});

describe("what is left in the address", () => {
  it("nothing, once the section has answered — and the section stops being asked", async () => {
    const user = pintar("/app/parametros?tab=material&id=5");

    await user.click(screen.getByRole("button", { name: "atender" }));

    await waitFor(() => expect(direccion()).toBe("/app/parametros"));
    expect(within(montada()).getByText("registro pedido: ninguno")).toBeInTheDocument();
    // The tab the link chose stays chosen.
    expect(montada()).toHaveAccessibleName("material");
  });

  it("nothing, when the person changes tab before it was answered", async () => {
    // A request still waiting — its list slow, or failed — used to stay in the
    // address and fire on the way back to this tab, or after a reload from
    // another one.
    const user = pintar("/app/parametros?tab=material&id=5");

    await user.click(screen.getByRole("tab", { name: "ADSS" }));

    // The outgoing panel stays for a moment while the tabs change over.
    await waitFor(() => expect(montada()).toHaveAccessibleName("adss"));
    await waitFor(() => expect(direccion()).toBe("/app/parametros"));

    await user.click(screen.getByRole("tab", { name: "Materiales" }));
    await waitFor(() => expect(montada()).toHaveAccessibleName("material"));
    expect(within(montada()).getByText("registro pedido: ninguno")).toBeInTheDocument();
  });

  it("nothing, when it named a tab and no record", async () => {
    pintar("/app/parametros?tab=obs");

    expect(montada()).toHaveAccessibleName("obs");
    expect(await screen.findByText("/app/parametros")).toBeInTheDocument();
  });

  it("nothing, when it named a record and no tab it could belong to", async () => {
    pintar("/app/parametros?id=5");

    expect(await screen.findByText("/app/parametros")).toBeInTheDocument();
    expect(within(montada()).getByText("registro pedido: ninguno")).toBeInTheDocument();
  });
});
