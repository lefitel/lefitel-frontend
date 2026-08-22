import { Route, Routes, BrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { visibleMenuItems } from "./components/menuItems";
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
import BitacoraPage from "./pages/menu/bitacora";
import { TooltipProvider } from "./components/ui/tooltip";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import { Toaster } from "@/components/ui/sonner";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { ThemeProvider as ShadcnThemeProvider } from "@/components/theme-provider";

const PrivateRoutes = () => {
  const { sesion, loading } = useContext(SesionContext);
  const location = useLocation();

  if (loading) return <LoadingPage />;
  return sesion.token !== "" ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
};

const PublicRoutes = () => {
  const { sesion, loading } = useContext(SesionContext);

  if (loading) return <LoadingPage />;
  return sesion.token === "" ? <Outlet /> : <Navigate to="/app/home" replace />;
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
                  <Route path="home"      element={<InicioPage />} />
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
              </Route>

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
