// La ventana que pide la identidad, una sola para toda la aplicación.
//
// El servidor exige una prueba fresca antes de una veintena de operaciones
// delicadas. Quien las dispara no tiene que saberlo: `stepUpInterceptor.ts`
// detecta el rechazo, esta ventana pide lo que falte, y la petición original se
// reenvía sola con lo tecleado. Nadie pierde un formulario a medias.
//
// **Se monta una vez, junto al `Toaster` y fuera de las rutas.** Dentro de
// `Routes` desaparecería al navegar; y lo que importa más: cuando la sesión
// caduca por debajo, `PrivateRoutes` redirige al login, y una ventana montada
// dentro se desmontaría **mientras la persona teclea**, dejando colgadas las
// peticiones que esperaban su respuesta —ni resueltas ni rechazadas, con los
// indicadores de carga girando en componentes que ya no existen.
//
// **Tres caminos para cubrir el factor, desde el plan 4C**: el código de la
// aplicación, un código de recuperación, y la llave de acceso (passkey). Cuál
// se dibuja lo dice el servidor en `metodos`; sin ese campo —un servidor
// anterior— se dibuja lo de siempre.

import { useCallback, useEffect, useRef, useState } from "react";
import { useContext } from "react";
import { SesionContext } from "@/context/SesionContext";
import {
  registrarResolvedorStepUp,
  type PeticionStepUp,
  type ResultadoStepUp,
} from "@/api/stepUpInterceptor";
import {
  MOTIVO_SIN_FACTOR_RECIENTE,
  describeMetodos,
  describeStepUpError,
} from "@/api/stepUp";
import { probarStepUp } from "@/api/Mfa.api";
import { comprobarToken, verifySecondFactor } from "@/api/Login.api";
import { cancelarCeremonia, probarPasskey, soportaPasskeys } from "@/api/passkeyCeremony";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRoundIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";

interface Pendiente {
  peticion: PeticionStepUp;
  resolver: (r: ResultadoStepUp | null) => void;
}

