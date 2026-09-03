import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import type { BitacoraInterface, UsuarioInterface } from "../../../interfaces/interfaces";

/**
 * One thing the account either has or does not.
 *
 * `critico` is what separates a photo from a recovery address. Both are
 * "missing"; only one of them means you never get back into this account.
 */
interface Casilla {
  label: string;
  hecho: boolean;
  critico?: boolean;
  onArreglar?: () => void;
  /** One line under a done item, for the item whose being done changes how you log in. */
  nota?: string;
}

interface Props {
  usuario: UsuarioInterface | null;
  bitacora: BitacoraInterface[];
  eventos: number;
  emailVerificado: boolean;
  loading: boolean;
  /** Opens the recovery-address editor from the pending checklist item. */
  onConfigurarCorreo: () => void;
}

const R = 40;
const CIRCUNFERENCIA = 2 * Math.PI * R;
const CUARTO = CIRCUNFERENCIA / 4;
/**
 * Arc length per segment, shorter than a true quarter on purpose.
 *
 * `strokeLinecap="round"` adds half a stroke width to each end, so a segment
 * drawn at the full quarter would grow by a whole stroke width and the four
 * would touch. 48 plus the two caps lands just under the quarter and leaves a
 * gap you can see at 88 pixels.
 */
const ARCO = 48;

/**
 * A ring of four arcs, one per checklist item, instead of one percentage.
 *
 * **Why not a percentage.** The four things are not worth the same. A missing
 * photo is nothing; a missing verified address means there is no way back into
 * the account if the password goes. Both move a percentage by twenty-five
 * points, so "75%" is a number that cannot tell you which of the two you are
 * looking at — and the whole reason to put a ring here was to be read at a
 * glance. Four arcs put the missing one in a place on the ring, in amber, and
 * the checklist right below says which it is.
 *
 * The centre reads a count rather than a percentage for the same reason: four
 * items produce four possible values, and dressing them up as 0/25/50/75/100
 * claims a precision that is not there.
 */
function Anillo({ casillas }: { casillas: Casilla[] }) {
  const hechas = casillas.filter((c) => c.hecho).length;
  const completo = hechas === casillas.length;

  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-[88px] w-[88px]" aria-hidden="true">
        {casillas.map((c, i) => (
          <circle
            key={c.label}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${ARCO} ${CIRCUNFERENCIA - ARCO}`}
            transform={`rotate(${-90 + i * 90 + (CUARTO - ARCO) / 2} 50 50)`}
            className={
              c.hecho ? "text-green-600"
              : c.critico ? "text-amber-600"
              : "text-border"
            }
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-semibold tracking-tight tabular-nums">
          {hechas}/{casillas.length}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {completo ? "al día" : "completado"}
        </span>
      </div>
    </div>
  );
}

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

/**
 * The right-hand column: what is missing from this account, and what it is.
 *
 * Everything here is context for the forms on the left, never a duplicate of
 * them. The one control is the pending checklist item, which opens the editor
 * that would tick it — a shortcut to the same page is not a shortcut, so the
 * three "quick actions" this panel was going to carry are gone: closing a
 * session is a section below, logging out is in the sidebar already, and the
 * activity is a section too.
 */
export default function PerfilPanel({
  usuario, bitacora, eventos, emailVerificado, loading, onConfigurarCorreo,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="shadow-sm border-muted/60">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-[88px] w-[88px] rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted/60">
          <CardContent className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  const casillas: Casilla[] = [
    { label: "Foto de perfil", hecho: Boolean(usuario?.image) },
    { label: "Teléfono", hecho: Boolean(usuario?.phone) },
    { label: "Fecha de nacimiento", hecho: Boolean(usuario?.birthday) },
    {
      label: "Correo verificado",
      hecho: emailVerificado,
      critico: true,
      onArreglar: onConfigurarCorreo,
      // Plan 4E: a verified address is a full second factor, on par with the
      // app and the key — said here, where the item turns green.
      nota: "Es también tu segundo factor: puedes entrar con un código enviado ahí. Guarda códigos de recuperación por si pierdes el acceso al correo.",
    },
  ];

  const pendienteCritica = casillas.find((c) => !c.hecho && c.critico);
  const pendientes = casillas.filter((c) => !c.hecho).length;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-muted/60">
        <CardContent className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Estado de tu cuenta
          </h2>

          <div className="flex items-center gap-4 mb-5">
            <Anillo casillas={casillas} />
            <div className="min-w-0">
              <p className="text-sm font-medium m-0">
                {pendienteCritica ? "Falta lo importante." : pendientes > 0 ? "Casi listo." : "Todo configurado."}
              </p>
              <p className="text-xs text-muted-foreground mt-1 m-0">
                {pendienteCritica
                  ? "Sin correo verificado no puedes volver a entrar si olvidas la contraseña."
                  : pendientes > 0
                    ? "Lo que queda es opcional."
                    : "Tu cuenta se puede recuperar si pierdes la contraseña."}
              </p>
            </div>
          </div>

          <ul className="m-0 p-0 list-none space-y-2.5">
            {casillas.map((c) => (
              <li key={c.label} className="text-sm">
                <div className="flex items-center gap-2.5">
                <span
                  className={`h-[18px] w-[18px] rounded-full flex items-center justify-center shrink-0 ${
                    c.hecho ? "bg-green-500/10 text-green-600"
                    : c.critico ? "bg-amber-500/10 text-amber-600"
                    : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.hecho
                    ? <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                    : <AlertTriangleIcon className="h-2.5 w-2.5" />}
                </span>

                <span className={c.hecho ? "text-muted-foreground" : "font-medium"}>{c.label}</span>

                {!c.hecho && c.onArreglar && (
                  <button
                    type="button"
                    onClick={c.onArreglar}
                    className="ml-auto text-xs font-medium text-primary hover:underline
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Configurar
                  </button>
                )}
                </div>
                {c.hecho && c.nota && (
                  <p className="m-0 mt-1 pl-7 text-xs text-muted-foreground">{c.nota}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-muted/60">
        <CardContent className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            La cuenta
          </h2>
          <dl className="m-0 space-y-3">
            <Dato label="Rol" valor={usuario?.rol?.name ?? "—"} />
            <Dato label="Miembro desde" valor={mesAño(usuario?.createdAt)} />
            <Dato label="Último acceso" valor={ultimoAcceso(bitacora)} />
            <Dato label="Eventos atendidos" valor={String(eventos)} />
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
      <dd className="font-medium m-0 text-right">{valor}</dd>
    </div>
  );
}
