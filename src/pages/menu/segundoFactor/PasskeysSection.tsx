import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRoundIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "./CampoDialogo";
import { deleteCredential, listCredentials, type Credencial } from "../../../api/Webauthn.api";
import { cancelarCeremonia, registrarPasskey, soportaPasskeys } from "../../../api/passkeyCeremony";
import { describeStepUpError, CODIGO_STEP_UP } from "../../../api/Mfa.api";
import { comprobarToken } from "../../../api/Login.api";
import { SesionContext } from "../../../context/SesionContext";
import { describirDispositivo } from "../../../lib/dispositivo";
import { RecoveryCodesRevealDialog } from "./RecoveryCodesRevealDialog";
import { SeccionFactor, type FilaDePerfil } from "./SeccionFactor";

/** `code` del 500 que significa «la llave se borró, las sesiones no» — copiado
 *  de `api/src/controllers/webauthn.controller.ts`, formato de cable. */
const CODIGO_REVOCACION_FALLIDA = "REVOCACION_FALLIDA";

const NOMBRE_MAX = 100;

const fecha = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : "nunca";

/**
 * Llaves de acceso (passkeys) — plan 4C, Tarea 11. Primera de las tres
 * secciones de la pantalla, porque es el método recomendado: un gesto, sin
 * teclear, y a prueba de phishing porque la llave sólo firma para el dominio
 * en que se creó.
 *
 * **La contraseña se pide aquí y viaja en las dos peticiones del registro**, en
 * vez de dejar que la ventana global la pida: son dos rutas con puerta y un
 * diálogo biométrico entre medias, y el reto del servidor caduca a los dos
 * minutos. Ver `Webauthn.api.ts`.
 *
 * **Borrar la última llave cierra todas las sesiones, la de este navegador
 * incluida.** El servidor lo dice en `sesion_cerrada`, y esta sección hace dos
 * cosas con eso: enseña el mensaje en un toast largo —un texto en línea moriría
 * con la navegación al login que provoca el siguiente 401— y **no** vuelve a
 * pedir la lista, porque esa petición sería el 401 y pondría un segundo aviso
 * contradictorio encima del primero.
 *
 * **Cada llave se quita desde la lista, que es lo primero que se ve**, por
 * el mismo motivo que `TotpSection` pone «Quitar» antes que «Añadir»: quien
 * perdió el aparato tiene una llave muerta pero registrada, y cada vuelta por
 * una puerta que la exige cuesta un código de recuperación.
 *
 * `comprobarToken` + `setSesion` tras un alta, como `TotpSection`: el servidor
 * acaba de promover la sesión y el resto de la pantalla tiene que enterarse
 * (hallazgo E-3/F12).
 *
 * **Dos formas, la misma sección**: tarjeta en `/app/segundo-factor`, fila de
 * «Acceso y seguridad» en el perfil cuando llega `fila`. Ver `SeccionFactor`.
 */
