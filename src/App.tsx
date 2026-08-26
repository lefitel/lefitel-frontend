import { Route, Routes, BrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { firstModuleScreen, visibleMenuItems } from "./components/menuItems";
import { can, type Modulo } from "./lib/permissions";
import LoadingPage from "./pages/LoadingPage";
import { SesionContext } from "./context/SesionContext";
import { SesionProvider } from "./context/SesionProvider";
import { useContext } from "react";
import InicioPage from "./pages/menu/inicio";
import PostePage from "./pages/menu/poste";
import PosteDetallePage from "./pages/menu/poste/PosteDetalle";
import CiudadesPage from "./pages/menu/ciudad/CiudadesPage";
import CiudadDetallePage from "./pages/menu/ciudad/CiudadDetallePage";
import EventoPage from "./pages/menu/evento";
import EventoDetallePage from "./pages/menu/evento/EventoDetallePage";
import ParametrosPage from "./pages/menu/parametros";
import ReportePage from "./pages/menu/reportes";
import GeneradorPage from "./pages/menu/generador";
import SeguridadPage from "./pages/menu/SeguridadPage";
import UsuarioDetallePage from "./pages/menu/usuario/UsuarioDetallePage";
import FilesPage from "./pages/menu/FilesPage";
import PerfilPage from "./pages/menu/PerfilPage";
import NovedadesPage from "./pages/menu/NovedadesPage";
import SinAccesoPage from "./pages/menu/SinAccesoPage";
import BitacoraPage from "./pages/menu/bitacora";
import { TooltipProvider } from "./components/ui/tooltip";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { Toaster } from "@/components/ui/sonner";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { ThemeProvider as ShadcnThemeProvider } from "@/components/theme-provider";

export const PrivateRoutes = () => {
  const { sesion, loading } = useContext(SesionContext);
  const location = useLocation();

  if (loading) return <LoadingPage />;
  return sesion.autenticado ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
};

export const PublicRoutes = () => {
  const { sesion, loading } = useContext(SesionContext);

  if (loading) return <LoadingPage />;
  return sesion.autenticado ? <Navigate to="/app/home" replace /> : <Outlet />;
};

/**
 * Who may open a screen, asked of the same matrix that draws the menu.
 *
 * This used to be a list of role numbers written here by hand while the sidebar
 * already asked the matrix, so the two disagreed in both directions. Untick
 * `generador.ver` for a role and the menu entry vanished while the URL still
 * worked — the page mounted, the catalogue came back 403, and the screen
 * offered a "Reintentar" button for a refusal that was permanent. Create a
 * fourth role from Seguridad and grant it anything, and every route redirected
 * it to a route that redirected it back: sidebar drawn, content area blank,
 * no error, nothing to click.
 */
const ModuleRoute = ({ modulo }: { modulo: Modulo }) => {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  if (!can(rol, modulo, "ver")) {
    // Somewhere they can actually be. `/app/home` belongs to no module and is
    // open to any session, so this always lands.
    const fallback = visibleMenuItems(rol)[0]?.path ?? "/app/home";
    return <Navigate to={fallback} replace />;
  }
  return <Outlet />;
};

/**
 * What `/app/home` shows, which is not always the dashboard any more.
 *
 * This route belongs to no module and is where every redirect in `ModuleRoute`
 * below lands, so it has to be somewhere every session can be. That used to be
 * free: the dashboard's endpoint asked for no permission and handed its data to
 * anybody with a session, which was the hole that got it gated on `eventos.ver`.
 *
 * Gating it turned this route into the dead end the comment above describes,
 * one step further along: the redirect lands, the page mounts, the request comes
 * back 403, and the screen reports a network failure for a refusal that is
 * permanent. Three outcomes, and they are not the same conversation:
 *
 *   - may see incidents → the dashboard, as before;
 *   - may see something else → go there, rather than sit on a screen that
 *     cannot load while the sidebar lists screens that can;
 *   - may see nothing → say so, and say who to ask.
 *
 * Decided from the permission matrix the session already carries, not from a
 * 403: the answer is known before the request, and asking anyway would mean a
 * wasted round trip and a spinner before the bad news.
 */
export const HomeRoute = () => {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  if (can(rol, "eventos", "ver")) return <InicioPage />;
  const elsewhere = firstModuleScreen(rol);
  if (elsewhere) return <Navigate to={elsewhere.path} replace />;
  return <SinAccesoPage />;
};

const App = () => {
  return (
    <SesionProvider>
      <ShadcnThemeProvider defaultTheme="light" storageKey="osefi-theme">
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />

              <Route element={<PrivateRoutes />}>
                <Route path="/app" element={<HomePage />}>
                  <Route index element={<Navigate to="/app/home" replace />} />

                  {/* Belongs to no module: anyone with a session. Their own
                      profile is theirs, the home page is where every redirect
                      lands, and the release notes are the same for everyone. */}
                  <Route path="home"      element={<HomeRoute />} />
                  <Route path="perfil"    element={<PerfilPage />} />
                  <Route path="novedades" element={<NovedadesPage />} />

                  <Route element={<ModuleRoute modulo="postes" />}>
                    <Route path="postes"        element={<PostePage />} />
                    <Route path="postes/:id"    element={<PosteDetallePage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="ciudades" />}>
                    <Route path="ciudades"      element={<CiudadesPage />} />
                    <Route path="ciudades/:id"  element={<CiudadDetallePageKeyed />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="eventos" />}>
                    <Route path="eventos"       element={<EventoPage />} />
                    <Route path="eventos/:id"   element={<EventoDetallePage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="reportes" />}>
                    <Route path="reportes"      element={<ReportePage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="generador" />}>
                    <Route path="generador"     element={<GeneradorPage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="parametros" />}>
                    <Route path="parametros"    element={<ParametrosPage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="seguridad" />}>
                    <Route path="seguridad"     element={<SeguridadPage />} />
                    <Route path="seguridad/:id" element={<UsuarioDetallePageKeyed />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="archivos" />}>
                    <Route path="archivos"      element={<FilesPage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="bitacora" />}>
                    <Route path="bitacora"      element={<BitacoraPage />} />
                  </Route>
                </Route>
              </Route>

              <Route element={<PublicRoutes />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/olvide-contrasena" element={<ForgotPasswordPage />} />
              </Route>

              {/* Deliberately NOT inside `PublicRoutes`, unlike the two above.
                  `PublicRoutes` sends anyone holding a session to /app/home,
                  and this is the one screen where that is wrong: the person
                  arrives from an email link with a single-use token in the URL
                  fragment, and `Navigate` discards fragments. A stale session
                  in this browser — or simply being logged in on the machine
                  where the mail was opened, which is the ordinary case — would
                  swallow the token and land them on the home page with nothing
                  said. The reset itself revokes every session for that account
                  anyway, so having one open changes nothing about what happens
                  here.

                  `/olvide-contrasena` stays behind the guard on purpose:
                  somebody with a live session can change their password from
                  their own profile, so sending them there costs nothing. */}
              <Route path="/nueva-contrasena" element={<ResetPasswordPage />} />

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
          <UpdatePrompt />
        </TooltipProvider>
      </ShadcnThemeProvider>
    </SesionProvider>
  );
};

export default App;

function CiudadDetallePageKeyed() {
  const { id } = useParams<{ id: string }>();
  return <CiudadDetallePage key={id} />;
}

function UsuarioDetallePageKeyed() {
  const { id } = useParams<{ id: string }>();
  return <UsuarioDetallePage key={id} />;
}
