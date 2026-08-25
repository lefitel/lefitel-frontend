import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, KeyRound, ShieldAlert, SunIcon, MoonIcon } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { resetPassword } from "../api/Login.api";
import { PASSWORD_MIN_LENGTH, passwordLengthError } from "../lib/password";

import logo from "../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The exact sentence `TOKEN_INVALIDO` in `api/src/controllers/password.controller.ts`
 * sends back for a token that is expired, already used, or never existed — the
 * same three causes worded identically on purpose, so this screen has nothing
 * left to distinguish either. Matched verbatim rather than by status code
 * alone: 400 is also what a perfectly good, still-usable token's *password*
 * gets refused with (too short, or on the server's common-password list —
 * see `password.ts`'s own comment on why that list is not mirrored here), and
 * that case must send the person back to retyping a password, not to
 * "solicite un enlace nuevo".
 *
 * **Exported so `ResetPasswordPage.test.tsx` can pin it against the real
 * source**, the same way `PASSWORD_MIN_LENGTH` in `lib/password.ts` is pinned
 * against `api/src/config/security.ts`. Two repositories cannot share a
 * constant, so a silent rename on the server's side would otherwise leave
 * this comparison matching nothing forever — every test here still green,
 * because they all check this constant against itself — while every dead
 * link on the real site fell into the generic error toast instead of the
 * "pide otro enlace" panel, for exactly the person who is already locked out.
 */
export const ENLACE_INVALIDO = "Este enlace ya no es válido. Solicite uno nuevo.";

/**
 * `/password/reset` is rate-limited by IP and, separately, by the token being
 * redeemed (see `passwordResetRateLimit` in `recoveryLimiters.ts`), and
 * neither bucket's own wording is guaranteed to survive axios's error mapping
 * in a shape worth printing. Same fix `PerfilPage.tsx` uses for its own 429s.
 */
const describeResetError = (status: number, message: string | null): string => {
  if (status === 429) return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  return message || "Ocurrió un error en el servidor.";
};

/**
 * «Elige tu nueva contraseña» — the second of the two public screens for
 * somebody who cannot log in at all. Reached only from the link a reset email
 * sends, `{origin}/nueva-contrasena#t=TOKEN`.
 *
 * **The token lives in the URL fragment, never the query string**, and that is
 * not cosmetic (see `task-9-brief.md`'s own reasoning, and
 * `password.controller.ts`'s `resetLinkFor`, which is the code that actually
 * builds the link this screen is opened from): a fragment never leaves the
 * browser, so it never reaches this server, a proxy, an access log, or the
 * `Referer` header of anything the page happens to load. This component's
 * whole job around that fact is the effect below — read it once, act on it
 * only in memory, and strip it out of the address bar *before* anything else
 * runs, so a single-use credential does not sit in the browser's history a
 * moment longer than necessary.
 *
 * The token is kept in a ref rather than state on purpose: it is read exactly
 * once, used only inside `submitReset`, and never needs to trigger a
 * re-render — putting it in state would be an invitation for some future
 * change to bind it to a control, log it, or otherwise let it leak out of
 * this closure.
 */
const ResetPasswordPage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const tokenRef = useRef<string | null>(null);
  // Guards against React 18 StrictMode's deliberate double invocation of
  // effects in development — the fragment is read and cleared exactly once
  // per real mount. Same guard, same reasoning, as `hashConsumedRef` in
  // `PerfilPage.tsx`'s own verification effect.
  const hashReadRef = useRef(false);

  useEffect(() => {
    if (hashReadRef.current) return;
    hashReadRef.current = true;

    const match = /^#t=(.+)$/.exec(window.location.hash);
    // Cleared unconditionally, before even checking whether the match
    // succeeded — the fragment must not survive in the address bar or the
    // browser's history a single render longer than it takes to read it once,
    // whether or not what was there turns out to be usable.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (!match) {
      // No token in the address at all — a bookmark, a forwarded link with
      // the fragment stripped by whatever carried it, or the page opened by
      // hand. There is nothing this screen could send that would ever
      // succeed, so it shows the same "pide otro enlace" panel a server
      // refusal would, rather than a password form that can only fail.
      setLinkInvalid(true);
      return;
    }
    tokenRef.current = decodeURIComponent(match[1]);
    // Once, on mount: this reads a one-shot credential out of the address the
    // browser was opened with, which does not reappear while the tab stays open.
  }, []);

  const submitReset = async () => {
    const token = tokenRef.current;
    if (!token) {
      setLinkInvalid(true);
      return;
    }
    setLoading(true);
    try {
      const response = await resetPassword(token, pass);
      if (response.status === 200) {
        toast.success(response.message || "Contraseña actualizada. Inicia sesión con tu contraseña nueva.");
        // Not `/app/home`: Global Constraint #9 — the reset revokes every
        // session on the account and opens none, so there is no session here
        // to send anybody into. Navigating anywhere but the login would show
        // a blank screen with a 401 behind it.
        navigate("/login", { replace: true });
        return;
      }
      if (response.status === 400 && response.message === ENLACE_INVALIDO) {
        setLinkInvalid(true);
      } else {
        toast.error(describeResetError(response.status, response.message));
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    }
    setLoading(false);
  };

  const handleSubmitClick = () => {
    if (!pass || !confirmPass) return toast.warning("Debe rellenar ambos campos de la nueva contraseña.");
    if (pass !== confirmPass) return toast.warning("Las contraseñas no coinciden.");
    const demasiadoCorta = passwordLengthError(pass);
    if (demasiadoCorta) return toast.warning(demasiadoCorta);
    submitReset();
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

        {linkInvalid ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Enlace no válido</h1>
            <p className="text-sm text-muted-foreground">{ENLACE_INVALIDO}</p>
            <Button
              className="h-11 rounded-xl text-sm font-bold uppercase tracking-widest mt-2"
              onClick={() => navigate("/olvide-contrasena")}
            >
              Solicitar un enlace nuevo
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col space-y-2 text-center mb-8">
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.18em]">
                Osefi srl · Sistema Interno
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Elige tu nueva contraseña
              </h1>
              <p className="text-sm text-muted-foreground pt-1">
                Debe tener al menos {PASSWORD_MIN_LENGTH} caracteres.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="pass" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Nueva contraseña
                </Label>
                <Input
                  id="pass"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-widest font-mono rounded-xl transition-all"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmitClick(); }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPass" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPass"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-widest font-mono rounded-xl transition-all"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmitClick(); }}
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 group"
                disabled={loading}
                onClick={handleSubmitClick}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Actualizar contraseña
                    <KeyRound className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {!linkInvalid && (
          <div className="mt-10 flex justify-center">
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
