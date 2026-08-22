import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SesionContext, type contextProps } from "../context/SesionContext";
import { SidebarProvider } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";
import { usuarioExample } from "../data/example";
import { AppSidebar } from "./AppSidebar";
import { markReleaseSeen, resetSeenRelease } from "../hooks/useSeenRelease";

const sesion: contextProps = {
  sesion: {
    usuario: { ...usuarioExample, name: "Ada", lastname: "Lovelace", user: "ada", id_rol: 1 },
    token: "t",
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
