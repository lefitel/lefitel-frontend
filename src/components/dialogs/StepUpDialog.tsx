// La ventana que pide la identidad, una sola para toda la aplicación.
//
// El servidor exige una prueba fresca antes de diecinueve operaciones
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
  describeStepUpError,
} from "@/api/stepUp";
import { probarStepUp } from "@/api/Mfa.api";
import { verifySecondFactor } from "@/api/Login.api";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";

interface Pendiente {
  peticion: PeticionStepUp;
  resolver: (r: ResultadoStepUp | null) => void;
}

export const StepUpDialog = () => {
  const { sesion } = useContext(SesionContext);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
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
   * hay que recoger la pantalla.
   */
  useEffect(() => {
    const señal = pendiente?.peticion.signal;
    if (!señal) return;
    if (señal.aborted) {
      setPendiente(null);
      return;
    }
    const alAbortar = () => {
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

  if (!pendiente) return null;

  const { motivo, exigeContrasena } = pendiente.peticion;
  const pideCodigo = motivo === MOTIVO_SIN_FACTOR_RECIENTE;
  // La contraseña se pide siempre que el motivo la nombre, y además cuando el
  // servidor avisó de que vendrá después del factor. Ese aviso es lo único que
  // permite pedir las dos cosas de una vez, en vez de encadenar dos ventanas
  // justo en las operaciones más delicadas.
  const pidePassword = !pideCodigo || exigeContrasena;

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (pideCodigo) {
        /**
         * 🔴 Dos puertas distintas, y elegir mal carga un intento fallido
         * contra el bloqueo de la cuenta con el código correcto tecleado.
         *
         * `/auth/stepup` sólo atiende sesiones ya completas: filtra por ese
         * estado, así que una sesión a medias no recibe un error útil, recibe
         * un fallo cargado. `/auth/mfa/verify` es la que levanta una sesión a
         * medias, y `onboarding` la alcanza igual que `parcial` — su lista de
         * puertas permitidas hereda de aquélla.
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
      }
      cerrar(pidePassword ? { password } : {});
    } finally {
      setEnviando(false);
    }
  };

  const puedeConfirmar =
    (!pideCodigo || codigo.trim() !== "") && (!pidePassword || password !== "");

  return (
    <AlertDialog open>
      {/* Sin `onOpenChange` y tragándose Escape: de aquí se sale por uno de los
          dos botones, para que cancelar sea siempre una decisión y nunca un
          descuido que deje la operación a medias sin explicación. */}
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirma que eres tú</AlertDialogTitle>
          <AlertDialogDescription>
            {describeStepUpError(motivo, pendiente.peticion.mensaje)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {pideCodigo && (
            <div className="space-y-1.5">
              <Label htmlFor="stepup-codigo">Código de tu aplicación</Label>
              <Input
                id="stepup-codigo"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                También sirve uno de tus códigos de recuperación.
              </p>
            </div>
          )}

          {pidePassword && (
            <div className="space-y-1.5">
              <Label htmlFor="stepup-password">Tu contraseña</Label>
              <Input
                id="stepup-password"
                type="password"
                autoFocus={!pideCodigo}
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
          <AlertDialogCancel onClick={() => cerrar(null)} disabled={enviando}>
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
            disabled={!puedeConfirmar || enviando}
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
