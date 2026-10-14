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
// Aquí sólo está el dibujo. Qué se pide, qué se ha probado y con qué se
// resuelve la ceremonia lo lleva `useStepUpCeremony`.

import { describeProteccion } from "@/api/stepUp";
import { NOMBRE_DE_CLASE, useStepUpCeremony } from "./useStepUpCeremony";
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

export const StepUpDialog = () => {
  const {
    abierta,
    exigeContrasena,
    descripcion,
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
  } = useStepUpCeremony();

  if (!abierta) return null;

  return (
    <AlertDialog open>
      {/* Sin `onOpenChange` y tragándose Escape: de aquí se sale por uno de los
          dos botones, para que cancelar sea siempre una decisión y nunca un
          descuido que deje la operación a medias sin explicación. */}
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          {/*
            El título dice para qué sirve, no sólo que hace falta. El anterior
            era «Confirma que eres tú», que nombra el trámite y no el motivo:
            quien lo leía sabía que tenía que teclear algo y no por qué.
            Petición de Isaias, 2026-09-08.
          */}
          <AlertDialogTitle>Protegemos esta operación</AlertDialogTitle>
          <AlertDialogDescription>
            {descripcion}
            {" "}
            {describeProteccion(exigeContrasena)}
          </AlertDialogDescription>
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
                      onClick={() => elegirClase(c)}
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
