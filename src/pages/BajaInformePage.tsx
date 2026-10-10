import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MailX, CheckCircle2, ShieldAlert, WifiOff, SunIcon, MoonIcon } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { confirmarBaja, consultarBaja, type DatosDeBaja } from "../api/Programacion.api";

import logo from "../assets/images/logo.png";

import { Button } from "@/components/ui/button";

/**
 * Where an outside address lands from the "stop these" link of a scheduled
 * report. Public: whoever opens it has no account here.
 *
 * **Opening this page unsubscribes nobody.** It asks the server what the link
 * is for, shows it, and waits for a button. Mail scanners open every link in a
 * message — many companies' filters do — and if arriving were enough, those
 * recipients would be unsubscribed the moment the email reached them.
 *
 * **The token arrives in the fragment** (`#t=…`), which a browser never sends
 * to any server, and is taken out of the address bar as soon as it is read —
 * the same handling `ResetPasswordPage` gives its own. It lives in a ref, not
 * in state: it is read once and used by two requests, and nothing on screen
 * should ever be bound to it.
 */

type Vista =
  | { tipo: "cargando" }
  | { tipo: "lista"; datos: DatosDeBaja }
  | { tipo: "hecho"; informe: string | null }
  | { tipo: "invalido" }
  | { tipo: "sin-conexion" };

const estadoDe = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

const BajaInformePage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [vista, setVista] = useState<Vista>({ tipo: "cargando" });
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const leidoRef = useRef(false);

  const consultar = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return setVista({ tipo: "invalido" });
    setVista({ tipo: "cargando" });
    try {
      const datos = await consultarBaja(token);
      setVista(datos.deBaja ? { tipo: "hecho", informe: datos.informe } : { tipo: "lista", datos });
    } catch (error) {
      // Only the server saying "I do not know this link" makes it a bad link.
      // A server that could not be reached says nothing about the link, and
      // telling somebody their way out does not exist is the wrong thing to
      // get wrong.
      setVista(estadoDe(error) === 404 ? { tipo: "invalido" } : { tipo: "sin-conexion" });
    }
  }, []);

  useEffect(() => {
    if (leidoRef.current) return;
    leidoRef.current = true;

    const match = /^#t=(.+)$/.exec(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    tokenRef.current = match ? decodeURIComponent(match[1]) : null;
    void consultar();
  }, [consultar]);

  const confirmar = async () => {
    const token = tokenRef.current;
    if (!token || enviando || vista.tipo !== "lista") return;
    setEnviando(true);
    setAviso(null);
    try {
      await confirmarBaja(token);
      setVista({ tipo: "hecho", informe: vista.datos.informe });
    } catch (error) {
      const estado = estadoDe(error);
      if (estado === 404) setVista({ tipo: "invalido" });
      else if (estado === 429) setAviso("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
      else setAviso("No se pudo completar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const nombre = (informe: string | null) => (informe ? `«${informe}»` : "este informe");

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-background p-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cambiar entre tema claro y oscuro"
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

        <div className="flex flex-col items-center text-center space-y-4">
          {vista.tipo === "cargando" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground" role="status">Comprobando el enlace…</p>
            </>
          )}

          {vista.tipo === "lista" && (
            <>
              <div className="p-3 bg-muted rounded-full">
                <MailX className="h-6 w-6 text-foreground" aria-hidden />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">¿Dejar de recibir este informe?</h1>
              <p className="text-sm text-muted-foreground">
                Dejarás de recibir por correo {nombre(vista.datos.informe)}
                {vista.datos.programadoPor ? `, que programó ${vista.datos.programadoPor} en Osefi` : ""}.
              </p>
              {aviso && (
                <p role="alert" className="text-sm text-destructive">{aviso}</p>
              )}
              <Button
                className="h-11 rounded-xl text-sm font-bold uppercase tracking-widest mt-2"
                disabled={enviando}
                onClick={confirmar}
              >
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Dejar de recibirlo
              </Button>
            </>
          )}

          {vista.tipo === "hecho" && (
            <>
              <div className="p-3 bg-muted rounded-full">
                <CheckCircle2 className="h-6 w-6 text-foreground" aria-hidden />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Ya no lo recibirás</h1>
              <p className="text-sm text-muted-foreground">
                No volveremos a enviarte {nombre(vista.informe)} a esta dirección. Puedes cerrar esta página.
              </p>
            </>
          )}

          {vista.tipo === "invalido" && (
            <>
              <div className="p-3 bg-destructive/10 rounded-full">
                <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Enlace no válido</h1>
              <p className="text-sm text-muted-foreground">
                Este enlace no es válido. Ábrelo directamente desde el correo que recibiste, sin copiarlo a mano.
              </p>
            </>
          )}

          {vista.tipo === "sin-conexion" && (
            <>
              <div className="p-3 bg-muted rounded-full">
                <WifiOff className="h-6 w-6 text-foreground" aria-hidden />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">No se pudo comprobar el enlace</h1>
              <p className="text-sm text-muted-foreground">
                No hemos podido conectar con el servidor. Tu enlace sigue siendo válido.
              </p>
              <Button
                className="h-11 rounded-xl text-sm font-bold uppercase tracking-widest mt-2"
                onClick={() => void consultar()}
              >
                Reintentar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BajaInformePage;
