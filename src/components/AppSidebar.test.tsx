import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SesionContext, type contextProps } from "../context/SesionContext";
import { SidebarProvider } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { usuarioExample } from "../data/example";
import { AppSidebar } from "./AppSidebar";
import { markReleaseSeen, resetSeenRelease } from "../hooks/useSeenRelease";
import { olvidarPermisos, setPermisos, sinPermisos, type Modulo } from "../lib/permissions";

const sesion: contextProps = {
  sesion: {
    usuario: { ...usuarioExample, name: "Ada", lastname: "Lovelace", user: "ada", id_rol: 1 },
    autenticado: true,
  },
  setSesion: vi.fn(),
  loading: false,
  logout: vi.fn(),
};

function mount() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarProvider>
          <SesionContext.Provider value={sesion}>
            <AppSidebar />
          </SesionContext.Provider>
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
}

/**
 * The version has to be reachable from the app itself: told "no me funciona",
 * the first question is which build the person is actually running, and the
 * only one who can answer is them.
 */
describe("user menu", () => {
  it("shows the running version without leaving the menu", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));

    expect(await screen.findByText(__APP_VERSION__)).toBeInTheDocument();
  });

  it("is the sidebar's own button, so it folds to an icon with the rest", () => {
    // Drawn by hand it kept its padding when the menu folded: 16px left for a
    // 32px avatar, which spilled out along with the chevron. Nothing here lays
    // a page out, so what can be held is that it is the button that folds.
    mount();

    const trigger = screen.getByRole("button", { name: /Ada Lovelace/i });
    expect(trigger).toHaveAttribute("data-sidebar", "menu-button");
    expect(trigger).toHaveAttribute("data-size", "lg");
  });

  it("points at the release notes as a page, not a panel", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));

    // A real destination: linkable, and the back button works.
    expect(await screen.findByRole("menuitem", { name: /Novedades/i }))
      .toHaveAttribute("href", "/app/novedades");
  });
});

/**
 * The entry has to be there whether or not the browser is feeling helpful.
 * It used to appear only once `beforeinstallprompt` had fired, which meant it
 * was invisible under `npm run dev` — where no service worker runs and the
 * event never comes — and so could not be tested at all.
 */
describe("install entry", () => {
  const realUserAgent = Object.getOwnPropertyDescriptor(
    window.navigator.constructor.prototype,
    "userAgent"
  );

  afterEach(() => {
    if (realUserAgent) Object.defineProperty(navigator, "userAgent", realUserAgent);
  });

  function pretendPlatform(userAgent: string) {
    Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  }

  async function announceInstallable(prompt = vi.fn().mockResolvedValue(undefined)) {
    await act(async () => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
      window.dispatchEvent(event);
    });
    return prompt;
  }

  it("is there before any browser has offered anything", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));

    expect(await screen.findByRole("menuitem", { name: /Instalar aplicación/i })).toBeInTheDocument();
  });

  it("fires the browser's own prompt when there is one to fire", async () => {
    const user = userEvent.setup();
    mount();

    const prompt = await announceInstallable();
    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Instalar aplicación/i }));

    expect(prompt).toHaveBeenCalledTimes(1);
    // No panel: the browser is handling it.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains the manual route when there is no prompt, in the platform's own words", async () => {
    const user = userEvent.setup();
    pretendPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15");
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Instalar aplicación/i }));

    const panel = await screen.findByRole("dialog");
    expect(panel).toHaveTextContent(/Añadir a pantalla de inicio/i);
    expect(panel).toHaveTextContent(/Compartir/i);
  });

  it("gives Android its own menu path, not Safari's", async () => {
    const user = userEvent.setup();
    pretendPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120");
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Instalar aplicación/i }));

    const panel = await screen.findByRole("dialog");
    expect(panel).toHaveTextContent(/tres puntos/i);
    expect(panel).not.toHaveTextContent(/Safari/i);
  });
});

/**
 * Without this the release notes are a page nobody is ever told about: the
 * version number reads as metadata, and only somebody already curious opens
 * the menu to look.
 */
