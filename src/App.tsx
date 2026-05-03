import { Route, Routes, BrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { MENU_ITEMS } from "./components/menuItems";
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
import SeguridadPage from "./pages/menu/SeguridadPage";
import UsuarioDetallePage from "./pages/menu/usuario/UsuarioDetallePage";
import FilesPage from "./pages/menu/FilesPage";
import PerfilPage from "./pages/menu/PerfilPage";
import BitacoraPage from "./pages/menu/bitacora";
import { TooltipProvider } from "./components/ui/tooltip";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import { Toaster } from "@/components/ui/sonner";
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

const RoleRoute = ({ roles }: { roles: number[] }) => {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  if (!roles.includes(rol)) {
    const fallback = MENU_ITEMS.find((item) => item.roles.includes(rol))?.path ?? "/app/home";
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

                  {/* Roles 1, 2, 3 */}
                  <Route element={<RoleRoute roles={[1, 2, 3]} />}>
                    <Route path="home"          element={<InicioPage />} />
                    <Route path="postes"         element={<PostePage />} />
                    <Route path="postes/:id"     element={<PosteDetallePage />} />
                    <Route path="ciudades"        element={<CiudadesPage />} />
                    <Route path="ciudades/:id"   element={<CiudadDetallePageKeyed />} />
                    <Route path="eventos"         element={<EventoPage />} />
                    <Route path="eventos/:id"    element={<EventoDetallePage />} />
                    <Route path="reportes"        element={<ReportePage />} />
                    <Route path="perfil"          element={<PerfilPage />} />
                  </Route>

                  {/* Roles 1, 2 */}
                  <Route element={<RoleRoute roles={[1, 2]} />}>
                    <Route path="parametros" element={<ParametrosPage />} />
                  </Route>

                  {/* Rol 1 únicamente */}
                  <Route element={<RoleRoute roles={[1]} />}>
                    <Route path="seguridad"      element={<SeguridadPage />} />
                    <Route path="seguridad/:id"  element={<UsuarioDetallePageKeyed />} />
                    <Route path="archivos"        element={<FilesPage />} />
                    <Route path="bitacora"        element={<BitacoraPage />} />
                  </Route>
                </Route>
              </Route>

              <Route element={<PublicRoutes />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton theme="system" />
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
