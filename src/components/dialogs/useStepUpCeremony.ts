// La máquina de estados de la ceremonia de identidad: qué pide el servidor,
// qué ha tecleado o probado la persona, y con qué se resuelve la promesa que
// el interceptor está esperando. `StepUpDialog.tsx` sólo dibuja lo que este
// hook decide.
//
// **Cuatro caminos para cubrir el factor**: el código de la aplicación, un
// código de recuperación, la llave de acceso (plan 4C) y, desde el plan 4E, un
// código enviado al correo verificado. Cuál se ofrece lo dice el servidor en
// `metodos`; sin ese campo —un servidor anterior— se ofrece lo de siempre. El
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
  TIMEOUT_CONFIRMACION_MS,
  describeMetodos,
  describeStepUpError,
  type MetodoSegundoFactor,
} from "@/api/stepUp";
import { pedirCodigoPorCorreo, probarStepUp } from "@/api/Mfa.api";
import { comprobarToken, verifySecondFactor } from "@/api/Login.api";
import { cancelarCeremonia, probarPasskey, soportaPasskeys } from "@/api/passkeyCeremony";

interface Pendiente {
  peticion: PeticionStepUp;
  resolver: (r: ResultadoStepUp | null) => void;
}

/** Las clases de código que se teclean, y cómo se llaman en el selector. */
export type ClaseCodigo = "totp" | "correo" | "codigo";
export const NOMBRE_DE_CLASE: Record<ClaseCodigo, string> = {
  totp: "Aplicación",
  correo: "Correo",
  codigo: "Recuperación",
};

/**
 * La misma frase para los dos caminos que pueden acabar esperando a
 * `refrescarSesion` — el código en `confirmar` y la llave en `usarLlave` —
 * para que no diverjan con el tiempo en dos sitios que dicen lo mismo.
 */
const AVISO_REFRESCO_A_TIEMPO =
  "No se pudo confirmar a tiempo. Cancela, o inténtalo de nuevo cuando tengas mejor conexión.";

/** Qué tiene que dibujar la ventana, ya decidido. */
export interface FormularioStepUp {
  /** El motivo es que falta un factor reciente, no una contraseña. */
  pideFactor: boolean;
  pidePassword: boolean;
  ofreceLlave: boolean;
  ofreceCodigo: boolean;
  ofreceRecuperacion: boolean;
  /** El servidor dijo que la cuenta no puede probarse con nada ahora mismo. */
  sinMetodos: boolean;
  /** La llave es lo único ofrecido y este navegador no puede usarla. */
  llaveSinNavegador: boolean;
  /** Sólo de lectura: `SIN_FORMULARIO` reparte siempre la misma lista vacía. */
  clases: readonly ClaseCodigo[];
  claseActiva: ClaseCodigo | null;
  etiquetaCodigo: string;
  /** La frase que explica qué hace falta, o `null` si no hay ceremonia. */
  descripcion: string | null;
}

const SIN_FORMULARIO: FormularioStepUp = {
  pideFactor: false,
  pidePassword: false,
  ofreceLlave: false,
  ofreceCodigo: false,
  ofreceRecuperacion: false,
  sinMetodos: false,
  llaveSinNavegador: false,
  clases: [],
  claseActiva: null,
  etiquetaCodigo: "",
  descripcion: null,
};

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
 *
 * `clase` es la que eligió la persona en el selector, o `null` para «la
 * primera que se ofrezca».
 */