describe("unread release notes", () => {
  beforeEach(() => {
    resetSeenRelease();
  });

  it("marks the entry until the notes for this version have been opened", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    expect(await screen.findByText("(sin leer)")).toBeInTheDocument();
  });

  it("clears the mark once they have, without a reload", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    expect(await screen.findByText("(sin leer)")).toBeInTheDocument();

    // What the page itself does on arrival. The menu is already on screen, so
    // this also proves the two stay in step without remounting anything.
    await act(async () => {
      markReleaseSeen();
    });

    expect(screen.queryByText("(sin leer)")).toBeNull();
  });
});

/**
 * Ten screens in one flat list read as ten unrelated things. They are three
 * kinds of thing, and the menu says which.
 */
describe("the screens, block by block", () => {
  const ROL = 1;

  const allow = (...modulos: Modulo[]) => {
    const permisos = sinPermisos();
    for (const modulo of modulos) permisos[modulo].ver = true;
    setPermisos(ROL, permisos);
  };

  const screensUnder = (title: string) =>
    within(screen.getByRole("list", { name: title }))
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);

  afterEach(() => {
    olvidarPermisos();
  });

  it("puts each screen under the title it belongs to, in order", () => {
    allow(
      "postes", "eventos", "ciudades", "parametros", "reportes",
      "generador", "seguridad", "roles", "archivos", "bitacora",
    );
    mount();

    expect(screensUnder("Operación")).toEqual([
      ["Postes", "/app/postes"],
      ["Eventos", "/app/eventos"],
      ["Ciudades", "/app/ciudades"],
    ]);
    // Both make reports, so they share a block — and the ready-made ones are
    // not called «Reportes» again under a title that already says it.
    expect(screensUnder("Reportes")).toEqual([
      ["Informes", "/app/reportes"],
      ["Generador", "/app/generador"],
    ]);
    // Named for what is on the screen.
    expect(screensUnder("Administración")).toEqual([
      ["Usuarios", "/app/usuarios"],
      ["Roles y permisos", "/app/roles"],
      ["Bitácora", "/app/bitacora"],
      ["Parámetros", "/app/parametros"],
      ["Archivos", "/app/archivos"],
    ]);
  });

  it("offers scheduled reports only to somebody who may schedule, right after the generator", () => {
    // Reading the generator is not what makes scheduled reports yours to set
    // up: that is a permission of its own, and the menu asks for it.
    const permisos = sinPermisos();
    permisos.generador.ver = true;
    setPermisos(ROL, permisos);
    const { unmount } = mount();
    expect(screensUnder("Reportes")).toEqual([["Generador", "/app/generador"]]);
    unmount();

    permisos.generador.programar = true;
    setPermisos(ROL, permisos);
    mount();
    expect(screensUnder("Reportes")).toEqual([
      ["Generador", "/app/generador"],
      ["Envíos programados", "/app/envios"],
    ]);
  });

  it("keeps the home page above every block, under no title", () => {
    allow("postes");
    mount();

    const home = screen.getByRole("link", { name: "Inicio" });
    for (const title of ["Operación", "Reportes", "Administración"]) {
      const block = screen.queryByRole("list", { name: title });
      if (block) expect(block.contains(home)).toBe(false);
    }
    expect(
      home.compareDocumentPosition(screen.getByRole("link", { name: "Postes" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lets clicks through its titles once the menu is folded to icons", () => {
    // Folded, a title is pulled up over the block before it and made
    // transparent — still a box, still on top. It swallowed the clicks and the
    // tooltip of a strip of the icon above it. Nothing here lays a page out,
    // so what can be held is that the title steps aside when folded.
    allow("postes", "generador", "bitacora");
    mount();

    for (const title of ["Operación", "Reportes", "Administración"]) {
      expect(screen.getByText(title).className.split(/\s+/))
        .toContain("group-data-[collapsible=icon]:pointer-events-none");
    }
  });

  it("draws no title over a block this role can open nothing in", () => {
    allow("postes", "generador");
    mount();

    expect(screen.getByText("Operación")).toBeInTheDocument();
    expect(screensUnder("Reportes")).toEqual([["Generador", "/app/generador"]]);
    expect(screen.queryByText("Administración")).toBeNull();
    expect(screen.queryByRole("list", { name: "Administración" })).toBeNull();
  });
});
