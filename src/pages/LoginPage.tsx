import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeftIcon, KeyRoundIcon, Loader2, LogIn, SunIcon, MoonIcon } from "lucide-react";
import { motion } from "motion/react";

import { useTheme } from "../components/theme-provider";
import { SesionContext } from "../context/SesionContext";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { loginUsuario, comprobarToken } from "../api/Login.api";
import { cancelarCeremonia, entrarSinContrasena, soportaPasskeys } from "../api/passkeyCeremony";

import logo from "../assets/images/logo.png";
import { TramoPlan } from "./landing/TramoPlan";
import { paperClass, paperVars } from "./landing/tokens";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const rightStagger = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.7, ease, staggerChildren: 0.14, delayChildren: 0.3 },
  },
};

const formItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const LoginPage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const { setSesion } = useContext(SesionContext);
  const [login, setLogin] = useState<UsuarioInterface>(usuarioExample);
  const [loading, setLoading] = useState(false);
  // Leído una vez: que el navegador sepa hacer una ceremonia no cambia
  // durante la vida de la página, y en `jsdom` es `false` — el botón de la
  // llave no se pinta donde no puede funcionar.
  const [soportaLlave] = useState(() => soportaPasskeys());
  const [probandoLlave, setProbandoLlave] = useState(false);
  // Se enseña después de que la persona cierre el diálogo del sistema sin
  // elegir nada — ver `entrar` para por qué aquí el silencio no basta.
  const [pistaLlave, setPistaLlave] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  // The whole address, not only its path. `PrivateRoutes` hands over the full
  // location, and this kept `pathname` alone — so the link in the verification
  // email, `/app/perfil#verify_email=TOKEN`, opened in a browser with no
  // session came back from the login as a bare `/app/perfil`, with nothing
  // verified and nothing said. Same for any address carrying a query.
  const desde = (location.state as { from?: { pathname?: string; search?: string; hash?: string } })?.from;
  const from = !desde?.pathname || desde.pathname === "/login"
    ? "/app/home"
    : `${desde.pathname}${desde.search ?? ""}${desde.hash ?? ""}`;

  // Salir de la página con el diálogo del sistema abierto lo deja huérfano:
  // la librería lo aborta desde un singleton, y cancelarlo aquí es lo único
  // que impide que una respuesta tardía intente abrir sesión sobre una
  // pantalla que ya no existe.
  useEffect(() => () => cancelarCeremonia(), []);

  /**
   * Lo que pasa después de que el servidor haya aceptado una credencial, sea
   * cual sea — la contraseña o la llave —, y por eso es una función aparte:
   * los dos caminos tienen que aterrizar en la misma pantalla por las mismas
   * reglas, y una segunda copia de estas tres ramas es como una de ellas se
   * queda atrás.
   */
  const abrirSesion = async (sesionInicial: SesionInterface) => {
    if (sesionInicial.permisos) {
      // A `completa` session: `auth.controller.ts`'s `login` only sends
      // `permisos` for one, and it never sends `estado` at all (its own
      // comment: publishing the state of a session on a request that has
      // not even set a cookie yet on a wrong password would give it away
      // for free). Every passkey login answers this way; a password login
      // does too until the account registers a factor.
      setSesion({ ...sesionInicial, estado: "completa", autenticado: true });
      navigate(from, { replace: true });
      return toast.success("Bienvenido");
    }

    /**
     * `permisos` missing means this login opened `parcial` or
     * `onboarding` — which one, the login body cannot say (see above), so
     * `GET /auth/me` is asked, on the cookie this login just set.
     *
     * 🔴 Hallazgo A10/D4: this is one of the MFA loop's two entries.
     * `SesionProvider.tsx`'s own startup call to `comprobarToken` is the
     * other, fixed the same way — a `parcial` answer must never be read as
     * "logged in" on either path, or the fix on one leaves the loop alive
     * on the other.
     */
    const yo = await comprobarToken();
    if (yo.status !== 200 || !yo.usuario) {
      return toast.error("No se pudo completar el inicio de sesión. Intentalo de nuevo.");
    }

    if (yo.estado === "parcial") {
      /**
       * 🔴 A factor is registered and unproven this session. `autenticado`
       * stays `false` — see `SesionInterface` — so `App.tsx`'s
       * `SegundoFactorRoute` is what actually renders next, not this file
       * navigating into the shell it cannot reach yet.
       *
       * **And the state has to be written into context before navigating,
       * which this did not do until plan 4C's phase 2 touched it.** That
       * guard renders the screen only for `sesion.estado === "parcial"`, and
       * nothing else on this path writes the field: the navigation landed on
       * the guard, the guard read `estado` unset, and sent the person straight
       * back to `/login` — cookie set, login accepted, password box empty, no
       * message. Every account with a factor would have hit it on every
       * login; nobody had, because nobody had a factor yet. `LoginPage.test.tsx`
       * kept passing because its harness drew `/segundo-factor` without the
       * guard in front of it.
       */
      setSesion({ usuario: yo.usuario, permisos: yo.permisos, estado: "parcial", metodos: yo.metodos, autenticado: false });
      return navigate("/segundo-factor", { replace: true, state: { from } });
    }

    // Whatever else `/auth/me` said — `onboarding` for an account with no
    // factor past its deadline, or `completa` for a passkey login whose body
    // arrived without the matrix — is copied as is: there is nothing left to
    // prove before entering, and `App.tsx`'s `HomeRoute` routes an
    // `onboarding` session onward from `/app/home` once inside.
    setSesion({ usuario: yo.usuario, permisos: yo.permisos, estado: yo.estado, autenticado: true });
    navigate(from, { replace: true });
    toast.success("Bienvenido");
  };

  /**
   * Entrar con la llave — plan 4C, fase 2. Desde el clic y sin nada en medio
   * antes de la ceremonia: Safari exige activación reciente para el diálogo
   * del sistema. Cualquier rechazo trae la frase del servidor, que es una
   * sola para todos ellos, o la de conexión. El 200 llega con la misma forma
   * que el del login con contraseña, y entra por la misma puerta:
   * `abrirSesion`.
   *
   * **Cerrar el diálogo del sistema no es un error, pero en esta pantalla no
   * puede ser silencio.** En el segundo paso del login el servidor sabe si la
   * cuenta tiene llave y lo dice; aquí no hay cuenta que mirar — preguntarlo
   * sería el oráculo que el endpoint existe para no ser — así que el diálogo
   * se abre vacío para quien no tiene ninguna, la persona lo cierra, y sin
   * esta pista se queda mirando un botón que «no hace nada». La pista es
   * local, no dice nada del servidor, y desaparece al escribir.
   */
  const entrar = async () => {
    // Un intento nuevo empieza sin la pista del anterior: un rechazo del
    // servidor encima de «¿no tenés llave?» describiría dos fallos a la vez.
    setPistaLlave(false);
    setProbandoLlave(true);
    try {
      const resultado = await entrarSinContrasena();
      if (!resultado.ok) {
        if (resultado.cancelado) setPistaLlave(true);
        else toast.error(resultado.message);
        return;
      }
      await abrirSesion(resultado.sesion);
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setProbandoLlave(false);
    }
  };

  const ValidarDatos = async () => {
    // La tecla Enter de los dos campos llega aquí sin pasar por el botón,
    // que es el único que mira `loading`: con el diálogo del sistema abierto,
    // un Enter no debe lanzar un login por contraseña encima de la ceremonia
    // — y una contraseña mal tecleada ahí cargaría contra el bloqueo de la
    // cuenta que la llave existe para no tocar. Tampoco dos logins a la vez.
    if (loading || probandoLlave) return;

    /**
     * The username loses the spaces at its ends; the password loses nothing.
     *
     * Somebody who pastes their username with a trailing space, or types one by
     * accident on a phone keyboard, would otherwise be told the user does not
     * exist — and there is nothing on screen that shows why. Spaces in the
     * middle stay: `Omar Mita` is a real account here.
     *
     * The password is sent exactly as typed. A space is a character like any
     * other in a secret, and quietly removing one would accept a different
     * password than the one chosen and lock out anyone whose own begins or ends
     * with a space. Only the "did you type anything at all" check ignores
     * whitespace, so a field holding nothing but spaces still counts as empty.
     */
    const user = login.user.trim();
    if (user === "" || login.pass.trim() === "") {
      return toast.warning("Rellena todos los espacios");
    }
    setLoading(true);
    try {
      const responde = await loginUsuario({ ...login, user });
      // `!== 200` and not the `=== 500` this used to read: `loginUsuario` folds
      // every failure to 500 today, so both are the same test — but the fold
      // is its business, not this screen's, and a screen that was right about
      // a flattened number by accident is exactly what `Login.api.ts`'s own
      // comment warns about. The key path below asks the same question of a
      // wrapper that keeps the real status.
      if (responde.status !== 200 || !responde.usuario) {
        return toast.error(responde.message ?? "No se pudo conectar con el servidor.");
      }

      // No `localStorage.setItem` here any more: the credential is the
      // cookie the login response already set, which this page cannot see
      // and does not need to — the next reload asks the server, it does
      // not read anything back out of the browser's storage.
      //
      // `responde.usuario` is cast, and a cast accepts any shape: it would
      // happily let `autenticado` come through as `undefined` from a response
      // that never had that field to begin with. `permisos`, decided inside
      // `abrirSesion`, is what actually turns the login into a session — the
      // field on the response, not a boolean this file makes up.
      await abrirSesion(responde.usuario as SesionInterface);
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex lg:grid lg:grid-cols-2 bg-background">

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="absolute top-4 right-4 z-50 h-9 w-9 rounded-full"
      >
        {resolvedTheme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </Button>

      {/* ── PANEL IZQUIERDO — Brand ──
          The same survey sheet as the public page, with the same tramo drawn
          on it, so going from the site to the login reads as one place. It
          follows the theme like the rest of the flow, because its colours
          are the application's (see `paperVars`). Nothing on it loops; the
          drawing builds once and holds. */}
      <div
        style={paperVars}
        className={`${paperClass} relative hidden flex-col justify-between overflow-hidden bg-[var(--pp-paper)] bg-[linear-gradient(var(--pp-grid)_1px,transparent_1px),linear-gradient(90deg,var(--pp-grid)_1px,transparent_1px)] bg-[size:32px_32px] bg-[position:-1px_-1px] p-12 font-[family-name:var(--pp-sans)] text-[var(--pp-ink)] lg:flex`}
      >
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.6, ease }}>
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="text-sm font-extrabold tracking-[0.06em] [font-stretch:112%]">OSEFI</span>
          </Link>
        </motion.div>

        <div className="max-w-xl">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6, ease, delay: 0.08 }}
            className="flex items-center gap-2.5 font-[family-name:var(--pp-mono)] text-[12px] tracking-[0.12em] text-[var(--pp-dim)] uppercase"
          >
            <span aria-hidden="true" className="h-2 w-2 bg-[var(--pp-mark)]" />
            Sistema interno
          </motion.p>
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.7, ease, delay: 0.16 }}
            className="mt-5 text-5xl leading-[1] font-[850] tracking-[-0.02em] text-balance [font-stretch:118%] xl:text-6xl"
          >
            Precisión en campo. <span className="text-[var(--pp-acc)]">Continuidad en red.</span>
          </motion.h2>
          <div className="mt-10">
            <TramoPlan start={0.45} />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="font-[family-name:var(--pp-mono)] text-[12px] text-[var(--pp-dim)]"
        >
          Osefi SRL · © {new Date().getFullYear()}
        </motion.p>
      </div>

      {/* ── PANEL DERECHO — Formulario ── */}
      <div className="flex w-full items-center justify-center p-8 lg:p-14 relative z-10 bg-background md:bg-card md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.12)] dark:md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.5)] dark:md:border-l dark:md:border-border">
        {/* The way back to the public page. On a phone the brand panel, whose
            logo also links home, is not shown, so this is the only one. */}
        <Link
          to="/"
          className="absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Volver a la página
        </Link>
        <motion.div
          className="mx-auto w-full max-w-105 pb-6"
          variants={rightStagger}
          initial="hidden"
          animate="visible"
        >
          {/* Encabezado */}
          <motion.div className="flex flex-col space-y-2 lg:text-left text-center" variants={formItem}>
            {/* Logo mobile */}
            <div className="flex lg:hidden justify-center mb-6">
              {/* Sin `dark:invert`: el logo tiene sus propios colores de marca y
                  invertirlos en modo oscuro los cambia por sus complementarios.
                  La versión de escritorio nunca lo hizo, así que además las dos
                  no coincidían. */}
              <div className="bg-muted p-4 rounded-3xl border shadow-sm">
                <img src={logo} alt="Osefi srl" className="h-14 w-auto drop-shadow-sm" />
              </div>
            </div>
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.18em]">
              Osefi srl · Sistema Interno
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              Acceder
            </h1>
            <p className="text-sm text-muted-foreground pt-1">
              Ingresá con tu usuario y contraseña para continuar.
            </p>
          </motion.div>

          {/* Formulario */}
          <motion.div className="mt-10 space-y-5" variants={formItem}>
            <div className="space-y-2">
              <Label htmlFor="usuario" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Usuario
              </Label>
              <Input
                id="usuario"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                placeholder="ej. carlos.admin"
                className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-base rounded-xl transition-all"
                onChange={(e) => {
                  setPistaLlave(false);
                  setLogin({ ...login, user: e.target.value });
                }}
                // Tidied when the field loses focus, so what gets sent is what
                // the person can see. Trimming on every keystroke would stop
                // anyone typing a name with a space in it.
                onBlur={(e) => setLogin((prev) => ({ ...prev, user: e.target.value.trim() }))}
                onKeyDown={(e) => { if (e.key === "Enter") ValidarDatos(); }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="contrasena" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Contraseña
                </Label>
                <Link
                  to="/olvide-contrasena"
                  className="text-xs text-muted-foreground/70 hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="contrasena"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-widest font-mono rounded-xl transition-all"
                onChange={(e) => {
                  setPistaLlave(false);
                  setLogin({ ...login, pass: e.target.value });
                }}
                onKeyDown={(e) => { if (e.key === "Enter") ValidarDatos(); }}
              />
            </div>

            <Button
              type="button"
              className="mt-2 h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 group"
              disabled={loading || probandoLlave}
              onClick={ValidarDatos}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Iniciar Sesión
                  <LogIn className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>

            {/* Entrar con la llave, sin contraseña — sólo donde el navegador
                puede abrir el diálogo del sistema. Misma frase que en el
                segundo paso del login: para quien la lee, las dos son
                «entrar»; lo que cambia es lo que hay detrás. */}
            {soportaLlave && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                  <div className="h-px flex-1 bg-border" />
                  o
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest"
                  onClick={entrar}
                  disabled={probandoLlave || loading}
                  aria-busy={probandoLlave}
                >
                  {probandoLlave ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRoundIcon className="mr-2 h-4 w-4" />
                      Entrar con mi llave de acceso
                    </>
                  )}
                </Button>
                {/* Siempre en el árbol y sólo cambia el texto: una región
                    `status` que aparece en la misma mutación que su contenido
                    es el caso que los lectores de pantalla no anuncian — y la
                    persona a la que va dirigida no tiene otra señal. */}
                <p className="min-h-4 text-xs text-muted-foreground" role="status">
                  {pistaLlave
                    ? "No se eligió ninguna llave. Si no tenés una registrada, entrá con tu contraseña y configurala desde tu perfil, en «Segundo factor»."
                    : ""}
                </p>
              </div>
            )}
          </motion.div>

          <motion.p
            className="mt-10 text-center text-xs text-muted-foreground/50"
            variants={formItem}
          >
            Acceso restringido · Solo personal autorizado
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
