import { Route, Routes, BrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import LandingPage from "./pages/LandingPage";
import { firstModuleScreen, visibleMenuItems } from "./components/menuItems";
import { can, type Modulo } from "./lib/permissions";
import LoadingPage from "./pages/LoadingPage";
import { SesionContext } from "./context/SesionContext";
import { SesionProvider } from "./context/SesionProvider";
import { useContext, useEffect } from "react";
import InicioPage from "./pages/menu/inicio";
import RolesPage from "./pages/menu/RolesPage";
import PostePage from "./pages/menu/poste";
import PosteDetallePage from "./pages/menu/poste/PosteDetalle";
import CiudadesPage from "./pages/menu/ciudad/CiudadesPage";
import CiudadDetallePage from "./pages/menu/ciudad/CiudadDetallePage";
import EventoPage from "./pages/menu/evento";
import EventoDetallePage from "./pages/menu/evento/EventoDetallePage";
import ParametrosPage from "./pages/menu/parametros";
import ReportePage from "./pages/menu/reportes";
import GeneradorPage from "./pages/menu/generador";
import EnviosProgramadosPage from "./pages/menu/envios/EnviosProgramadosPage";
import SeguridadPage from "./pages/menu/SeguridadPage";
import UsuarioDetallePage from "./pages/menu/usuario/UsuarioDetallePage";
import FilesPage from "./pages/menu/FilesPage";
import PerfilPage from "./pages/menu/perfil/PerfilPage";
// Aliased: this app has two different screens both named `SegundoFactorPage`
// today — this one configures a factor from inside the shell (Tasks 19/20,
// somebody else's in this same plan), `./pages/login/SegundoFactorPage`
// below proves one during login (Task 18, mine). Different files, different
// routes (`/app/segundo-factor` vs `/segundo-factor`), same class name.
import ConfigurarSegundoFactorPage from "./pages/menu/segundoFactor/SegundoFactorPage";
import NovedadesPage from "./pages/menu/NovedadesPage";
import InfraestructuraPage from "./pages/menu/InfraestructuraPage";
import SinAccesoPage from "./pages/menu/SinAccesoPage";
import BitacoraPage from "./pages/menu/bitacora";
import { TooltipProvider } from "./components/ui/tooltip";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SegundoFactorPage from "./pages/login/SegundoFactorPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BajaInformePage from "./pages/BajaInformePage";
import { Toaster } from "@/components/ui/sonner";
import { StepUpDialog } from "./components/dialogs/StepUpDialog";
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
  /**
   * A `parcial` session belongs on `/segundo-factor`, never on the bare
   * credentials form. Without this, reloading the tab mid-verification — the
   * MFA loop's second entry, hallazgo A10/D4 — lands back on `/login` with
   * the password box empty, asking somebody to retype what the server
   * already accepted, instead of the one screen that can finish the job with
   * the cookie it already has.
   */
  if (sesion.estado === "parcial") return <Navigate to="/segundo-factor" replace />;
  return sesion.autenticado ? <Navigate to="/app/home" replace /> : <Outlet />;
};

/**
 * Guards `/segundo-factor`: only a session that is genuinely `parcial` may
 * render the screen behind it.
 *
 * Three ways in, and each says where else to go instead of rendering nothing:
 * already fully in (`autenticado`) has nothing left to prove, and no session
 * at all (`estado` unset) has nothing to verify — both are sent away rather
 * than shown a code field with no session behind it to check the code
 * against. Only `estado === "parcial"` renders the `<Outlet />`.
 */
export const SegundoFactorRoute = () => {
  const { sesion, loading } = useContext(SesionContext);

  if (loading) return <LoadingPage />;
  if (sesion.autenticado) return <Navigate to="/app/home" replace />;
  if (sesion.estado !== "parcial") return <Navigate to="/login" replace />;
  return <Outlet />;
};