export function decidirFormulario(
  peticion: PeticionStepUp | null,
  clase: ClaseCodigo | null,
): FormularioStepUp {
  if (!peticion) return { ...SIN_FORMULARIO };

  const { motivo, exigeContrasena, metodos } = peticion;
  const pideFactor = motivo === MOTIVO_SIN_FACTOR_RECIENTE;
  // La contraseña se pide siempre que el motivo la nombre, y además cuando el
  // servidor avisó de que vendrá después del factor. Ese aviso es lo único que
  // permite pedir las dos cosas de una vez, en vez de encadenar dos ventanas
  // justo en las operaciones más delicadas.
  const pidePassword = !pideFactor || exigeContrasena;

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
  // Un campo, dos etiquetas: con TOTP se llama como siempre y admite además un
  // código de recuperación; sin TOTP —un secreto que este servidor no puede
  // leer, y códigos sin gastar— lo único que cabe es el código de recuperación,
  // y llamarlo «de tu aplicación» manda a la persona a la aplicación equivocada.
  const etiquetaCodigo =
    claseActiva === "correo"
      ? "Código recibido por correo"
      : claseActiva === "totp"
        ? "Código de tu aplicación"
        : "Código de recuperación";

  const descripcion = pideFactor
    ? (describeMetodos(metodos) ?? describeStepUpError(motivo, peticion.mensaje))
    : describeStepUpError(motivo, peticion.mensaje);

  return {
    pideFactor,
    pidePassword,
    ofreceLlave,
    ofreceCodigo,
    ofreceRecuperacion,
    sinMetodos,
    llaveSinNavegador,
    clases,
    claseActiva,
    etiquetaCodigo,
    descripcion,
  };
}

