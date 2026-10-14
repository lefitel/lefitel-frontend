import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRoundIcon, Loader2, MailIcon, ShieldCheckIcon, SunIcon, MoonIcon } from "lucide-react";

import { useTheme } from "../../components/theme-provider";
import { SesionContext } from "../../context/SesionContext";
import { usuarioExample } from "../../data/example";
import { abandonPartialSession, comprobarToken, verifySecondFactor } from "../../api/Login.api";
import { pedirCodigoPorCorreo } from "../../api/Mfa.api";
import { cancelarCeremonia, probarPasskey, soportaPasskeys } from "../../api/passkeyCeremony";

import logo from "../../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The three code tabs. The passkey is a button above them, not a tab. */
type Modo = "totp" | "correo" | "recuperacion";

/**
 * Every code tab, in the order they are drawn, with the name the server gives
 * each. `corto` is what a phone shows: three full titles side by side are some
 * 400px, and a phone has 300.
 */
const PESTANAS: { modo: Modo; metodo: string; titulo: string; corto: string }[] = [
  { modo: "totp", metodo: "totp", titulo: "Código de la app", corto: "App" },
  { modo: "correo", metodo: "correo", titulo: "Código por correo", corto: "Correo" },
  { modo: "recuperacion", metodo: "codigo", titulo: "Código de recuperación", corto: "Recuperación" },
];

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
 * **The email code is the fourth way in (plan 4E), and it is a tab like the
 * other two — never sent on its own.** A verified address is a full second
 * factor since 4E, so the person who lost the phone types here the six
 * digits they got by mail, with `metodo: "correo"` so the server does not
 * prove them against the app. Nothing is sent when the screen mounts or when
 * the tab opens (S4 of the design's pre-audit): every send spends the mail
 * quota, and a tab is opened out of curiosity too. One button asks for the
 * code, and the wait drawn on it is always the server's number — the cooldown
 * of a 200, the seconds left of a 429 — never one chosen here.
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
  const { sesion, setSesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/app/home";

  /**
   * Only the ways in this account has. `/auth/me` lists them for a `parcial`
   * session (`sesion.metodos`), and the screen is drawn from that list: a tab
   * per code factor, the key button only for an account with a key, and no
   * tab bar at all when there is a single way in.
   *
   * It used to draw everything for everybody and open on the authenticator
   * app, so an account with only a verified address was asked for a code it
   * could not produce.
   *
   * **No list means "not told", and everything is drawn** — a server from
   * before this field answers that way, and hiding every door from it would
   * lock people out of a login that works.
   */
  const metodos = sesion.metodos;
  const tiene = (metodo: string) => metodos === undefined || metodos.includes(metodo);
  const pestanas = PESTANAS.filter((p) => tiene(p.metodo));

  // Open on the first one the account has. Read once: the list belongs to the
  // session this screen was opened for and does not change under it.
  const [modo, setModo] = useState<Modo>(() => pestanas[0]?.modo ?? "totp");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * The email tab (plan 4E): where the code went (masked by the server), how
   * many seconds until another may be asked for, and whether one is in
   * flight. `espera` is always what the server said — never a number chosen
   * here.
   */
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [pidiendoCodigo, setPidiendoCodigo] = useState(false);
  /** What the server said is left before the account locks, after a wrong code. */
  const [restantes, setRestantes] = useState<number | null>(null);
  // The address a code would go to, as `/auth/me` gave it to this parcial
  // session: masked by the server (hallazgo C16), and only when verified — a
  // saved-but-unverified address is not where any code will go.
  const direccion = sesion?.usuario?.email_verified_at ? (sesion.usuario.email ?? null) : null;
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
  /** The key button: the browser can, and the account has one. */
  const ofreceLlave = soportaLlave && tiene("passkey");
  /** A key is this account's only factor and this browser cannot run one. */
  const soloLlaveSinSoporte = pestanas.length === 0 && !ofreceLlave;
  const [probandoLlave, setProbandoLlave] = useState(false);

  // Salir de la pantalla con el diálogo del sistema abierto lo deja huérfano;
  // el mismo cierre que `LoginPage.tsx`, para que las dos pantallas de llave
  // se comporten igual.
  useEffect(() => () => cancelarCeremonia(), []);

  // One tick per second while a wait is running; the server's number counts
  // down here and nowhere else.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

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
        modo === "totp"
          ? "Ingresá el código de tu aplicación."
          : modo === "correo"
            ? "Ingresá el código que recibiste por correo."
            : "Ingresá tu código de recuperación."
      );
    }

    setLoading(true);
    try {
      // The email tab names its door: six digits from the mail look exactly
      // like six digits from the app, and without `metodo` the server would
      // prove them against the app and charge the lockout for it. The other
      // two tabs send nothing, which every server version understands.
      const respuesta =
        modo === "correo"
          ? await verifySecondFactor(valor, recordar, "correo")
          : await verifySecondFactor(valor, recordar);
      if (respuesta.status !== 200) {
        toast.error(respuesta.message ?? "No se pudo verificar el código.");
        setRestantes(typeof respuesta.intentosRestantes === "number" ? respuesta.intentosRestantes : null);
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
   * Ask the server to mail a code. Only from the button — see the header.
   * A 200 carries the masked address and the cooldown; a 429 the seconds
   * left, which is what the button counts down; a 503 means no provider
   * could send it, and the previous code, if any, is still good; a 400 that
   * the account has no verified address. Each is the server's own sentence.
   */
  const pedirCodigo = async () => {
    setPidiendoCodigo(true);
    try {
      const r = await pedirCodigoPorCorreo();
      if (r.status === 200) {
        setEnviadoA(r.enviado_a);
        setEspera(r.reintento_en_s ?? 0);
        toast.success(r.enviado_a ? `Código enviado a ${r.enviado_a}.` : "Código enviado.");
        return;
      }
      if (r.status === 429 && r.reintento_en_s) setEspera(r.reintento_en_s);
      toast.error(r.message ?? "No se pudo enviar el código.");
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setPidiendoCodigo(false);
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

        {ofreceLlave && (
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
            {pestanas.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                <div className="h-px flex-1 bg-border" />
                o con un código
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
          </div>
        )}

        {soloLlaveSinSoporte && (
          <p className="mb-6 text-sm text-muted-foreground" role="status">
            Tu cuenta se confirma con una llave de acceso, y este navegador no puede usar llaves
            de acceso. Entrá desde el equipo o el navegador donde la registraste.
          </p>
        )}

        {pestanas.length > 0 && (
        <Tabs value={modo} onValueChange={(v) => { setModo(v as Modo); setCodigo(""); }}>
          {/* A bar to choose from only when there is a choice. */}
          {pestanas.length > 1 && (
            <TabsList className="w-full mb-5">
              {pestanas.map((p) => (
                <TabsTrigger key={p.modo} value={p.modo} className="flex-1">
                  {/* The full title stays the tab's name on a phone too, read
                      out but not drawn; the short word is only drawn. */}
                  <span aria-hidden className="sm:hidden">{p.corto}</span>
                  <span className="max-sm:sr-only">{p.titulo}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          )}

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

          <TabsContent value="correo">
            <div className="space-y-3 mb-5">
              <p className="text-xs text-muted-foreground/70">
                {enviadoA ? (
                  <>Enviamos un código de seis cifras a <span className="font-mono">{enviadoA}</span>. Vale diez minutos.</>
                ) : direccion ? (
                  <>Te enviaremos un código de seis cifras a <span className="font-mono">{direccion}</span>. Vale diez minutos.</>
                ) : (
                  "Te enviaremos un código de seis cifras a tu correo verificado. Vale diez minutos."
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl text-sm font-bold uppercase tracking-widest"
                onClick={pedirCodigo}
                disabled={pidiendoCodigo || espera > 0 || loading}
                aria-busy={pidiendoCodigo}
              >
                {pidiendoCodigo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : espera > 0 ? (
                  `Reenviar en ${espera} s`
                ) : (
                  <>
                    <MailIcon className="mr-2 h-4 w-4" />
                    {enviadoA ? "Reenviar código" : "Enviar código"}
                  </>
                )}
              </Button>
              <div className="space-y-2">
                <Label htmlFor="codigo-correo" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Código recibido por correo
                </Label>
                <Input
                  id="codigo-correo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-[0.4em] font-mono text-center rounded-xl transition-all"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === "Enter") verificar(); }}
                />
              </div>
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
        )}

        {/* Both belong to the code forms: with a key as the only way in there
            is no code to verify, and the key already counts as the second
            factor, so there is nothing to remember either. */}
        {pestanas.length > 0 && (<>
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
        </>)}

        {/* The warning before the lock (plan 4E): five wrong codes lock the whole
            account, and the error sentence is the same as for a typo. */}
        {restantes !== null && restantes <= 2 && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-500" role="status">
            {restantes === 0
              ? "Tu cuenta ha quedado bloqueada temporalmente. Esperá unos minutos o pedile a un administrador que la desbloquee."
              : restantes === 1
                ? "Te queda 1 intento antes de que la cuenta se bloquee."
                : `Te quedan ${restantes} intentos antes de que la cuenta se bloquee.`}
          </p>
        )}

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
