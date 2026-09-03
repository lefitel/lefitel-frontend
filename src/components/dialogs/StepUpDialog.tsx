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
// **Cuatro caminos para cubrir el factor**: el código de la aplicación, un
// código de recuperación, la llave de acceso (plan 4C) y, desde el plan 4E, un
// código enviado al correo verificado. Cuál se dibuja lo dice el servidor en
// `metodos`; sin ese campo —un servidor anterior— se dibuja lo de siempre. El
// correo y la aplicación son los dos seis cifras, así que cuando el servidor
// ofrece ambos aparece un selector de clase, y el código del correo viaja con
// `metodo: "correo"` — sin él, el servidor lo probaría contra la aplicación,
// lo daría por erróneo y cargaría el bloqueo de la cuenta.

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
  type MetodoSegundoFactor,
} from "@/api/stepUp";
import { pedirCodigoPorCorreo, probarStepUp } from "@/api/Mfa.api";
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
import { KeyRoundIcon, Loader2Icon, MailIcon, ShieldCheckIcon } from "lucide-react";

interface Pendiente {
  peticion: PeticionStepUp;
  resolver: (r: ResultadoStepUp | null) => void;
}

/** Las clases de código que se teclean, y cómo se llaman en el selector. */
type ClaseCodigo = "totp" | "correo" | "codigo";
const NOMBRE_DE_CLASE: Record<ClaseCodigo, string> = {
  totp: "Aplicación",
  correo: "Correo",
  codigo: "Recuperación",
};

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
   * La clase de código elegida cuando el servidor ofrece más de una que se
   * teclea igual (plan 4E), y lo del correo: a dónde fue, cuánto falta para
   * poder pedir otro, si hay uno en vuelo y qué dijo el servidor si no salió.
   * `null` en `clase` es «la primera que se ofrezca».
   */
  const [clase, setClase] = useState<ClaseCodigo | null>(null);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [pidiendoCodigo, setPidiendoCodigo] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
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

  // Un tic por segundo mientras corre la espera del correo; el número lo puso
  // el servidor y aquí sólo se descuenta.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  useEffect(() => {
    registrarResolvedorStepUp(
      (peticion) =>
        new Promise<ResultadoStepUp | null>((resolve) => {
          setCodigo("");
          setPassword("");
          setError(null);
          setFactorProbado(false);
          setErrorLlave(null);
          setClase(null);
          setEnviadoA(null);
          setEspera(0);
          setErrorCorreo(null);
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
  // Plan 4E: sólo si el servidor lo lista. Sin `metodos` (servidor anterior)
  // no hay correo que ofrecer, porque ese servidor no sabe canjearlo.
  const ofreceCorreo = pideFactor && metodos !== undefined && metodos.includes("correo");
  const ofreceCodigo = ofreceTotp || ofreceRecuperacion || ofreceCorreo;
  // Vacía, o llena de métodos que esta versión no conoce: en los dos casos no
  // hay nada que pintar, y `describeMetodos` da la frase de cada uno.
  const sinMetodos = pideFactor && metodos !== undefined && !servidorOfreceLlave && !ofreceCodigo;
  const llaveSinNavegador = servidorOfreceLlave && !soportaPasskeys() && !ofreceCodigo;
  // Un campo, dos etiquetas: con TOTP se llama como siempre y admite además un
  // código de recuperación; sin TOTP —un secreto que este servidor no puede
  // leer, y códigos sin gastar— lo único que cabe es el código de recuperación,
  // y llamarlo «de tu aplicación» manda a la persona a la aplicación equivocada.
  /**
   * Las clases de código que se pueden teclear, en el orden en que se
   * ofrecen. La aplicación y la recuperación comparten campo como siempre —el
   * servidor las distingue por la forma—, así que «recuperación» sólo es una
   * clase propia cuando no hay aplicación. El correo son seis cifras como la
   * aplicación, y por eso es una clase aparte que viaja con `metodo`.
   */
  const clases: ClaseCodigo[] = [
    ...(ofreceTotp ? (["totp"] as const) : []),
    ...(ofreceCorreo ? (["correo"] as const) : []),
    ...(!ofreceTotp && ofreceRecuperacion ? (["codigo"] as const) : []),
  ];
  const claseActiva: ClaseCodigo | null =
    clase !== null && clases.includes(clase) ? clase : (clases[0] ?? null);
  const etiquetaCodigo =
    claseActiva === "correo"
      ? "Código recibido por correo"
      : claseActiva === "totp"
        ? "Código de tu aplicación"
        : "Código de recuperación";

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

  /**
   * Pedir el código al correo. Sólo desde el botón (S4): cada envío gasta
   * cuota, y la ventana se abre también por una operación que luego se
   * cancela. El 200 trae la dirección enmascarada y el cooldown; el 429, los
   * segundos que faltan, que son los que cuenta el botón; el 503, que ningún
   * proveedor pudo enviarlo — el código anterior, si lo hay, sigue vivo.
   */
  const pedirCodigo = async () => {
    setPidiendoCodigo(true);
    setErrorCorreo(null);
    try {
      const r = await pedirCodigoPorCorreo();
      if (r.status === 200) {
        setEnviadoA(r.enviado_a);
        setEspera(r.reintento_en_s ?? 0);
        return;
      }
      if (r.status === 429 && r.reintento_en_s) setEspera(r.reintento_en_s);
      setErrorCorreo(r.message ?? "No se pudo enviar el código.");
    } finally {
      setPidiendoCodigo(false);
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
        // Sólo el correo nombra su puerta: la aplicación y la recuperación se
        // distinguen por la forma, como siempre, y así un servidor anterior
        // sigue entendiendo lo que se le manda.
        const metodo: MetodoSegundoFactor | undefined = claseActiva === "correo" ? "correo" : undefined;
        const res = completa
          ? await probarStepUp(codigo, metodo)
          : await verifySecondFactor(codigo, undefined, metodo);
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
            <div className="space-y-2">
              {/* El selector, sólo cuando hay dos clases que se teclean igual:
                  hoy, siempre que el correo acompaña a otra. */}
              {clases.length >= 2 && (
                <div role="radiogroup" aria-label="Con qué código" className="flex gap-1.5">
                  {clases.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={c === claseActiva}
                      size="sm"
                      variant={c === claseActiva ? "default" : "outline"}
                      onClick={() => {
                        setClase(c);
                        setCodigo("");
                        setError(null);
                      }}
                    >
                      {NOMBRE_DE_CLASE[c]}
                    </Button>
                  ))}
                </div>
              )}

              {claseActiva === "correo" && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {enviadoA ? (
                      <>
                        Enviamos un código de seis cifras a <span className="font-mono">{enviadoA}</span>. Vale
                        diez minutos.
                      </>
                    ) : (
                      "Te enviaremos un código de seis cifras a tu correo verificado. Vale diez minutos."
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => void pedirCodigo()}
                    disabled={pidiendoCodigo || espera > 0}
                    aria-busy={pidiendoCodigo}
                  >
                    {pidiendoCodigo ? (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <MailIcon className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {espera > 0 ? `Reenviar en ${espera} s` : enviadoA ? "Reenviar código" : "Enviar código"}
                  </Button>
                  {errorCorreo && <p className="text-sm text-destructive">{errorCorreo}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="stepup-codigo">{etiquetaCodigo}</Label>
                <Input
                  id="stepup-codigo"
                  autoFocus={!ofreceLlave}
                  inputMode={claseActiva === "codigo" ? "text" : "numeric"}
                  autoComplete={claseActiva === "codigo" ? "off" : "one-time-code"}
                  placeholder={claseActiva === "codigo" ? undefined : "123456"}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
                {claseActiva === "totp" && ofreceRecuperacion && (
                  <p className="text-xs text-muted-foreground">
                    También sirve uno de tus códigos de recuperación.
                  </p>
                )}
              </div>
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
