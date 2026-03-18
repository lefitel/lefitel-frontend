import { useContext, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, LogIn, ShieldCheck, Activity, SunIcon, MoonIcon } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { SesionContext } from "../context/SesionContext";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { loginUsuario } from "../api/Login.api";

import logo from "../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const { theme, setTheme } = useTheme();
  const { setSesion } = useContext(SesionContext);
  const [login, setLogin] = useState<UsuarioInterface>(usuarioExample);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const from = !fromPath || fromPath === "/login" ? "/home" : fromPath;

  const ValidarDatos = async () => {
    if (login.user === "" || login.pass === "") {
      return toast.warning("Rellena todos los espacios");
    }
    setLoading(true);
    try {
      const responde = await loginUsuario(login);
      if (responde.status !== 500) {
        window.localStorage.setItem("token", responde.usuario?.token ?? "");
        setSesion(responde.usuario as SesionInterface);
        navigate(from, { replace: true });
        toast.success("Bienvenido");
      } else {
        toast.error(responde.message);
      }
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex lg:grid lg:grid-cols-2 bg-background">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="absolute top-4 right-4 z-50 h-9 w-9 rounded-full"
      >
        {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </Button>
      {/* PANEL IZQUIERDO (B2B Showcase) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-linear-to-br from-[#1e293b] via-[#334155] to-[#0f172a] opacity-95 transition-all" />

        {/* Decoracion de lineas */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

        <div className="relative z-20 flex items-center text-3xl font-bold tracking-tight gap-4 drop-shadow-sm">
          <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-xl overflow-hidden flex justify-center items-center">
            <img src={logo} alt="Lefitel Logo" className="h-10 w-auto scale-110" />
          </div>
          Lefitel srl
        </div>

        <div className="relative z-20 mt-auto">
          <div className="space-y-10 mb-14 px-2 text-left">
            <div className="flex items-start gap-5  ">
              <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg ">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div className=" w-full">
                <h3 className="font-semibold text-xl tracking-tight leading-none mb-2">Gestión de Postes y Eventos</h3>
                <p className="text-white/70 text-sm leading-relaxed ">Registra, consulta y da seguimiento a los postes y eventos de la red desde cualquier lugar.</p>
              </div>
            </div>
            <div className="flex items-start gap-5">
              <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-xl tracking-tight leading-none mb-2">Control de Acceso por Rol</h3>
                <p className="text-white/70 text-sm leading-relaxed ">Gerencia, supervisores y cuadrillas con acceso según sus responsabilidades.</p>
              </div>
            </div>
          </div>

          <blockquote className="space-y-3 border-l-[3px] border-primary pl-5">
            <p className="text-xl font-medium leading-relaxed italic text-white/90 max-w-lg">
              "Sistema de gestión interna para el mantenimiento y control de la red de Lefitel."
            </p>
            <footer className="text-sm font-semibold text-white/50 tracking-wider uppercase mt-5">Lefitel srl · Sistema Interno</footer>
          </blockquote>
        </div>
      </div>

      {/* PANEL DERECHO (Formulario Integrado) */}
      <div className="flex w-full items-center justify-center p-8 lg:p-14 relative z-10 bg-background md:bg-card md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.15)] dark:md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.5)] dark:md:border-l dark:md:border-border">
        <div className="mx-auto w-full max-w-[420px] pb-6">

          <div className="flex flex-col space-y-3 lg:text-left text-center">
            {/* Logo para Celular */}
            <div className="flex lg:hidden justify-center mb-6">
              <div className="bg-muted p-4 rounded-3xl border shadow-sm">
                <img src={logo} alt="Logo" className="h-14 w-auto drop-shadow-sm dark:invert" />
              </div>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-foreground/90">
              Bienvenido
            </h1>
            <p className="text-base text-muted-foreground mt-2 max-w-sm mx-auto lg:mx-0">
              Ingrese con su usuario y contraseña para acceder al sistema.
            </p>
          </div>

          {/* Formulario */}
          <div className="mt-10 space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-sm font-bold text-foreground focus-within:text-primary transition-colors uppercase tracking-wider">Usuario</Label>
                <Input
                  id="usuario"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect="off"
                  placeholder="ej. carlos.admin"
                  className="h-14 px-4 shadow-sm bg-muted/30 border-muted focus-visible:ring-primary/40 focus-visible:bg-transparent text-base rounded-xl transition-all"
                  onChange={(e) => setLogin({ ...login, user: e.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") ValidarDatos();
                  }}
                />
              </div>

              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contrasena" className="text-sm font-bold text-foreground focus-within:text-primary transition-colors uppercase tracking-wider">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => toast.info("Por favor, contacte con el administrador del sistema para restablecer su acceso.")}
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Input
                  id="contrasena"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="h-14 px-4 shadow-sm bg-muted/30 border-muted focus-visible:ring-primary/40 focus-visible:bg-transparent text-lg tracking-widest font-mono rounded-xl transition-all"
                  onChange={(e) => setLogin({ ...login, pass: e.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") ValidarDatos();
                  }}
                />
              </div>

              <Button
                className="mt-6 h-14 transition-all hover:shadow-lg hover:shadow-primary/20 group relative overflow-hidden text-base w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading}
                onClick={ValidarDatos}
              >
                {loading ? (
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span className="font-bold tracking-wide relative z-10 w-full flex items-center justify-center uppercase">
                      Iniciar Sesión
                      <LogIn className="ml-2.5 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </>
                )}
              </Button>
            </div>

            {/* Disclaimer inferior del form */}
            <p className="text-center text-xs text-muted-foreground pt-6">
              Sistema de uso interno · Lefitel srl
            </p>
          </div>

          <div className="lg:hidden mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
            <span>Powered by Lefitel srl © {new Date().getFullYear()}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
