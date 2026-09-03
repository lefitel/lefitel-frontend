import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRoundIcon, Loader2, ShieldCheckIcon, SunIcon, MoonIcon } from "lucide-react";

import { useTheme } from "../../components/theme-provider";
import { SesionContext } from "../../context/SesionContext";
import { usuarioExample } from "../../data/example";
import { abandonPartialSession, comprobarToken, verifySecondFactor } from "../../api/Login.api";
import { cancelarCeremonia, probarPasskey, soportaPasskeys } from "../../api/passkeyCeremony";

import logo from "../../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The second step of a login for an account that already has a factor
 * registered — reached only through `SegundoFactorRoute` in `App.tsx`, which
 * is what guarantees a `parcial` session (and its cookie) already exists by
 * the time this renders.
 *
 * **Lives in the login tree, not inside the app shell, and that is load-bearing.**
 * A `parcial` session cannot load a single stored image —
 * `puedeVerArchivosEstaticos` server-side opens only for `onboarding` and
 * `completa` — so mounting this inside `HomePage`'s sidebar-and-header shell
 * would 403 on every icon in it. The logo above is safe precisely because it
 * is a bundled asset served from this app's own origin, never a stored
 * photograph fetched through the API.
 *
 * **Three visible ways in, never one hidden behind the other.** Hallazgo
 * A5/D4's own instruction: whoever arrives here with a lost phone is exactly
 * the person who needs the recovery code, so it is its own tab next to the
 * app code, not a link reading "¿problemas?" that has to be found first.
 *
 * 🔴 **The passkey button is the third, and without it phase 1 of plan 4C
 * ships a key nobody can log in with.** This screen used to offer only the
 * two code tabs. An account whose only factor is a passkey opens `parcial`
 * on every login, lands here, and can produce neither a six-digit code nor —
 * after ten logins — a recovery code: it would burn one of its ten sheets
 * per login and then be locked out for good. `/api/auth/webauthn/login` is
 * on the `PARCIAL` allow-list precisely so this button can call it. It is
 * drawn only where the browser can run a ceremony, and it ignores "recordar
 * este equipo": the server mints no remembered-device cookie on a passkey
 * login (a decided asymmetry — a key is already one gesture).
 *
 * **No clock-skew note is written on this side, and — verified against
 * `api/src/controllers/mfa.controller.ts` as actually built — none arrives
 * from the server today either.** The plan's Task 7 Step 4 reads as a promise
 * of one; what got built instead, deliberately, is rule 2 of hallazgo C12
 * taken further than the plan's own prose suggests: `verificarTotp` logs
 * `MFA_CLOCK_SKEW_DETECTED` to the bitácora when a code only matches in the
 * wider diagnostic window, but the response is always the same
 * `CODIGO_MFA_INVALIDO`, skew or garbage alike — "the message never says so"
 * is that file's own comment. So this screen's plain `toast.error(message)`
 * on failure is future-proofing that costs nothing today, not a feature that
 * fires: there is currently no server sentence for it to show. Flagged for
 * the coordinator in this task's own report — the spec and the plan both
 * describe a user-facing hint that does not exist in the endpoint that would
 * produce it.
 */
