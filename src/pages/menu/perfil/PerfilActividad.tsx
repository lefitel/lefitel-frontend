import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityIcon } from "lucide-react";
import { accionVisual } from "../../../lib/bitacoraAcciones";
import type { BitacoraInterface } from "../../../interfaces/interfaces";

/** How many lines to show. The hook asks for more; the rest feed "último acceso". */
const VISIBLES = 8;

interface Props {
  bitacora: BitacoraInterface[];
}

/**
 * "Hoy, 11:20" for today, "ayer, 18:04" for yesterday, "21 ago" beyond that.
 *
 * Scanning your own history, the time of day is what identifies a line while it
 * is recent and stops mattering within a couple of days, at which point the date
 * is the only useful part. One format for both is worse than two.
 */
function cuando(iso: Date | string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const hoy = new Date();
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (mismoDia(d, hoy)) return `Hoy, ${hora}`;

  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, ayer)) return `Ayer, ${hora}`;

  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * The last few things this account did, from its own bitácora.
 *
 * **Why it lives on this page at all.** It was going to be a link — "ver mi
 * actividad" — pointing at `/app/usuarios/:id`, the admin screen that already
 * renders this. That route is behind the Seguridad module, which most accounts
 * do not have, so the link would have been dead for exactly the people who
 * cannot see their history any other way. The list is cheaper than the link
 * and works for everyone: `GET /usuario/:id/bitacora` is behind
 * `requireSelfOrPermission`, so asking about yourself always passes.
 *
 * **No links out of the rows,** unlike `UsuarioDetallePage`'s version, for the
 * same reason: "Evento #41" would navigate to a route behind the Eventos
 * module. A técnico reading "resolviste un evento" does not need a link to be
 * told what they did.
 *
 * Renders nothing on an empty list. Anybody reading this page logged in to get
 * here, so their bitácora has at least that line; empty means the request
 * failed, and an empty state that says "sin actividad" would be a lie.
 */
export default function PerfilActividad({ bitacora }: Props) {
  if (bitacora.length === 0) return null;

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          Tu actividad reciente
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Últimas {Math.min(VISIBLES, bitacora.length)} acciones
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-2">
        <ul className="m-0 p-0 list-none">
          {bitacora.slice(0, VISIBLES).map((entry, i) => {
            const { Icon, color, bg } = accionVisual(entry);
            return (
              <li key={entry.id ?? i} className="flex items-start gap-3 py-2.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <p className="text-sm flex-1 min-w-0 m-0">{entry.detail}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums pt-1">
                  {cuando(entry.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
