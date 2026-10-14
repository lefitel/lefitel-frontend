import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SesionContext, type contextProps } from "../context/SesionContext";
import { ThemeProvider } from "../components/theme-provider";
import { TooltipProvider } from "../components/ui/tooltip";
import { usuarioExample } from "../data/example";
import { HeaderSlot } from "../components/HeaderSlot";
import { useTrailLabel } from "../components/TrailLabel";
import HomePage from "./HomePage";

const sesion: contextProps = {
  sesion: {
    usuario: { ...usuarioExample, name: "Ada", lastname: "Lovelace", user: "ada", id_rol: 1 },
    autenticado: true,
  },
  setSesion: vi.fn(),
  loading: false,
  logout: vi.fn(),
};

/** A screen as the list screens are now: no title row, its control hung in the header. */
const Pantalla = () => (
  <div>
    <HeaderSlot side="start">
      <button type="button">Volver de la pantalla</button>
    </HeaderSlot>
    <HeaderSlot>
      <button type="button">Control de la pantalla</button>
    </HeaderSlot>
    <p>Contenido de la pantalla</p>
  </div>
);

/** A sheet that knows what its record is called, once it has loaded it. */
let nombreDelRegistro: string | null = null;
const Ficha = () => {
  useTrailLabel(nombreDelRegistro);
  return <p>Ficha del registro</p>;
};

const arbol = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider defaultTheme="light" storageKey="home-page-test-theme">
        <TooltipProvider>
          <SesionContext.Provider value={sesion}>
            <Routes>
              <Route path="/app" element={<HomePage />}>
                <Route path="tramos/:id" element={<Ficha />} />
                <Route path="*" element={<Pantalla />} />
              </Route>
            </Routes>
          </SesionContext.Provider>
        </TooltipProvider>
      </ThemeProvider>
    </MemoryRouter>
);

const mountAt = (path: string) => render(arbol(path));

beforeEach(() => { nombreDelRegistro = null; });

/**
 * The header says where you are and nothing else. The trail wears the tab
 * skin: the page you are on is the raised pill, and the way up is a link.
 */