const PasskeysSection = ({
  fila,
  onCodigosEmitidos,
}: {
  fila?: FilaDePerfil;
  /** El alta acaba de emitir los diez códigos: quien enseñe su recuento debe volver a leerlo. */
  onCodigosEmitidos?: () => void;
}) => {
  const { sesion, setSesion, logout } = useContext(SesionContext);
  // Una sola vez: es una propiedad del navegador, no cambia durante la vida
  // de la página.
  const [soportado] = useState(() => soportaPasskeys());

  // Salir de la pantalla con el diálogo del sistema abierto lo deja huérfano
  // sobre la pantalla siguiente — aquí, la del login, si la sesión caduca a
  // mitad del registro. El mismo cierre que las otras tres pantallas de llave.
  useEffect(() => () => cancelarCeremonia(), []);

  // ── La lista ─────────────────────────────────────────────────────────────
  const [llaves, setLlaves] = useState<Credencial[] | null>(null);
  const [cargando, setCargando] = useState(true);
  // Sólo la última petición de la lista escribe: la del montaje puede seguir en
  // vuelo mientras un alta termina —la ceremonia le da varios segundos de
  // ventaja— y sin esto su respuesta rancia pisaría la lista con la llave
  // recién creada. Un contador, no un `vigente`: también ordena dos `cargar()`
  // que se solapen, y en desarrollo el doble montaje de StrictMode.
  const generacion = useRef(0);

  const cargar = async () => {
    const mia = ++generacion.current;
    setCargando(true);
    const res = await listCredentials();
    if (mia !== generacion.current) return;
    setLlaves(res.credenciales);
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
    // `cargar` no lee ningún estado, así que una sola vez al montar es correcto.
  }, []);

  // ── Quitar ───────────────────────────────────────────────────────────────
  const [bajaDe, setBajaDe] = useState<Credencial | null>(null);
  const [passwordBaja, setPasswordBaja] = useState("");
  const [confirmBajaAbierto, setConfirmBajaAbierto] = useState(false);
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState<string | null>(null);

  // Kept after the dialog closes: its title is still on screen while it
  // animates out, and would otherwise blink to an empty name.
  const [nombreBaja, setNombreBaja] = useState("");

  const abrirBaja = (llave: Credencial) => {
    setBajaDe(llave);
    setNombreBaja(llave.nombre);
    setPasswordBaja("");
    setErrorBaja(null);
  };

  const cancelarBaja = () => {
    setBajaDe(null);
    setPasswordBaja("");
    setErrorBaja(null);
  };

  const pedirQuitar = () => {
    if (!passwordBaja) return toast.warning("Debes escribir tu contraseña actual.");
    setConfirmBajaAbierto(true);
  };

  const quitarLlave = async () => {
    setConfirmBajaAbierto(false);
    if (!bajaDe) return;
    setEnviandoBaja(true);
    setErrorBaja(null);
    try {
      const res = await deleteCredential(bajaDe.id, passwordBaja);
      if (res.status === 200) {
        // Diez segundos: si era la última llave, la siguiente petición saca a
        // la persona al login y este toast es lo único que sobrevive.
        toast.success(res.message || "Llave eliminada.", { duration: 10000 });
        cancelarBaja();
        if (res.sesionCerrada) {
          // 🔴 El servidor acaba de cerrar la sesión de este navegador. Sin
          // esto la persona se queda en una pantalla entera —lista, botones,
          // las otras dos secciones— con una sesión muerta, y nada la saca:
          // no hay sondeo, y el temporizador de caducidad apunta a la fecha
          // original. Se iría al login a mitad del siguiente formulario, con
          // la contraseña tecleada perdida. `logout()` la lleva ahora; el
          // toast vive fuera del router y sobrevive al viaje.
          logout();
          return;
        }
        await cargar();
      } else if (res.status === 404) {
        toast.info(res.message || "Esa llave ya no existe.");
        cancelarBaja();
        await cargar();
      } else if (res.code === CODIGO_REVOCACION_FALLIDA) {
        // La llave se borró y las sesiones no se cerraron: el remedio está en
        // la frase, y la lista ya no tiene esa llave.
        toast.error(res.message || "No se pudieron cerrar tus sesiones.", { duration: 15000 });
        cancelarBaja();
        await cargar();
      } else if (res.code === CODIGO_STEP_UP) {
        setErrorBaja(describeStepUpError(res.motivo, res.message));
      } else {
        setErrorBaja(res.message || "Ocurrió un error en el servidor.");
      }
    } catch {
      setErrorBaja("No se pudo conectar con el servidor.");
    }
    setEnviandoBaja(false);
  };

  // ── Registrar ────────────────────────────────────────────────────────────
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [nombreAlta, setNombreAlta] = useState("");
  const [passwordAlta, setPasswordAlta] = useState("");
  const [enviandoAlta, setEnviandoAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [codigosRecuperacion, setCodigosRecuperacion] = useState<string[] | null>(null);

  // «Chrome en Windows», leído del navegador: un punto de partida que la
  // persona puede retocar, para que el campo obligatorio no la reciba vacío.
  // Vacío si no se pudo leer nada — un nombre inventado sería peor que pedirlo.
  const [nombreSugerido] = useState(() => describirDispositivo(navigator.userAgent).nombre ?? "");

  const abrirAlta = () => {
    setAltaAbierta(true);
    setNombreAlta(nombreSugerido);
    setErrorAlta(null);
  };

  const cancelarAlta = () => {
    setAltaAbierta(false);
    setNombreAlta("");
    setPasswordAlta("");
    setErrorAlta(null);
  };

  const registrar = async () => {
    const nombre = nombreAlta.trim();
    if (!nombre) return toast.warning("Ponle un nombre a la llave: «mi móvil», «el portátil del trabajo»…");
    if (nombre.length > NOMBRE_MAX) return toast.warning(`El nombre no puede pasar de ${NOMBRE_MAX} caracteres.`);
    if (!passwordAlta) return toast.warning("Debes escribir tu contraseña actual.");
    setEnviandoAlta(true);
    setErrorAlta(null);
    try {
      // Desde el clic y sin nada en medio: el diálogo del sistema exige
      // activación reciente en Safari.
      const res = await registrarPasskey(nombre, passwordAlta);
      if (res.ok) {
        toast.success("Tu llave quedó registrada.");
        cancelarAlta();
        await cargar();
        // El servidor acaba de promover la sesión; esto es lo que se lo dice
        // a este navegador. `/auth/me` es la única autoridad para esa forma.
        const yo = await comprobarToken();
        if (yo.status === 200 && yo.usuario) {
          setSesion({
            usuario: yo.usuario,
            permisos: yo.permisos,
            estado: yo.estado,
            autenticado: yo.estado !== "parcial",
          });
        }
        // Sólo cuando esta llave es el primer factor y no había hoja sin
        // gastar: los diez códigos, una sola vez, con acuse obligatorio.
        if (res.codigos) {
          setCodigosRecuperacion(res.codigos);
          onCodigosEmitidos?.();
        }
      } else if (res.cancelado) {
        // Cerró el diálogo del sistema. No es un error: el nuestro se queda
        // abierto como estaba, con el nombre y la contraseña, para repetir.
      } else if (res.code === CODIGO_STEP_UP) {
        setErrorAlta(describeStepUpError(res.motivo, res.message));
      } else {
        setErrorAlta(res.message);
      }
    } catch {
      setErrorAlta("No se pudo conectar con el servidor.");
    }
    setEnviandoAlta(false);
  };

  const resumen = () => {
    if (cargando) return <Skeleton className="h-5 w-24 inline-block" />;
    if (llaves === null) return <span className="text-destructive">No se pudo cargar</span>;
    if (llaves.length === 0) {
      return (
        <>
          {/* Not "Sin configurar": the recovery address in the next row already
              says that, and `PerfilPage.test.tsx` reads it by its text. */}
          <Badge variant="outline" className="text-muted-foreground font-normal">
            Ninguna registrada
          </Badge>
          <span className="text-muted-foreground">Huella, cara o PIN en lugar de la contraseña</span>
        </>
      );
    }
    return <span>{llaves.length === 1 ? "1 registrada" : `${llaves.length} registradas`}</span>;
  };

  const dialogos = (
    <>
      <FormDialog
        open={altaAbierta}
        onClose={cancelarAlta}
        size="sm"
        title="Añadir una llave de acceso"
        description="Confirma con tu contraseña que eres tú. Después, tu dispositivo te pedirá la huella, la cara o el PIN."
        dirty={nombreAlta !== nombreSugerido || passwordAlta !== ""}
        saving={enviandoAlta}
        submitLabel="Crear la llave"
        savingLabel="Esperando a tu dispositivo…"
        onSubmit={() => void registrar()}
        bodyClassName="space-y-4"
      >
        <CampoDialogo
          id="passkey-alta-nombre"
          label="Nombre de la llave"
          requerido
          ayuda="Para reconocerla en tu lista si algún día tienes que quitarla. Puedes cambiarlo."
        >
          {/* `data-no-autofocus`: el nombre ya viene escrito, así que el
              cursor empieza en la contraseña, que es lo que falta. */}
          <Input
            id="passkey-alta-nombre"
            data-no-autofocus
            value={nombreAlta}
            onChange={(e) => setNombreAlta(e.target.value)}
            placeholder="mi móvil, el portátil del trabajo…"
            maxLength={NOMBRE_MAX}
            autoComplete="off"
          />
        </CampoDialogo>
        <CampoDialogo id="passkey-alta-password" label="Contraseña actual" requerido>
          <Input
            id="passkey-alta-password"
            type="password"
            value={passwordAlta}
            onChange={(e) => setPasswordAlta(e.target.value)}
            className="font-mono"
            autoComplete="current-password"
          />
        </CampoDialogo>
        {errorAlta && <p role="alert" className="text-sm text-destructive">{errorAlta}</p>}
      </FormDialog>

      <FormDialog
        open={bajaDe !== null}
        onClose={cancelarBaja}
        size="sm"
        title={`Quitar la llave «${nombreBaja}»`}
        description="Confirma con tu contraseña que eres tú."
        dirty={passwordBaja !== ""}
        saving={enviandoBaja}
        submitLabel="Quitar llave"
        savingLabel="Quitando…"
        destructive
        onSubmit={pedirQuitar}
        bodyClassName="space-y-4"
      >
        <CampoDialogo id="passkey-quitar-password" label="Contraseña actual" requerido>
          <Input
            id="passkey-quitar-password"
            type="password"
            value={passwordBaja}
            onChange={(e) => setPasswordBaja(e.target.value)}
            className="font-mono"
            autoComplete="current-password"
          />
        </CampoDialogo>
        {errorBaja && <p role="alert" className="text-sm text-destructive">{errorBaja}</p>}
      </FormDialog>

      {/* Confirm: quitar la llave */}
      <AlertDialog open={confirmBajaAbierto} onOpenChange={(o) => !o && setConfirmBajaAbierto(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta llave?</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Plan 4E: con correo verificado la última llave no deja la cuenta
                  sin factor, y el servidor no cierra las sesiones en ese caso
                  (`deleteCredential` sólo revoca cuando no queda ningún factor). */}
              {sesion?.usuario?.email_verified_at
                ? "Dejará de servir para entrar. Si es tu última llave, tu correo verificado sigue siendo tu segundo factor: entrarás con un código enviado a él, y tus sesiones no se cierran. Los códigos de recuperación no cuentan como un factor."
                : "Dejará de servir para entrar. Si es tu último factor, se cerrarán todas tus sesiones —esta incluida— y a partir de ahora entrarás sólo con tu contraseña; los códigos de recuperación no cuentan como un factor y no evitan esto."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmBajaAbierto(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={quitarLlave}
              className="bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90"
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecoveryCodesRevealDialog
        codigos={codigosRecuperacion}
        onAcknowledge={() => setCodigosRecuperacion(null)}
        contexto="Tu llave ya está activa. Estos diez códigos son tu única forma de entrar si alguna vez pierdes el dispositivo donde la registraste."
      />
    </>
  );

  return (
    <SeccionFactor
      titulo="Llaves de acceso"
      icon={KeyRoundIcon}
      fila={fila}
      etiqueta="Llave de acceso"
      resumen={resumen()}
      abrirLabel="Gestionar llaves de acceso"
      dialogos={dialogos}
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          La huella, la cara o el PIN de tu móvil u ordenador, en lugar de un código. Es el método
          recomendado: un solo gesto, y una llave sólo funciona en esta dirección, así que una
          página falsa no puede pedírtela.
        </p>

        <section className="space-y-3" aria-labelledby="passkeys-lista-heading">
          {/* The one way to add a key sits beside the list it adds to. It
              used to be a second section below, with a heading and a button
              that said the same thing twice. */}
          <div className="flex items-center justify-between gap-3">
            <h3 id="passkeys-lista-heading" className="text-sm font-medium">
              Tus llaves
            </h3>
            {soportado && (
              <Button size="sm" variant="outline" onClick={abrirAlta}>
                <PlusIcon className="h-4 w-4 mr-1.5" aria-hidden />
                Añadir llave
              </Button>
            )}
          </div>

          {cargando && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
              Cargando…
            </p>
          )}

          {!cargando && llaves === null && (
            <p className="text-sm text-destructive">No se pudo cargar la lista de llaves.</p>
          )}

          {!cargando && llaves !== null && llaves.length === 0 && (
            <p className="text-sm text-muted-foreground">No tienes ninguna llave registrada.</p>
          )}

          {!cargando && llaves !== null && llaves.length > 0 && (
            <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
              {llaves.map((llave) => (
                <li key={llave.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{llave.nombre}</p>
                    {/* Las fechas son lo único que separa dos llaves con el
                        mismo nombre: no hay unicidad ni renombrado. */}
                    <p className="text-xs text-muted-foreground">
                      Registrada el {fecha(llave.created_at)} · Último uso: {fecha(llave.last_used_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => abrirBaja(llave)}
                    disabled={bajaDe?.id === llave.id}
                    aria-label={`Quitar la llave ${llave.nombre}`}
                  >
                    <Trash2Icon className="h-4 w-4 mr-1.5" aria-hidden />
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!soportado && (
            <p className="text-sm text-muted-foreground">
              Este navegador no puede crear llaves de acceso. Puedes seguir quitando las que ya
              tienes; para añadir una nueva, entra desde un navegador actual o desde tu móvil.
            </p>
          )}
        </section>
      </div>
    </SeccionFactor>
  );
};

export default PasskeysSection;
