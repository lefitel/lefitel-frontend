// When a new build is applied, and when it is deliberately not.
//
// This component decides the one thing task E4 left to the application: the
// *moment*. The policy is settled — a build nobody applies is a broken client
// after the deployment cut, so the update is not optional any more — and the
// literal way to get it (`registerType: "autoUpdate"`) reloads the page the
// instant a deploy lands, which throws away whatever somebody was typing.
//
// So the three assertions below are one rule seen from three sides: **not while
// they are working, yes as soon as they stop, and never on a navigation that
// happened before there was anything to apply.** The last one is not
// hypothetical bookkeeping — anchoring on the mount path instead of on the
// moment the update arrived is the obvious way to write this, and it applies the
// update on a screen change the person made ten minutes earlier, which is to say
// immediately, which is the behaviour being avoided.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";

/** Flipped by a test to say a new build is waiting; read on every render. */
let necesitaRefresco = false;
const actualizar = vi.fn();
const toastError = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [necesitaRefresco, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: actualizar,
  }),
}));
// The toast is not what this file is about, but it must not be what makes it
// pass either: a real one would render outside the router and confuse queries.
vi.mock("sonner", () => ({
  toast: Object.assign((...a: unknown[]) => { toastError(...a); return 1; }, { dismiss: vi.fn() }),
}));

const { UpdatePrompt } = await import("./UpdatePrompt");

beforeEach(() => {
  vi.clearAllMocks();
  necesitaRefresco = false;
});

/** The component, plus a way to change screen the way the application does. */
function Pantalla() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate("/app/postes")}>ir a postes</button>
      <button onClick={() => navigate("/app/eventos")}>ir a eventos</button>
      <UpdatePrompt />
    </>
  );
}

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/app/home"]}>
      <Pantalla />
    </MemoryRouter>,
  );

const cambiarDePantalla = async () => userEvent.click(screen.getByText("ir a postes"));
/**
 * A second destination, because "change screen" has to mean a different one.
 *
 * Navigating to the path already showing is not a screen change and must not
 * apply anything — the first version of the test below used the same button
 * twice and failed for that reason rather than for the one it was written about.
 */
const cambiarOtraVez = async () => userEvent.click(screen.getByText("ir a eventos"));

describe("when a new build gets applied", () => {
  it("does nothing at all while there is no new build", async () => {
    pintar();

    await cambiarDePantalla();

    expect(actualizar).not.toHaveBeenCalled();
  });

  it("does not reload the moment the build arrives", async () => {
    // The whole reason this is not `registerType: "autoUpdate"`. Somebody is
    // three fields into a pole form when a deploy lands; the build waits.
    const { rerender } = pintar();

    necesitaRefresco = true;
    rerender(
      <MemoryRouter initialEntries={["/app/home"]}>
        <Pantalla />
      </MemoryRouter>,
    );

    expect(actualizar, "recargó la página encima de lo que estaban escribiendo").not.toHaveBeenCalled();
  });

  it("applies it at the first screen change after it arrives", async () => {
    necesitaRefresco = true;
    pintar();

    await cambiarDePantalla();

    // `true` is what makes the waiting worker take over and the page reload;
    // called without it the update is registered and never applied, which looks
    // identical here unless the argument is read.
    expect(actualizar).toHaveBeenCalledWith(true);
  });

  it("ignores a screen change that happened before the build arrived", async () => {
    // The mistake this guards against is the natural way to write the component:
    // remember the path at mount, and apply when it differs. Somebody who
    // changed screen ten minutes ago then gets the reload the instant the deploy
    // lands — the abrupt behaviour, arrived at by accident.
    const { rerender } = pintar();
    await cambiarDePantalla();

    necesitaRefresco = true;
    rerender(
      <MemoryRouter initialEntries={["/app/home"]}>
        <Pantalla />
      </MemoryRouter>,
    );

    expect(actualizar, "usó una navegación anterior a la actualización").not.toHaveBeenCalled();

    // And the next one does apply it, so this is a delay and not a deadlock.
    await cambiarOtraVez();
    expect(actualizar).toHaveBeenCalledWith(true);
  });

  it("offers an immediate way out, and says what it costs", async () => {
    necesitaRefresco = true;
    pintar();

    expect(toastError).toHaveBeenCalled();
    const opciones = toastError.mock.calls[0][1] as {
      description: string;
      action: { label: string; onClick: () => void };
    };
    // The warning belongs to this path and only this one: the automatic
    // application cannot lose anything, and telling somebody it might would
    // teach them to distrust it.
    expect(opciones.description).toMatch(/se perderá/i);
    opciones.action.onClick();
    expect(actualizar).toHaveBeenCalledWith(true);
  });
});
