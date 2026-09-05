// Where `/app/home` sends each role.
//
// This route belongs to no module and is where every redirect in `ModuleRoute`
// lands, so it has to be somewhere any session can be. That was free while the
// dashboard's endpoint asked for no permission — which was the hole that got it
// gated on `eventos.ver`. Gating it made this route a dead end for anybody
// without that permission: the redirect lands, the page mounts, the request
// comes back 403, and the dashboard reports "no hay conexión con el servidor"
// for a refusal that is permanent and has nothing to do with the network.
//
// A role created from Seguridad starts with all thirty-two cells denied, so the
// third case below is not exotic: it is what every new role sees before anybody
// grants it anything.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SesionContext, type contextProps } from "./context/SesionContext";
import type { SesionInterface } from "./interfaces/interfaces";
import { setPermisos, olvidarPermisos, sinPermisos, type Permisos, type Modulo } from "./lib/permissions";
import { HomeRoute } from "./App";

// The real dashboard drags in MapLibre, Recharts and a network call. What is
// under test is the decision in front of it, so a marker is enough — and it
// also makes "did it render the dashboard" a positive assertion rather than an
// absence.
vi.mock("./pages/menu/inicio", () => ({ default: () => <div>PANEL</div> }));
vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

const ROL = 9;

const sesion = { usuario: { id: 7, id_rol: ROL, user: "jlopez", name: "Juana", lastname: "López" }, autenticado: true } as unknown as SesionInterface;

/** A matrix with `ver` granted on exactly the modules named, and nothing else. */
function matrizCon(...modulos: Modulo[]): Permisos {
  const p = sinPermisos();
  for (const m of modulos) p[m].ver = true;
  return p;
}

function renderAt() {
  return render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <MemoryRouter initialEntries={["/app/home"]}>
        <Routes>
          <Route path="/app/home" element={<HomeRoute />} />
          <Route path="/app/postes" element={<div>PANTALLA DE POSTES</div>} />
          <Route path="/app/reportes" element={<div>PANTALLA DE REPORTES</div>} />
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

beforeEach(() => { olvidarPermisos(); vi.clearAllMocks(); });

/** Same session, `onboarding`: no factor registered, the grace period is over. */
const sesionOnboarding = { ...sesion, estado: "onboarding" } as unknown as SesionInterface;

function renderOnboardingAt() {
  return render(
    <SesionContext.Provider value={{ sesion: sesionOnboarding } as unknown as contextProps}>
      <MemoryRouter initialEntries={["/app/home"]}>
        <Routes>
          <Route path="/app/home" element={<HomeRoute />} />
          <Route path="/app/segundo-factor" element={<div>PANTALLA DE SEGUNDO FACTOR</div>} />
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

describe("HomeRoute", () => {
  it("shows the dashboard to a role that may see incidents", () => {
    setPermisos(ROL, matrizCon("eventos", "postes"));

    renderAt();

    expect(screen.getByText("PANEL")).toBeInTheDocument();
  });

  it("sends a role that may not see incidents to a screen it can open", () => {
    setPermisos(ROL, matrizCon("postes", "reportes"));

    renderAt();

    // Postes comes before Reportes in the menu, so that is the one it lands on:
    // the first screen with real content, in the order the sidebar lists them.
    expect(screen.getByText("PANTALLA DE POSTES")).toBeInTheDocument();
    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });

  it("tells a role with nothing granted that it has no access, and who to ask", () => {
    setPermisos(ROL, sinPermisos());

    renderAt();

    expect(screen.getByRole("heading", { name: /no tiene acceso/i })).toBeInTheDocument();
    expect(screen.getByText(/administrador/i)).toBeInTheDocument();
  });

  it("does not blame the network for a permissions problem", () => {
    // The regression this whole route exists to prevent. Before it, an account
    // with nothing granted read "No hay conexión con el servidor" and went to
    // find whoever maintains the servers.
    setPermisos(ROL, sinPermisos());

    renderAt();

    // Asserted against the dashboard's own two strings rather than the word
    // "conexión": the no-access copy names the connection on purpose, to rule
    // it out — "no es un fallo del sistema ni de tu conexión" — and a test that
    // banned the word would forbid the sentence that does the work.
    expect(screen.queryByText(/no se pudieron cargar los datos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay conexión con el servidor/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /volver a intentar/i })).not.toBeInTheDocument();
  });

  it("names the account, because the person looking cannot open a screen that would", () => {
    setPermisos(ROL, sinPermisos());

    renderAt();

    expect(screen.getByText("jlopez")).toBeInTheDocument();
  });

  it("treats a session the server has not answered for yet as having nothing", () => {
    // `can()` answers no for a role it holds nothing about, which is the state
    // between opening the app and the matrix arriving. Landing on the no-access
    // screen for a moment is wrong; but it is a great deal less wrong than
    // rendering a dashboard that then 403s, and the provider only routes here
    // once `loading` is false.
    renderAt();

    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });

  // Hallazgo A11 (plan 4B, Task 22). Before this, `onboarding` fell into
  // exactly the same "nothing granted" shape the test above covers —
  // `permisos` is withheld from that state on purpose — and landed on
  // `SinAccesoPage`, which tells a real, correctly-logged-in person to go
  // find an administrator who cannot fix what is actually wrong.
  it("sends an onboarding session to configure its factor, not to the access wall", () => {
    setPermisos(ROL, sinPermisos());

    renderOnboardingAt();

    expect(screen.getByText("PANTALLA DE SEGUNDO FACTOR")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /no tiene acceso/i })).not.toBeInTheDocument();
    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });

  it("says what happened and what to do, rather than redirecting in silence", () => {
    renderOnboardingAt();

    expect(toast.warning).toHaveBeenCalledTimes(1);
    const [mensaje] = vi.mocked(toast.warning).mock.calls[0];
    expect(mensaje).toMatch(/segundo factor/i);
    // "Qué hay que hacer", no solo "qué pasó": una fecha vencida sin una
    // instrucción es la misma frase inútil que este arreglo existe para
    // reemplazar.
    expect(mensaje).toMatch(/configura/i);
  });

  it("checks eventos.ver before onboarding would even matter — onboarding never even gets asked", () => {
    // `estadoInicialDeSesion`, server-side: an account with any factor opens
    // `parcial`, never `onboarding` — so `onboarding` implies no factor at
    // all, which the permission matrix has nothing to say about. This pins
    // that the redirect happens whether or not `permisos` was ever set,
    // rather than depending on `can()` failing to notice a real grant.
    setPermisos(ROL, matrizCon("eventos", "postes"));

    renderOnboardingAt();

    expect(screen.getByText("PANTALLA DE SEGUNDO FACTOR")).toBeInTheDocument();
    expect(screen.queryByText("PANEL")).not.toBeInTheDocument();
  });
});
