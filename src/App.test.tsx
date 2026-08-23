// The route gate no longer has a token string to compare against — the
// session lives in a cookie the app cannot read, so `sesion.autenticado` is
// the only signal left. The one failure this file exists to catch: if that
// boolean starts at `false` (it has to start at *something*) and `loading`
// does not mask it, the very first render sends every visitor to /login
// before the server ever answered.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PrivateRoutes, PublicRoutes } from "./App";
import { SesionContext, type contextProps } from "./context/SesionContext";
import { usuarioExample } from "./data/example";

const sesionCon = (autenticado: boolean): contextProps["sesion"] => ({
  usuario: usuarioExample,
  autenticado,
});

function renderPrivateGate(ctx: Partial<contextProps>, entry = "/app/home") {
  const value: contextProps = {
    sesion: sesionCon(false),
    setSesion: vi.fn(),
    loading: false,
    logout: vi.fn(),
    ...ctx,
  };
  return render(
    <SesionContext.Provider value={value}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<PrivateRoutes />}>
            <Route path="/app/home" element={<div>contenido-privado</div>} />
          </Route>
          <Route path="/login" element={<div>pantalla-login</div>} />
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

function renderPublicGate(ctx: Partial<contextProps>, entry = "/login") {
  const value: contextProps = {
    sesion: sesionCon(false),
    setSesion: vi.fn(),
    loading: false,
    logout: vi.fn(),
    ...ctx,
  };
  return render(
    <SesionContext.Provider value={value}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<PublicRoutes />}>
            <Route path="/login" element={<div>pantalla-login</div>} />
          </Route>
          <Route path="/app/home" element={<div>contenido-privado</div>} />
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

describe("PrivateRoutes", () => {
  it("shows the loading screen while checking, not the login redirect", () => {
    // `loading: true` with the freshly-initialized, not-yet-confirmed
    // `autenticado: false` — the exact state on every first render before
    // the startup check resolves. If `loading` did not win here, this would
    // render the login screen instead.
    renderPrivateGate({ sesion: sesionCon(false), loading: true });

    expect(screen.getByText("Verificando sesión...")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-login")).not.toBeInTheDocument();
    expect(screen.queryByText("contenido-privado")).not.toBeInTheDocument();
  });

  it("renders the private content once the server confirmed there is a session", () => {
    renderPrivateGate({ sesion: sesionCon(true), loading: false });

    expect(screen.getByText("contenido-privado")).toBeInTheDocument();
  });

  it("redirects to /login once checking is done and there is no session", () => {
    renderPrivateGate({ sesion: sesionCon(false), loading: false });

    expect(screen.getByText("pantalla-login")).toBeInTheDocument();
    expect(screen.queryByText("contenido-privado")).not.toBeInTheDocument();
  });
});

describe("PublicRoutes", () => {
  it("shows the loading screen while checking, not the login form", () => {
    renderPublicGate({ sesion: sesionCon(false), loading: true });

    expect(screen.getByText("Verificando sesión...")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-login")).not.toBeInTheDocument();
  });

  it("shows the login form when there is no confirmed session", () => {
    renderPublicGate({ sesion: sesionCon(false), loading: false });

    expect(screen.getByText("pantalla-login")).toBeInTheDocument();
  });

  it("redirects away from /login once the server confirmed there is a session", () => {
    renderPublicGate({ sesion: sesionCon(true), loading: false });

    expect(screen.getByText("contenido-privado")).toBeInTheDocument();
    expect(screen.queryByText("pantalla-login")).not.toBeInTheDocument();
  });
});