describe("header", () => {
  it("marks the current page and links the way up", () => {
    mountAt("/app/postes/12");

    const trail = within(screen.getByRole("navigation", { name: "Miga de pan" }));

    // A real link, not a button that navigates: it can be opened in a new tab.
    expect(trail.getByRole("link", { name: "Postes" })).toHaveAttribute("href", "/app/postes");
    const current = trail.getByText("Poste #12").closest("[aria-current]");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(trail.queryByRole("link", { name: "Poste #12" })).toBeNull();
  });

  it("is a single pill on a top-level screen", () => {
    mountAt("/app/postes");

    const trail = within(screen.getByRole("navigation", { name: "Miga de pan" }));

    expect(trail.getByText("Postes").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
    expect(trail.queryAllByRole("link")).toHaveLength(0);
  });

  it("stays on the same step for another view of the same screen", () => {
    // The archived tramos are not a record called "archivados" under Tramos.
    // They are the same step as the map, and the trail must not grow a crumb.
    mountAt("/app/tramos/archivados");

    const trail = within(screen.getByRole("navigation", { name: "Miga de pan" }));

    expect(trail.getByText("Tramos").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
    expect(trail.queryByText(/archivados/i)).toBeNull();
    expect(trail.queryAllByRole("link")).toHaveLength(0);
  });

  it("names a tramo's card as a step under Tramos, as it names a pole's sheet", () => {
    nombreDelRegistro = null;
    mountAt("/app/tramos/52");

    const trail = within(screen.getByRole("navigation", { name: "Miga de pan" }));

    expect(trail.getByRole("link", { name: "Tramos" })).toHaveAttribute("href", "/app/tramos");
    expect(trail.getByText("Tramo #52").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
  });

  // The address knows a record by its number. The screen knows its name.
  describe("when the open screen says what its record is called", () => {
    const miga = () => within(screen.getByRole("navigation", { name: "Miga de pan" }));

    it("shows that name as the trail's last step, in place of the number", async () => {
      nombreDelRegistro = "Camargo – Sucre";
      mountAt("/app/tramos/52");

      expect(await miga().findByText("Camargo – Sucre")).toBeInTheDocument();
      expect(miga().getByText("Camargo – Sucre").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
      expect(miga().queryByText("Tramo #52")).toBeNull();
      // The way up is untouched.
      expect(miga().getByRole("link", { name: "Tramos" })).toHaveAttribute("href", "/app/tramos");
    });

    it("shows the number until the screen has the name, and the name once it does", async () => {
      nombreDelRegistro = null;
      const vista = mountAt("/app/tramos/52");
      expect(miga().getByText("Tramo #52")).toBeInTheDocument();

      nombreDelRegistro = "Camargo – Sucre";
      vista.rerender(arbol("/app/tramos/52"));

      expect(await miga().findByText("Camargo – Sucre")).toBeInTheDocument();
    });

    it("does not carry the name over to the next screen", async () => {
      nombreDelRegistro = "Camargo – Sucre";
      const user = userEvent.setup();
      mountAt("/app/tramos/52");
      await miga().findByText("Camargo – Sucre");

      await user.click(miga().getByRole("link", { name: "Tramos" }));

      expect(miga().queryByText("Camargo – Sucre")).toBeNull();
      expect(miga().getByText("Tramos").closest("[aria-current]")).toHaveAttribute("aria-current", "page");
    });
  });

  it("carries no theme switch: that lives in the user menu", () => {
    mountAt("/app/home");

    const header = screen.getByRole("banner");

    // The sidebar trigger and whatever the open screen brings; nothing of the
    // shell's own besides.
    expect(within(header).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Toggle Sidebar",
      "Volver de la pantalla",
      "Control de la pantalla",
    ]);
  });

  it("puts the open screen's way back left of the trail, and its controls right of it", async () => {
    mountAt("/app/postes");

    const header = within(screen.getByRole("banner"));
    const volver = await header.findByRole("button", { name: "Volver de la pantalla" });
    const miga = header.getByRole("navigation", { name: "Miga de pan" });
    const control = header.getByRole("button", { name: "Control de la pantalla" });
    const lateral = header.getByRole("button", { name: "Toggle Sidebar" });

    const antes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    // Sidebar button, way back, trail, controls: in that order along the row.
    expect(antes(lateral, volver)).toBe(true);
    expect(antes(volver, miga)).toBe(true);
    expect(antes(miga, control)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Volver de la pantalla" })).toHaveLength(1);
  });

  it("does not let a way back make the trail give way on a phone: there it is the only way back", async () => {
    mountAt("/app/postes");

    const header = screen.getByRole("banner");
    const volver = await within(header).findByRole("button", { name: "Volver de la pantalla" });
    // The trail hides, below `sm`, when the slot marked `data-header-slot` has
    // something in it. The way back hangs in the other one.
    expect(volver.closest("[data-header-slot]")).toBeNull();
  });

  it("draws the open screen's controls, which the screen still owns", async () => {
    mountAt("/app/postes");

    // Up in the header, and not left behind in the page as well.
    const header = within(screen.getByRole("banner"));
    expect(await header.findByRole("button", { name: "Control de la pantalla" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Control de la pantalla" })).toHaveLength(1);
    expect(header.queryByText("Contenido de la pantalla")).toBeNull();
  });

  it("draws no rule between the trigger and the trail", () => {
    mountAt("/app");

    // Decorative, so it has no role to ask for; Radix marks it this way.
    expect(screen.getByRole("banner").querySelector('[data-orientation="vertical"]')).toBeNull();
  });
});

/**
 * On a phone the header is one row some 300px wide once the menu button is
 * taken off, and the trail does not shrink. With a screen's controls beside it
 * not even two tabs fit, and they scrolled sideways under a trail that already
 * said less than they did. So below `sm` the trail gives way whenever the open
 * screen hangs something up there, and stays when it hangs nothing — which is
 * the dashboard and every detail sheet, where it is also the way back.
 *
 * It is a stylesheet rule, and this environment applies no stylesheet: the
 * trail is always "there" here. What can be asserted is the rule's three
 * parts, each of which silently disables it if lost — the group the header
 * forms, the mark on the slot the rule looks for, and the rule on the trail.
 * That the class compiles to the CSS it reads as was checked against the
 * project's own Tailwind when it was written.
 */
describe("the header on a phone", () => {
  const partes = () => {
    const header = screen.getByRole("banner");
    const miga = within(header).getByRole("navigation", { name: "Miga de pan" });
    const hueco = header.querySelector("[data-header-slot]");
    return { miga, hueco, grupo: miga.parentElement };
  };

  it("hides the trail when the screen has hung controls, by a rule on the trail itself", () => {
    mountAt("/app/postes");
    const { miga, hueco, grupo } = partes();

    expect(hueco).not.toBeNull();
    expect(hueco?.parentElement).toBe(grupo);
    expect(grupo?.className.split(/\s+/)).toContain("group/header");
    expect(miga.className.split(/\s+/)).toContain("max-sm:group-has-[[data-header-slot]:not(:empty)]/header:hidden");
  });

  it("has nothing in the slot for the rule to find when the screen hangs nothing", () => {
    // `:empty` is literal: one stray text node and the trail would be hidden
    // on every screen. A page with no route under it draws no controls.
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <ThemeProvider defaultTheme="light" storageKey="home-page-test-theme">
          <TooltipProvider>
            <SesionContext.Provider value={sesion}>
              <Routes>
                <Route path="/app" element={<HomePage />}>
                  <Route index element={<p>Sin controles</p>} />
                </Route>
              </Routes>
            </SesionContext.Provider>
          </TooltipProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(partes().hueco?.childNodes).toHaveLength(0);
  });

  it("keeps the controls at the right edge, with the trail or without it", () => {
    // They were moved to the start of the row on a phone once, to fill the
    // place the trail left. A control that changes sides with the width of the
    // screen is harder to find than a gap is ugly.
    mountAt("/app/postes");

    const clases = partes().hueco?.className.split(/\s+/) ?? [];
    expect(clases).toContain("ml-auto");
    expect(clases.filter((c) => /(^|:)(ml-0|mr-auto|flex-1|justify-start)$/.test(c))).toEqual([]);
  });
});

/**
 * Mounted on its own — every screen's own test — there is no header to draw
 * into, and the controls must not vanish with it.
 */
describe("a screen outside the shell", () => {
  it("keeps its controls, where they are written", () => {
    render(<Pantalla />);

    expect(screen.getByRole("button", { name: "Control de la pantalla" })).toBeInTheDocument();
  });
});