/**
 * Who may open a screen, asked of the same matrix that draws the menu.
 *
 * This used to be a list of role numbers written here by hand while the sidebar
 * already asked the matrix, so the two disagreed in both directions. Untick
 * `generador.ver` for a role and the menu entry vanished while the URL still
 * worked — the page mounted, the catalogue came back 403, and the screen
 * offered a "Reintentar" button for a refusal that was permanent. Create a
 * fourth role from the roles screen and grant it anything, and every route redirected
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
 * permanent. Four outcomes now, and they are not the same conversation:
 *
 *   - the fourteen-day grace period ran out and nothing was ever registered
 *     (`onboarding`) → the screen that lets them fix that, not a wall;
 *   - may see incidents → the dashboard, as before;
 *   - may see something else → go there, rather than sit on a screen that
 *     cannot load while the sidebar lists screens that can;
 *   - may see nothing → say so, and say who to ask.
 *
 * Decided from the permission matrix the session already carries, not from a
 * 403: the answer is known before the request, and asking anyway would mean a
 * wasted round trip and a spinner before the bad news.
 *
 * **The `onboarding` branch, hallazgo A11.** `permisos` is withheld from that
 * state on purpose (`GET /auth/me`'s own comment), so `can()` answers `false`
 * for every module and this route used to fall straight through to
 * `SinAccesoPage` — a screen that tells a real person, correctly logged in,
 * that "el rol asignado a tu cuenta no tiene ningún módulo habilitado" and to
 * go bother an administrator. That is a false sentence for this account: the
 * role may have every module granted, and there is nothing an administrator
 * could change that would fix it. The one thing that would is the account's
 * own second factor, which it never registered, and `/app/segundo-factor` is
 * where that happens — checked *before* the permission question below rather
 * than after: asking `can()` anything about an account `permisos` was never
 * sent to is a question with no honest answer.
 *
 * **Not `/app/perfil`.** That was this task's first guess, and
 * `pages/menu/segundoFactor/SegundoFactorPage.tsx`'s own header comment is
 * why it is wrong: `PerfilPage` is built on `usePerfilData`, whose very first
 * request is `GET /api/usuario/:id`, which `onboarding` gets a 403 from
 * (`sessionState.ts` opens only `/api/auth/*` for that state). The screen
 * that actually works for `onboarding` talks to nothing outside `/api/auth/*`,
 * and lives at its own route with no `ModuleRoute` in front of it. `PerfilAcceso.tsx` shows the same three
 * sections inside the profile for every session that can load it; this route
 * is the copy that works when the profile does not.
 */
export const HomeRoute = () => {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const enOnboarding = sesion.estado === "onboarding";

  useEffect(() => {
    if (enOnboarding) {
      toast.warning(MENSAJE_ONBOARDING_VENCIDO, { id: TOAST_ONBOARDING_ID });
    }
  }, [enOnboarding]);

  if (enOnboarding) return <Navigate to="/app/segundo-factor" replace />;

  if (can(rol, "eventos", "ver")) return <InicioPage />;
  const elsewhere = firstModuleScreen(rol);
  if (elsewhere) return <Navigate to={elsewhere.path} replace />;
  return <SinAccesoPage />;
};

/**
 * What happened, and what to do about it — hallazgo A11's whole point. Not
 * "onboarding" or a status code: those describe the system, not the two
 * things a nervous person needs, which are why they landed here and what
 * makes it stop happening.
 */
const MENSAJE_ONBOARDING_VENCIDO =
  "Se venció el plazo de dos semanas para configurar tu segundo factor de acceso. " +
  "Configuralo ahora: hasta que lo hagas, no vas a poder abrir los módulos del sistema.";