export const StepUpDialog = () => {
  const { sesion, setSesion } = useContext(SesionContext);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /**
   * La llave: si ya se probó en esta ceremonia, si se está probando, y qué
   * dijo el navegador o el servidor cuando no salió.
   *
   * 🔴 **Probar la llave NO resuelve la ceremonia.** Sólo deja `factorProbado`
   * a `true`; quien resuelve sigue siendo «Confirmar», con la contraseña dentro
   * si la ruta la pidió. El interceptor entrega **el mismo** resultado a todas
   * las peticiones que esperaban en cola, y si la llave resolviera con `{}`,
   * las que necesitaban `exigeContrasena` se reintentarían sin contraseña, se
   * comerían su segundo reintento y morirían en silencio (deuda C5 del 4D).
   */
  const [factorProbado, setFactorProbado] = useState(false);
  const [probandoLlave, setProbandoLlave] = useState(false);
  const [errorLlave, setErrorLlave] = useState<string | null>(null);
  /**
   * Lo que el servidor dijo que queda, y **de qué contador habla**.
   *
   * 🔴 Son dos cosas distintas con el mismo nombre, y contarlas igual produce
   * una frase falsa en pantalla:
   *
   * - **`"cuenta"`** — los códigos. Cinco fallos bloquean la cuenta entera del
   *   ERP (1, 2, 4, 8, hasta 15 minutos) y hace falta un administrador, o
   *   esperar. Lo cuenta `usuarios.failed_attempts`.
   * - **`"espera"`** — la contraseña. Cinco fallos agotan un cupo de ritmo de
   *   quince minutos y el servidor contesta 429. **La cuenta NO se bloquea**:
   *   `verifyOwnPassword` no toca el contador de bloqueo, a propósito. Un
   *   administrador «desbloqueando» a esa persona no arreglaría nada, porque no
   *   hay nada bloqueado.
   */
  const [restantes, setRestantes] = useState<
    { n: number; de: "cuenta" | "espera" } | undefined
  >(undefined);

  /**
   * El estado de la sesión en una referencia, y no leído del contexto dentro
   * del resolvedor.
   *
   * El resolvedor se registra una sola vez —a propósito: volver a registrarlo
   * en cada cambio de sesión abriría una carrera con una ceremonia en curso—,
   * así que la clausura vería para siempre el estado que hubiera al montar.
   * Una referencia lo mantiene fresco sin volver a registrar nada.
   */
  const estadoRef = useRef(sesion?.estado);
  // En un efecto y no durante el render: escribir una referencia mientras se
  // pinta hace que React no pueda garantizar que el componente se actualice
  // como se espera. El desfase de un commit no importa aquí — este valor sólo
  // se lee cuando alguien pulsa «Confirmar», mucho después de pintar.
  useEffect(() => {
    estadoRef.current = sesion?.estado;
  }, [sesion?.estado]);

  useEffect(() => {
    registrarResolvedorStepUp(
      (peticion) =>
        new Promise<ResultadoStepUp | null>((resolve) => {
          setCodigo("");
          setPassword("");
          setError(null);
          setFactorProbado(false);
          setErrorLlave(null);
          // El contador que llega con el rechazo habla del cupo de la
          // contraseña: es `requireStepUp` quien lo cuenta, y sólo lo pone al
          // rechazar una contraseña equivocada.
          setRestantes(
            typeof peticion.intentosRestantes === "number"
              ? { n: peticion.intentosRestantes, de: "espera" }
              : undefined,
          );
          setPendiente({ peticion, resolver: resolve });
        }),
    );
    return () => registrarResolvedorStepUp(null);
  }, []);

  /**
   * Cerrar la ventana cuando la ceremonia se corta desde fuera.
   *
   * Ocurre al cerrarse la sesión por debajo — caducidad, o una revocación
   * desde otro equipo. Sin esto, la ventana se queda **encima de la pantalla
   * de login**, tapándola, esperando a alguien que ya no tiene sesión con la
   * que responder; y si además teclea y confirma, la contraseña sale hacia una
   * cookie muerta. La promesa ya la resolvió quien abortó, así que aquí sólo
   * hay que recoger la pantalla — y abortar el diálogo del sistema si la llave
   * estaba a medias, que si no se queda abierto sobre el login.
   */
  useEffect(() => {
    const señal = pendiente?.peticion.signal;
    if (!señal) return;
    if (señal.aborted) {
      setPendiente(null);
      return;
    }
    const alAbortar = () => {
      cancelarCeremonia();
      setPendiente(null);
      setPassword("");
      setCodigo("");
    };
    señal.addEventListener("abort", alAbortar);
    return () => señal.removeEventListener("abort", alAbortar);
  }, [pendiente]);

  const cerrar = useCallback(
    (resultado: ResultadoStepUp | null) => {
      pendiente?.resolver(resultado);
      setPendiente(null);
      // La contraseña no se queda en memoria un instante más de lo necesario.
      setPassword("");
      setCodigo("");
    },
    [pendiente],
  );

  /**
   * Volver a leer la sesión de `/auth/me` después de probar un factor.
   *
   * 🔴 El servidor acaba de **promover** la sesión —`onboarding` → `completa`—
   * y esta pantalla no lo sabía. Sin esto, `App.tsx` sigue leyendo
   * `onboarding` del contexto y pulsar «Inicio» devuelve a la persona a la
   * pantalla del segundo factor que acaba de superar (hallazgo E-3/F12, el
   * mismo que `TotpSection` ya arregla con esta pareja). `/auth/me` es la única
   * autoridad para esa forma; nada se deduce del cuerpo de la prueba.
   */
  const refrescarSesion = async () => {
    const yo = await comprobarToken();
    if (yo.status === 200 && yo.usuario) {
      setSesion({
        usuario: yo.usuario,
        permisos: yo.permisos,
        estado: yo.estado,
        autenticado: yo.estado !== "parcial",
      });
    }
  };

  if (!pendiente) return null;

  const { motivo, exigeContrasena, metodos } = pendiente.peticion;
  const pideFactor = motivo === MOTIVO_SIN_FACTOR_RECIENTE;
  // La contraseña se pide siempre que el motivo la nombre, y además cuando el
  // servidor avisó de que vendrá después del factor. Ese aviso es lo único que
  // permite pedir las dos cosas de una vez, en vez de encadenar dos ventanas
  // justo en las operaciones más delicadas.
  const pidePassword = !pideFactor || exigeContrasena;

  /**
   * Qué se dibuja para cubrir el factor, según `metodos`.
   *
   * - Ausente (servidor anterior): el campo del código, como siempre.
   * - Con `passkey`: el botón de la llave, si este navegador puede.
   * - Con `totp` o `codigo`: el campo del código.
   * - Vacía: **nada que teclear** — un aviso y el botón de cancelar. Es la
   *   cuenta cuyo único factor no se puede comprobar ahora mismo; pintarle el
   *   formulario de siempre es dejarla tecleando contra un 503.
   * - Sólo `passkey` en un navegador sin WebAuthn: tampoco hay nada que
   *   teclear, y la frase dice por qué.
   */
  const servidorOfreceLlave = pideFactor && metodos !== undefined && metodos.includes("passkey");
  const ofreceLlave = servidorOfreceLlave && soportaPasskeys();
  const ofreceTotp = pideFactor && (metodos === undefined || metodos.includes("totp"));
  const ofreceRecuperacion = pideFactor && (metodos === undefined || metodos.includes("codigo"));
  const ofreceCodigo = ofreceTotp || ofreceRecuperacion;
  // Vacía, o llena de métodos que esta versión no conoce: en los dos casos no
  // hay nada que pintar, y `describeMetodos` da la frase de cada uno.
  const sinMetodos = pideFactor && metodos !== undefined && !servidorOfreceLlave && !ofreceCodigo;
  const llaveSinNavegador = servidorOfreceLlave && !soportaPasskeys() && !ofreceCodigo;
  // Un campo, dos etiquetas: con TOTP se llama como siempre y admite además un
  // código de recuperación; sin TOTP —un secreto que este servidor no puede
  // leer, y códigos sin gastar— lo único que cabe es el código de recuperación,
  // y llamarlo «de tu aplicación» manda a la persona a la aplicación equivocada.
  const etiquetaCodigo = ofreceTotp ? "Código de tu aplicación" : "Código de recuperación";

  const usarLlave = async () => {
    setProbandoLlave(true);
    setErrorLlave(null);
    setError(null);
    try {
      // Lo primero después del clic, sin nada en medio: Safari exige activación
      // reciente para el diálogo del sistema, y caduca en segundos.
      const resultado = await probarPasskey();
      if (resultado.ok) {
        setFactorProbado(true);
        // Ni se manda ni se canjea: el factor ya está probado, y canjear un
        // código vacío cargaría un intento contra el bloqueo de la cuenta.
        setCodigo("");
        // El aviso de intentos hablaba de una contraseña anterior; con el
        // factor probado por la llave ya no describe nada que vaya a pasar.
        setRestantes(undefined);
        await refrescarSesion();
      } else if (!resultado.cancelado) {
        // Un 429 del cupo de ceremonias llega aquí con su frase y sin `code`.
        // Se enseña tal cual, y «Cancelar» sigue disponible: es la única
        // salida cuando la llave es el único método.
        setErrorLlave(resultado.message);
      }
      // Canceló el diálogo del sistema: silencio. La ventana sigue abierta y
      // el botón vuelve a estar disponible.
    } finally {
      setProbandoLlave(false);
    }
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (pideFactor && !factorProbado) {
        /**
         * 🔴 Dos puertas distintas, y elegir mal carga un intento fallido
         * contra el bloqueo de la cuenta con el código correcto tecleado.
         *
         * `/auth/stepup` sólo atiende sesiones ya completas: filtra por ese
         * estado, así que una sesión a medias no recibe un error útil, recibe
         * un fallo cargado. `/auth/mfa/verify` es la que levanta una sesión a
         * medias, y `onboarding` la alcanza igual que `parcial` — su lista de
         * puertas permitidas hereda de aquélla.
         *
         * La llave no pasa por aquí: `/webauthn/login/verify` sirve igual en
         * los tres estados, y ya se canjeó al pulsar el botón.
         */
        const completa = estadoRef.current === "completa";
        const res = completa
          ? await probarStepUp(codigo)
          : await verifySecondFactor(codigo);
        if (res.status !== 200) {
          setError(res.message ?? "No se pudo confirmar tu identidad.");
          // Éste sí es el del bloqueo de la cuenta: lo cuenta el canje del
          // código, no la puerta.
          const quedan = (res as { intentosRestantes?: number }).intentosRestantes;
          if (typeof quedan === "number") setRestantes({ n: quedan, de: "cuenta" });
          return;
        }
        await refrescarSesion();
      }
      cerrar(pidePassword ? { password } : {});
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = () => {
    // Si el diálogo del sistema está abierto, se aborta con él: si no, se
    // queda encima de lo que venga después.
    if (probandoLlave) cancelarCeremonia();
    cerrar(null);
  };

  // Sin nada que pintar —lista vacía, o llave en un navegador que no puede—
  // `factorCubierto` ya es falso: no hay campo ni botón que lo cubra.
  const factorCubierto = !pideFactor || factorProbado || (ofreceCodigo && codigo.trim() !== "");
  const puedeConfirmar = factorCubierto && (!pidePassword || password !== "");

  const descripcion = pideFactor
    ? (describeMetodos(metodos) ?? describeStepUpError(motivo, pendiente.peticion.mensaje))
    : describeStepUpError(motivo, pendiente.peticion.mensaje);

  return (
    <AlertDialog open>
      {/* Sin `onOpenChange` y tragándose Escape: de aquí se sale por uno de los
          dos botones, para que cancelar sea siempre una decisión y nunca un
          descuido que deje la operación a medias sin explicación. */}
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirma que eres tú</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {llaveSinNavegador && (
            <p className="text-sm text-muted-foreground">
              Tu cuenta usa una llave de acceso y este navegador no puede usarla. Entra desde un
              navegador compatible, o desde el dispositivo donde registraste la llave.
            </p>
          )}

          {ofreceLlave && (
            <div className="space-y-1.5">
              {factorProbado ? (
                <p className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                  <ShieldCheckIcon className="h-4 w-4" aria-hidden />
                  Llave comprobada.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void usarLlave()}
                  disabled={probandoLlave}
                  aria-busy={probandoLlave}
                >
                  {probandoLlave ? (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <KeyRoundIcon className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Usar mi llave de acceso
                </Button>
              )}
              {errorLlave && <p className="text-sm text-destructive">{errorLlave}</p>}
            </div>
          )}

          {ofreceCodigo && !factorProbado && (
            <div className="space-y-1.5">
              <Label htmlFor="stepup-codigo">{etiquetaCodigo}</Label>
              <Input
                id="stepup-codigo"
                autoFocus={!ofreceLlave}
                inputMode={ofreceTotp ? "numeric" : "text"}
                autoComplete={ofreceTotp ? "one-time-code" : "off"}
                placeholder={ofreceTotp ? "123456" : undefined}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              {ofreceTotp && ofreceRecuperacion && (
                <p className="text-xs text-muted-foreground">
                  También sirve uno de tus códigos de recuperación.
                </p>
              )}
            </div>
          )}

          {pidePassword && !sinMetodos && !llaveSinNavegador && (
            <div className="space-y-1.5">
              <Label htmlFor="stepup-password">Tu contraseña</Label>
              <Input
                id="stepup-password"
                type="password"
                autoFocus={!pideFactor}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* 🔴 El aviso que evita que alguien se quede fuera del ERP sin haber
              leído nada. Cinco fallos bloquean la cuenta —1, 2, 4, 8, hasta 15
              minutos— y el mensaje de error es idéntico al de un código
              simplemente mal escrito. Basta con que el reloj del móvil vaya
              desfasado. */}
          {restantes && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              {restantes.n === 0
                ? restantes.de === "cuenta"
                  ? "Tu cuenta ha quedado bloqueada temporalmente. Espera unos minutos o pide a un administrador que la desbloquee."
                  : "Has agotado los intentos por ahora. Espera unos minutos antes de volver a probar; tu cuenta no está bloqueada."
                : `Te ${restantes.n === 1 ? "queda 1 intento" : `quedan ${restantes.n} intentos`} ${
                    restantes.de === "cuenta"
                      ? "antes de que la cuenta se bloquee."
                      : "antes de tener que esperar unos minutos."
                  }`}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          {/* Nunca deshabilitado mientras el diálogo del sistema está abierto:
              es la única salida cuando la llave es el único método. */}
          <AlertDialogCancel onClick={cancelar} disabled={enviando}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // `AlertDialogAction` cierra el diálogo al pulsarlo. Aquí no
              // puede: un código erróneo tiene que dejar la ventana abierta
              // con el error a la vista, o la persona pierde lo tecleado y no
              // se entera de por qué falló.
              e.preventDefault();
              void confirmar();
            }}
            // Y no mientras el diálogo del sistema está abierto: confirmar con
            // un código tecleado dejaría esa ceremonia huérfana, resolviendo
            // sobre una ventana que ya no existe.
            disabled={!puedeConfirmar || enviando || probandoLlave}
          >
            {enviando && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StepUpDialog;