export const useStepUpCeremony = () => {
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
   * comerían su segundo reintento y morirían en silencio. Y caerían **todas**
   * las que esperan, no unas cuantas: el interceptor sólo mete en la misma cola
   * a las peticiones que necesitan lo mismo, así que en una ceremonia con
   * `exigeContrasena` la contraseña le hace falta a la cola entera.
   */
  const [factorProbado, setFactorProbado] = useState(false);
  const [probandoLlave, setProbandoLlave] = useState(false);
  const [errorLlave, setErrorLlave] = useState<string | null>(null);
  /**
   * Si el `refrescarSesion` que siguió a probar el factor se rindió, y la
   * ceremonia todavía no lo sabe.
   *
   * 🔴 **Existe porque `factorProbado` no distingue quién lo puso a `true`.**
   * `confirmar` sólo vuelve a llamar a `refrescarSesion` dentro de
   * `if (pideFactor && !factorProbado)` — el camino del código, que lo deja en
   * `true` recién él mismo lo pidió. Con la llave, `usarLlave` ya puso
   * `factorProbado` a `true` **antes** de llamar a `refrescarSesion`, así que
   * ese bloque se salta entero cuando la persona pulsa «Confirmar»: sin este
   * estado, un refresco que se rindió en `usarLlave` no tenía forma de
   * impedir que `confirmar` cerrara la ventana igual, dando la sesión por al
   * día sin haberlo comprobado nunca — el mismo cuelgue de la Tarea 10, sólo
   * que silencioso en vez de visible.
   */
  const [refrescoPendiente, setRefrescoPendiente] = useState(false);
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
          setRefrescoPendiente(false);
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
   *
   * 🔴 **La única llamada de la ceremonia sin límite, hasta ahora.** Mientras
   * está en vuelo «Confirmar» está deshabilitado, Escape se traga siempre, y
   * `axios` no trae ningún tiempo límite por defecto. **Qué queda vivo depende
   * de quién llame**, y no son lo mismo: desde `confirmar` cae también
   * «Cancelar» —`enviando` apaga los dos— y la ventana se queda sin ninguna
   * salida; desde `usarLlave` sólo se pone `probandoLlave`, así que «Cancelar»
   * sigue disponible a propósito, pero la ceremonia tampoco puede terminar.
   *
   * 🔴 **Dos temporizadores a propósito, y no uno.** El `timeout` que se le
   * pasa a `comprobarToken` acota la *petición* — es lo que hace que `axios`
   * la aborte de verdad y libere la conexión. La carrera de abajo acota la
   * *espera del componente*, y son dos cosas distintas: esta ceremonia no
   * puede saber si lo que espera está acotado. Hoy lo está; el día que alguien
   * reimplemente `comprobarToken` sin ese `timeout` —o cambie qué hace esta
   * función por dentro—, la ventana volvería a quedarse muerta sin que nada se
   * pusiera en rojo, porque nada aquí depende de esa promesa para soltarse. La
   * carrera es la que no depende de eso: da igual por qué no contesta, se
   * suelta sola pasado el plazo.
   *
   * Devuelve si llegó a tiempo. `confirmar` lo usa para decidir si puede dar
   * la ceremonia por terminada: cerrar la ventana sin saber si la sesión subió
   * a `completa` dejaría el mismo problema en otro sitio — «Inicio» devolviendo
   * a alguien a una pantalla que ya superó — y sin la ventana abierta para
   * volver a intentarlo.
   */
  const refrescarSesion = async (): Promise<boolean> => {
    const yo = await Promise.race([
      comprobarToken({ timeout: TIMEOUT_CONFIRMACION_MS }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_CONFIRMACION_MS)),
    ]);
    if (yo === null) return false;
    if (yo.status === 200 && yo.usuario) {
      setSesion({
        usuario: yo.usuario,
        permisos: yo.permisos,
        estado: yo.estado,
        autenticado: yo.estado !== "parcial",
      });
    }
    return true;
  };

  const peticion = pendiente?.peticion ?? null;
  const formulario = decidirFormulario(peticion, clase);
  const { pideFactor, pidePassword, ofreceCodigo, claseActiva } = formulario;

  const elegirClase = (c: ClaseCodigo) => {
    setClase(c);
    setCodigo("");
    setError(null);
  };

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
        // 🔴 Si esto se rinde, `confirmar` no lo va a volver a llamar por su
        // cuenta: su propio guardián sólo corre en `if (pideFactor &&
        // !factorProbado)`, y `factorProbado` ya está a `true` dos líneas más
        // arriba. Sin `refrescoPendiente`, «Confirmar» se habilitaría igual y
        // cerraría la ventana sin haber sabido nunca si la sesión se pudo leer.
        if (!(await refrescarSesion())) {
          setRefrescoPendiente(true);
          setError(AVISO_REFRESCO_A_TIEMPO);
        }
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
        // Si `refrescarSesion` se rindió, el código ya quedó probado en el
        // servidor pero esta pantalla no sabe en qué `estado` quedó la sesión.
        // 🔴 Cerrar igual no es neutro: `cerrar` resuelve la ceremonia y
        // `stepUpInterceptor.ts` reenvía sola la petición que abrió esta
        // ventana, sobre una red que seguimos sin saber si funciona. Si sigue
        // caída, esa persona ve fallar la pantalla de origen sin nada que la
        // conecte con lo que acaba de teclear aquí. Si vuelve pero el plazo de
        // «factor reciente» ya venció mientras esperábamos, el mismo
        // interceptor recibe el 403 de siempre y **abre esta misma ventana
        // otra vez** — a pedir de nuevo lo que la persona ya probó, sin
        // recordar el primer intento. Ninguno de los dos es una recuperación.
        // Dejarla abierta con un aviso y los botones ya sueltos por el
        // `finally` le da la decisión a la persona en vez de mandarla a
        // cualquiera de los dos sola.
        if (!(await refrescarSesion())) {
          setRefrescoPendiente(true);
          setError(AVISO_REFRESCO_A_TIEMPO);
          return;
        }
        setRefrescoPendiente(false);
      } else if (pideFactor && refrescoPendiente) {
        // El factor se probó por la llave, no por un código: `usarLlave` ya
        // llamó una vez a `refrescarSesion` y se rindió, así que el bloque de
        // arriba —que sólo corre con `!factorProbado`— no lo iba a reintentar
        // por su cuenta. Mismo razonamiento que el bloque de arriba para no
        // cerrar a ciegas: se reintenta aquí, y si vuelve a rendirse la
        // ventana sigue abierta con el mismo aviso en vez de cerrar.
        if (!(await refrescarSesion())) {
          setError(AVISO_REFRESCO_A_TIEMPO);
          return;
        }
        setRefrescoPendiente(false);
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

  return {
    ...formulario,
    /** Hay una ceremonia esperando respuesta: la ventana se dibuja. */
    abierta: peticion !== null,
    /** Lo lee la frase que promete —o no— unos minutos sin volver a pedirlo. */
    exigeContrasena: peticion?.exigeContrasena,
    codigo,
    setCodigo,
    password,
    setPassword,
    error,
    enviando,
    factorProbado,
    probandoLlave,
    errorLlave,
    enviadoA,
    espera,
    pidiendoCodigo,
    errorCorreo,
    restantes,
    puedeConfirmar,
    elegirClase,
    usarLlave,
    pedirCodigo,
    confirmar,
    cancelar,
  };
};