/** Stable so the toast replaces itself instead of stacking on every visit to `/app/home`. */
const TOAST_ONBOARDING_ID = "mfa-onboarding-vencido";

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
                      lands, and the release notes are the same for everyone.

                      `segundo-factor` belongs here for the same reason: an
                      `onboarding` session — no factor registered, the grace
                      period over — has to be able to reach it, and
                      `ModuleRoute` answers every question it asks from a
                      permission matrix that state is never sent (see
                      `HomeRoute` below). */}
                  <Route path="home"           element={<HomeRoute />} />
                  <Route path="perfil"         element={<PerfilPage />} />
                  <Route path="segundo-factor" element={<ConfigurarSegundoFactorPage />} />
                  <Route path="novedades"      element={<NovedadesPage />} />

                  {/* Development only, and the guard is the whole mechanism:
                      Vite replaces `import.meta.env.DEV` with the literal
                      `false` when it builds, so Rollup drops this branch and
                      the address does not exist in what Vercel serves. The
                      matching entry in `AppSidebar.tsx` carries the same
                      guard — hiding only the button would leave the route
                      reachable by typing it.

                      `<Routes>` skips children that are not elements on
                      purpose, so the `false` this collapses to in production
                      is ignored rather than an error. */}
                  {import.meta.env.DEV && (
                    <Route path="infraestructura" element={<InfraestructuraPage />} />
                  )}

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
                    {/* The generator's own reports, sent by mail on a schedule.
                        Under the same guard: whoever may read the generator may
                        read their own schedules. What they may *write* there is
                        `generador.programar`, which the page and the menu ask. */}
                    <Route path="envios"        element={<EnviosProgramadosPage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="parametros" />}>
                    <Route path="parametros"    element={<ParametrosPage />} />
                  </Route>

                  <Route element={<ModuleRoute modulo="seguridad" />}>
                    <Route path="usuarios"      element={<SeguridadPage />} />
                    <Route path="usuarios/:id"  element={<UsuarioDetallePageKeyed />} />
                    {/* Where these two lived until the screen was named for
                        what is on it. Kept so a bookmark or a link pasted into
                        a chat still arrives. */}
                    <Route path="seguridad"     element={<UsuarioOldAddress />} />
                    <Route path="seguridad/:id" element={<UsuarioOldAddress />} />
                  </Route>

                  {/* Its own door, on its own permission. As a tab of the users
                      screen it stood behind `seguridad` as well, so a role that
                      could manage roles but not accounts had no way in. */}
                  <Route element={<ModuleRoute modulo="roles" />}>
                    <Route path="roles"         element={<RolesPage />} />
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

              {/* Its own guard, not `PublicRoutes`: that one sends anybody
                  `autenticado` to `/app/home`, and a `parcial` session is
                  deliberately never `autenticado` — see `SesionInterface`.
                  `SegundoFactorRoute` is the one place that knows a `parcial`
                  session belongs here and nowhere else public. */}
              <Route element={<SegundoFactorRoute />}>
                <Route path="/segundo-factor" element={<SegundoFactorPage />} />
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

              {/* Outside `PublicRoutes` for the same reason as the one above:
                  whoever opens the "stop these" link of a scheduled report
                  arrives with a token in the fragment, and a session open in
                  that browser must not swallow it. Most people who land here
                  have no account at all. */}
              <Route path="/baja-informe" element={<BajaInformePage />} />

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
            {/* Dentro del router y fuera de <Routes>: lee la navegación para
                aplicar sola una versión nueva al cambiar de pantalla, y no
                puede vivir en una ruta porque entonces sólo miraría una. */}
            <UpdatePrompt />
          </BrowserRouter>
          {/* Fuera de <Routes> a propósito: si viviera dentro, una sesión que
              caduca mientras alguien teclea su contraseña desmontaría la
              ventana en mitad de la frase y dejaría colgadas las peticiones
              que esperaban su respuesta. */}
          <StepUpDialog />
          <Toaster position="top-right" richColors closeButton />
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

/**
 * `/app/seguridad` and `/app/seguridad/:id`, sent on to where they live now.
 *
 * With what came after the address. `<Navigate to="…">` given a string builds a
 * whole new location and drops the query and the fragment, so a link that
 * carried either arrived without it.
 */
export function UsuarioOldAddress() {
  const { id } = useParams<{ id: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: id ? `/app/usuarios/${id}` : "/app/usuarios", search, hash }} replace />;
}

function UsuarioDetallePageKeyed() {
  const { id } = useParams<{ id: string }>();
  return <UsuarioDetallePage key={id} />;
}