const SegundoFactorPage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const { setSesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/app/home";

  const [modo, setModo] = useState<"totp" | "recuperacion">("totp");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * "Recordar este equipo" — hallazgo E-7/F16. Off by default and only ever
   * turned on by hand: this is a credential that skips the second factor for
   * thirty days, which is a choice, not something the screen may assume on
   * anybody's behalf. See `verifySecondFactor`'s own comment in `Login.api.ts`
   * for the field it rides on, and `api/src/config/security.ts`'s
   * `REMEMBER_DEVICE_FIELD` for the server half that has been reading it
   * since before this checkbox existed to send it.
   */
  const [recordar, setRecordar] = useState(false);
  // Una sola vez: es una propiedad del navegador, no cambia durante la vida
  // de la página.
  const [soportaLlave] = useState(() => soportaPasskeys());
  const [probandoLlave, setProbandoLlave] = useState(false);

  // Salir de la pantalla con el diálogo del sistema abierto lo deja huérfano;
  // el mismo cierre que `LoginPage.tsx`, para que las dos pantallas de llave
  // se comporten igual.
  useEffect(() => () => cancelarCeremonia(), []);

  /**
   * Lo que pasa después de que el servidor haya aceptado un factor, sea cual
   * sea: volver a leer la sesión de `/auth/me`, escribirla en el contexto, y
   * entrar. Compartido por el código y por la llave, que es la única razón de
   * que sea una función aparte.
   */
  const abrirSesion = async () => {
      /**
       * The endpoint that proves the factor does not say who this session
       * belongs to now — `/auth/me` does, the same authority `LoginPage.tsx`
       * asks after a login with no `permisos`. Re-deriving the session from
       * there instead of trusting a shape guessed from this response is the
       * same rule that file follows, for the same reason: this file was
       * written before `POST /auth/mfa/verify`'s controller existed, so
       * nothing about its body is a contract yet.
       */
      const yo = await comprobarToken();
      if (yo.status !== 200 || !yo.usuario) {
        // Neutro a propósito: esta función la comparten el código y la llave.
        toast.error("La verificación se aceptó, pero no se pudo abrir tu sesión. Volvé a iniciar sesión.");
        navigate("/login", { replace: true });
        return;
      }

      /**
       * Hallazgo D-3/E-4/F11 — the THIRD entry of the same loop
       * `LoginPage.tsx` and `SesionProvider.tsx`'s startup effect both
       * already guard: `estado === "parcial"` must never read as
       * `autenticado`, even on the one screen whose entire job is finishing a
       * `parcial` session. `confirmTotp` on the server deliberately ignores
       * `promoverSesion`'s return and promotes whatever session the request's
       * *own* cookie names — so a login racing in from another tab, or a
       * `logout-all` from another device, can leave this exact request with a
       * 200 whose session was never the one that got promoted. Reading that
       * unconditionally as `autenticado: true` used to send the next request
       * straight into `authenticate`'s 401 (a `parcial` session outside its
       * own allow-list), which the interceptor reads as "session closed" and
       * answers with `logout()` — the code was right, the server accepted
       * it, and the screen told the person the opposite.
       */
      const autenticado = yo.estado !== "parcial";
      setSesion({
        usuario: yo.usuario,
        permisos: yo.permisos,
        estado: yo.estado,
        autenticado,
      });

      if (!autenticado) {
        toast.error("Tu sesión cambió mientras verificabas tu identidad. Volvé a intentarlo.");
        return;
      }

      navigate(from, { replace: true });
      toast.success("Bienvenido");
  };

  const verificar = async () => {
    const valor = codigo.trim();
    if (!valor) {
      return toast.warning(
        modo === "totp" ? "Ingresá el código de tu aplicación." : "Ingresá tu código de recuperación."
      );
    }

    setLoading(true);
    try {
      const respuesta = await verifySecondFactor(valor, recordar);
      if (respuesta.status !== 200) {
        toast.error(respuesta.message ?? "No se pudo verificar el código.");
        return;
      }

      await abrirSesion();
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Entrar con la llave. Desde el clic y sin nada en medio antes de la
   * ceremonia: Safari exige activación reciente para el diálogo del sistema.
   * Cancelar ese diálogo no es un error y no se enseña como tal.
   */
  const entrarConLlave = async () => {
    setProbandoLlave(true);
    try {
      const resultado = await probarPasskey();
      if (!resultado.ok) {
        if (!resultado.cancelado) toast.error(resultado.message);
        return;
      }
      await abrirSesion();
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setProbandoLlave(false);
    }
  };

  /**
   * Abandons this login attempt.
   *
   * Hallazgo E-10/F13: this used to only reset the local placeholder and
   * navigate, leaving the `parcial` session's row — and its up-to-seven-day
   * cookie — alive on whatever machine this is. `SesionProvider.tsx`'s own
   * `logout()` cannot fix that: it only calls the server when
   * `sesion.autenticado` is already `true`, which a `parcial` session is not,
   * by `SesionInterface`'s own contract. `abandonPartialSession` is the
   * route the server opened for exactly this case — see its own comment in
   * `Login.api.ts` — so this is the one caller that reaches it.
   *
   * Fire-and-forget: the local reset and the navigation below happen either
   * way, the same as they always did, so a slow or failed revoke never keeps
   * anybody stuck on this screen.
   */
  const volver = () => {
    abandonPartialSession();
    setSesion({ usuario: usuarioExample, autenticado: false });
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-background p-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="absolute top-4 right-4 z-50 h-9 w-9 rounded-full"
      >
        {resolvedTheme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </Button>

      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="bg-muted p-4 rounded-3xl border shadow-sm">
            <img src={logo} alt="Osefi srl" className="h-12 w-auto drop-shadow-sm" />
          </div>
        </div>

        <div className="flex flex-col space-y-2 text-center mb-8">
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.18em]">
            Osefi srl · Sistema Interno
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Verificá tu identidad</h1>
          <p className="text-sm text-muted-foreground pt-1">
            Tu cuenta tiene un segundo factor configurado. Confirmalo para terminar de entrar.
          </p>
        </div>

        {soportaLlave && (
          <div className="mb-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest"
              onClick={entrarConLlave}
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
            <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
              <div className="h-px flex-1 bg-border" />
              o con un código
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <Tabs value={modo} onValueChange={(v) => { setModo(v as "totp" | "recuperacion"); setCodigo(""); }}>
          <TabsList className="w-full mb-5">
            <TabsTrigger value="totp" className="flex-1">Código de la app</TabsTrigger>
            <TabsTrigger value="recuperacion" className="flex-1">Código de recuperación</TabsTrigger>
          </TabsList>

          <TabsContent value="totp">
            <div className="space-y-2 mb-5">
              <Label htmlFor="codigo-totp" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Código de seis dígitos
              </Label>
              <Input
                id="codigo-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-[0.4em] font-mono text-center rounded-xl transition-all"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") verificar(); }}
              />
              <p className="text-xs text-muted-foreground/70">
                Abrí tu aplicación de autenticación y escribí el código que muestra en este momento.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="recuperacion">
            <div className="space-y-2 mb-5">
              <Label htmlFor="codigo-recuperacion" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Código de recuperación
              </Label>
              <Input
                id="codigo-recuperacion"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Uno de los diez códigos que guardaste"
                className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-base font-mono rounded-xl transition-all"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") verificar(); }}
              />
              <p className="text-xs text-muted-foreground/70">
                Usá esta vía si perdiste el teléfono con el que configuraste el código de seis dígitos.
                Cada código de recuperación sirve una sola vez.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <label
          htmlFor="recordar-equipo"
          className="mb-5 flex items-start gap-2.5 cursor-pointer select-none"
        >
          <Checkbox
            id="recordar-equipo"
            checked={recordar}
            onCheckedChange={(v) => setRecordar(v === true)}
            className="mt-0.5"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            No volver a pedirme el código en este equipo durante 30 días. Sólo al entrar con un
            código: la llave ya cuenta como segundo factor y no lo necesita.
          </span>
        </label>

        <Button
          className="h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 group"
          disabled={loading || probandoLlave}
          onClick={verificar}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Verificar
              <ShieldCheckIcon className="ml-2 h-4 w-4 transition-transform group-hover:scale-110" />
            </>
          )}
        </Button>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={volver}
            className="text-xs text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            Cancelar y volver a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegundoFactorPage;
