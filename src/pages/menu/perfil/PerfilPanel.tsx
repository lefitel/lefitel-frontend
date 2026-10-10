import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangleIcon, CheckIcon, MinusIcon } from "lucide-react";
import type { BitacoraInterface, UsuarioInterface } from "../../../interfaces/interfaces";

/** At or under this many unspent codes the panel says so — the same threshold
 *  `RecoveryCodesSection` turns its badge amber at. */
const CODIGOS_POCOS = 2;

interface Props {
  usuario: UsuarioInterface | null;
  bitacora: BitacoraInterface[];
  /** `null` when the request for them failed: the panel prints a dash, not a zero. */
  eventos: number | null;
  emailVerificado: boolean;
  /** How many passkeys the account has; `null` while that is not known. */
  llaves: number | null;
  /** How many recovery codes are unspent; `null` while that is not known. */
  codigos: number | null;
  loading: boolean;
  /** Opens the "generate ten new codes" confirmation that lives in the access card. */
  onGenerarCodigos: () => void;
}

type Estado = "hecho" | "falta" | "opcional";

/** `ago 2025`, or a dash. */
function mesAño(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

/**
 * The most recent `LOGIN` line, which is this account's last sign-in.
 *
 * Taken from the bitácora rather than from the session list because the
 * bitácora records the act and the session records the object: a session row's
 * `last_used_at` moves every time any request is made, so it answers "when was
 * this device last active", not "when did I last log in". They are different
 * questions and the panel is asking the second one.
 */
function ultimoAcceso(bitacora: BitacoraInterface[]): string {
  const linea = bitacora.find((b) => b.action === "LOGIN");
  if (!linea?.createdAt) return "—";
  const d = new Date(linea.createdAt);
  if (Number.isNaN(d.getTime())) return "—";

  const hoy = new Date();
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();

  return mismoDia
    ? `Hoy, ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function Marca({ estado }: { estado: Estado }) {
  return (
    <span
      className={`h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0 ${
        estado === "hecho" ? "bg-green-500/10 text-green-600"
        : estado === "falta" ? "bg-amber-500/10 text-amber-600"
        : "bg-muted text-muted-foreground"
      }`}
    >
      {estado === "hecho" ? <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
        : estado === "falta" ? <AlertTriangleIcon className="h-2.5 w-2.5" />
        : <MinusIcon className="h-2.5 w-2.5" />}
    </span>
  );
}

/**
 * The right-hand column: whether this account is protected, and what it is.
 *
 * **Only what protects the account.** It used to be a ring of four arcs —
 * photo, telephone, date of birth, verified address — which weighed a missing
 * birthday the same as a missing way back into the account, flagged optional
 * things with a warning triangle and no way to act on it, and said nothing
 * about passkeys or recovery codes. Isaias chose this shape from a mock-up on
 * 2026-10-10: three lines about security, one sentence on top that says
 * whether something is missing, a button on what can be fixed from here.
 * Photo, telephone and birthday are edited in their own card and are nobody's
 * warning.
 *
 * **It never raises a second alarm about the address.** The banner above the
 * two columns is the one place that says "verify your address" and carries the
 * button; here the same fact is a line of state.
 *
 * **What "segundo paso" can and cannot know.** A passkey or a verified address
 * each makes a password login ask for a second step, and both are known here.
 * Whether an authenticator app is registered is not — the server has no read
 * that says so to a full session — so an account whose only factor is the app
 * reads "opcional" on that line. Its recovery codes, which only an account
 * with a factor can hold, still show.
 */
export default function PerfilPanel({
  usuario, bitacora, eventos, emailVerificado, llaves, codigos, loading, onGenerarCodigos,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="shadow-sm border-muted/60">
            <CardContent className="p-5 space-y-3">
              {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-4 w-full" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const conLlave = (llaves ?? 0) > 0;
  const segundoPaso: { estado: Estado; detalle: string } = conLlave
    ? { estado: "hecho", detalle: llaves === 1 ? "1 llave de acceso" : `${llaves} llaves de acceso` }
    : emailVerificado
      ? { estado: "hecho", detalle: "Código por correo" }
      : { estado: "opcional", detalle: "Opcional. Lo activa una llave o un correo verificado." };

  // Codes are the way back in for an account that has a factor. Shown once the
  // count is known, and only where it means something: an account with nothing
  // to fall back from and no codes has nothing missing.
  const mostrarCodigos = codigos !== null && (conLlave || emailVerificado || codigos > 0);
  const codigosPocos = mostrarCodigos && codigos <= CODIGOS_POCOS;

  const veredicto: { estado: Estado; frase: string } = !emailVerificado
    ? { estado: "falta", frase: "Falta verificar tu correo" }
    : mostrarCodigos && codigos === 0
      ? { estado: "falta", frase: "No tienes códigos de recuperación" }
      : codigosPocos
        ? { estado: "falta", frase: "Te quedan pocos códigos" }
        : { estado: "hecho", frase: "Tu cuenta está protegida" };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-muted/60">
        <CardContent className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Seguridad de tu cuenta
          </h2>

          <p
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-4 text-sm font-medium m-0 ${
              veredicto.estado === "hecho"
                ? "bg-green-500/10 text-green-700 dark:text-green-500"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-500"
            }`}
          >
            <Marca estado={veredicto.estado} />
            {veredicto.frase}
          </p>

          <ul className="m-0 p-0 list-none space-y-3">
            <li className="flex items-center gap-2.5 text-sm">
              <Marca estado={emailVerificado ? "hecho" : "falta"} />
              <span className={emailVerificado ? "text-muted-foreground" : "font-medium"}>
                Correo verificado
              </span>
            </li>

            <li className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5"><Marca estado={segundoPaso.estado} /></span>
              <span className="min-w-0 text-muted-foreground">
                Segundo paso al entrar
                <span className="block text-xs">{segundoPaso.detalle}</span>
              </span>
            </li>

            {mostrarCodigos && (
              <li className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5"><Marca estado={codigosPocos ? "falta" : "hecho"} /></span>
                <span className={`min-w-0 ${codigosPocos ? "font-medium" : "text-muted-foreground"}`}>
                  Códigos de recuperación
                  <span className="block text-xs font-normal text-muted-foreground">
                    {codigos === 0 ? "Ninguno sin usar" : codigosPocos ? `Quedan ${codigos} de 10` : `${codigos} de 10 sin usar`}
                  </span>
                </span>
                {codigosPocos && (
                  <button
                    type="button"
                    onClick={onGenerarCodigos}
                    aria-label="Generar códigos de recuperación desde el resumen"
                    className="ml-auto text-xs font-medium text-primary hover:underline
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Generar
                  </button>
                )}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60">
        <CardContent className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            La cuenta
          </h2>
          {/* No "Rol": the header right above already carries it as a badge. */}
          <dl className="m-0 space-y-3">
            <Dato label="Miembro desde" valor={mesAño(usuario?.createdAt)} />
            <Dato label="Último acceso" valor={ultimoAcceso(bitacora)} />
            <Dato label="Eventos atendidos" valor={eventos === null ? "—" : String(eventos)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground m-0">{label}</dt>
      <dd className="font-medium m-0 text-right tabular-nums">{valor}</dd>
    </div>
  );
}
