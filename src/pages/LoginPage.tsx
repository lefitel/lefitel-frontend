import { useContext, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, LogIn, SunIcon, MoonIcon } from "lucide-react";
import { motion } from "motion/react";

import { useTheme } from "../components/theme-provider";
import { SesionContext } from "../context/SesionContext";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { loginUsuario } from "../api/Login.api";

import logo from "../assets/images/logo.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const brandStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
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
  const { theme, setTheme } = useTheme();
  const { setSesion } = useContext(SesionContext);
  const [login, setLogin] = useState<UsuarioInterface>(usuarioExample);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const from = !fromPath || fromPath === "/login" ? "/app/home" : fromPath;

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

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="absolute top-4 right-4 z-50 h-9 w-9 rounded-full"
      >
        {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </Button>

      {/* ── PANEL IZQUIERDO — Brand ── */}
      <div className="relative hidden lg:flex flex-col items-center justify-center p-16 text-white overflow-hidden">

        {/* Gradient base */}
        <div className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />

        {/* Grid animado */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0d_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0d_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]"
          style={{ animation: "grid-drift 22s linear infinite" }}
        />

        {/* Línea de acento superior */}
        <div className="absolute top-0 left-0 right-0 z-30 h-px overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-transparent via-white/30 to-transparent"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.6, ease }}
          />
        </div>

        {/* Contenido centrado */}
        <motion.div
          className="relative z-20 flex flex-col items-center text-center gap-6"
          variants={brandStagger}
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.8, ease }}
          >
            <img src={logo} alt="Osefi srl" className="logo-glow h-36 w-36 object-contain" />
          </motion.div>


          {/* Nombre */}
          <motion.div variants={fadeUp} transition={{ duration: 0.7, ease }} className="space-y-2">
            <h1 className="shimmer-text-light text-5xl font-bold tracking-tight">Osefi srl</h1>
            <p className="text-white/45 text-xs font-medium tracking-[0.2em] uppercase">
              Telecomunicaciones e Infraestructuras
            </p>
          </motion.div>

          {/* Tagline */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7, ease }}
            className="text-white/30 text-sm max-w-xs leading-relaxed"
          >
            Sistema de gestión interna para el control y mantenimiento de la red.
          </motion.p>
        </motion.div>

        {/* Footer del panel */}
        <motion.p
          className="absolute bottom-8 z-20 text-white/20 text-xs tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          Sistema Interno · © {new Date().getFullYear()}
        </motion.p>
      </div>

      {/* ── PANEL DERECHO — Formulario ── */}
      <div className="flex w-full items-center justify-center p-8 lg:p-14 relative z-10 bg-background md:bg-card md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.12)] dark:md:shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.5)] dark:md:border-l dark:md:border-border">
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
              <div className="bg-muted p-4 rounded-3xl border shadow-sm">
                <img src={logo} alt="Logo" className="h-14 w-auto drop-shadow-sm dark:invert" />
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
                onChange={(e) => setLogin({ ...login, user: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") ValidarDatos(); }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="contrasena" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Contraseña
                </Label>
                <button
                  type="button"
                  onClick={() => toast.info("Contacte con el administrador del sistema para restablecer su acceso.")}
                  className="text-xs text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <Input
                id="contrasena"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                className="h-12 px-4 bg-muted/40 border-muted focus-visible:ring-primary/30 focus-visible:bg-transparent text-lg tracking-widest font-mono rounded-xl transition-all"
                onChange={(e) => setLogin({ ...login, pass: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") ValidarDatos(); }}
              />
            </div>

            <Button
              className="mt-2 h-12 w-full rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-primary/20 group"
              disabled={loading}
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
