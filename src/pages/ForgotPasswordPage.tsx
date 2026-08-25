import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Loader2, MailIcon, SendIcon, SunIcon, MoonIcon, ArrowLeft } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { forgotPassword } from "../api/Login.api";

import logo from "../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The same loose shape check `PerfilPage.tsx` runs before spending a
 * confirmation on an address that was never going to pass, and `EMAIL_SHAPE`
 * in `password.controller.ts` server-side. Copied rather than shared for the
 * same reason it is copied there: this repository and the API cannot import
 * from each other, and the check is a cheap filter against a typo, not the
 * boundary that actually decides anything — the server still does that.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/password/forgot` can be rate-limited from three different buckets — by
 * address, by IP, and a daily backstop shared by the whole company (see
 * `passwordForgotRateLimit` in `recoveryLimiters.ts`) — and nothing here
 * guarantees their wording survives axios's error mapping in a shape worth
 * printing. Same fix `PerfilPage.tsx` uses for its own 429s: override the
 * sentence for that one status instead of trusting whatever came back.
 */
const describeForgotError = (status: number, message: string | null): string => {
  if (status === 429) return "Has hecho demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.";
  return message || "Ocurrió un error en el servidor.";
};

/**
 * «¿Olvidaste tu contraseña?» — the first of the two public screens for
 * somebody who cannot log in at all, reached from `LoginPage.tsx`'s own link.
 *
 * The one rule this screen exists to obey: `/password/forgot` answers the
 * exact same 200 whether or not an address has an account behind it, and
 * whether or not that account's email is verified — Global Constraint #1, and
 * the reason the server sends that answer *before* doing any of the real work
 * (see `password.controller.ts`'s module comment on the timing side-channel a
 * naive "look it up first" shape would open). This component has nothing to
 * add on top of that: there is no branch anywhere below keyed on whether the
 * address turned out to exist, because the server never tells it. Showing
 * `response.message` verbatim, rather than a sentence written here, is what
 * keeps it that way even if the exact wording changes on the server someday.
 */
const ForgotPasswordPage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const direccion = email.trim();
    if (!direccion) return toast.warning("Debe indicar una dirección de correo.");
    if (!EMAIL_SHAPE.test(direccion)) return toast.warning("Debe indicar una dirección de correo válida.");

    setLoading(true);
    try {
      const response = await forgotPassword(direccion);
      if (response.status === 200) {
        // Kept on screen rather than only as a toast: a toast fades in a few
        // seconds, and this is the one message the person actually needs to
        // read carefully — it does not say whether anything was found.
        setSentMessage(response.message || "Si la dirección corresponde a una cuenta, se envió un enlace.");
      } else {
        toast.error(describeForgotError(response.status, response.message));
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    }
    setLoading(false);
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

        {sentMessage === null ? (
          <>
            <div className="flex flex-col space-y-2 text-center mb-8">
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.18em]">
                Osefi srl · Sistema Interno
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-sm text-muted-foreground pt-1">
                Ingresa tu correo de recuperación y te enviaremos un enlace para elegir una contraseña nueva.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Correo de recuperación
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu.correo@ejemplo.com"
                  className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-base rounded-xl transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 group"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Enviar enlace
                    <SendIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <MailIcon className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground">{sentMessage}</p>
            <button
              type="button"
              onClick={() => setSentMessage(null)}
              className="text-xs text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              Usar otra dirección
            </button>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
