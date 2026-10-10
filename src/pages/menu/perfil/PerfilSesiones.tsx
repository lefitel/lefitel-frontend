import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2Icon, MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import type { SesionActivaInterface } from "../../../interfaces/interfaces";
import { describirDispositivo, type FormaDispositivo } from "../../../lib/dispositivo";

interface Props {
  sesiones: SesionActivaInterface[];
  /** The id currently being closed, so only that row spins. */
  cerrando: string | null;
  cerrandoTodas: boolean;
  onCerrar: (s: SesionActivaInterface) => void;
  onCerrarTodas: () => void;
}

/** "activa ahora", "hace 3 horas", "hace 11 días" — as coarse as it is honest. */
function desde(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";

  const minutos = Math.floor((Date.now() - t) / 60000);
  if (minutos < 2) return "activa ahora";
  if (minutos < 60) return `hace ${minutos} minutos`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;

  return new Date(t).toLocaleDateString("es-ES");
}

function Icono({ forma }: { forma: FormaDispositivo }) {
  const cls = "h-4 w-4";
  if (forma === "movil") return <SmartphoneIcon className={cls} />;
  if (forma === "tablet") return <TabletIcon className={cls} />;
  return <MonitorIcon className={cls} />;
}

/**
 * Where this account is logged in, and how to end it.
 *
 * **This section is the reason the redesign grew.** `GET /auth/sessions`,
 * `DELETE /auth/sessions/:id` and `POST /auth/logout-all` have existed on the
 * server — written, tested, and guarded against closing somebody else's
 * sessions — while nothing in this repository ever called them. So a laptop
 * left open in an office stayed logged in and there was no screen anywhere
 * that could say so, let alone do anything about it.
 *
 * Renders nothing when the list is empty. That is not an empty state worth
 * designing: the only way to be reading this page is to have a session, so an
 * empty list means the request failed, and a card explaining that would be
 * noise on a page whose real job is elsewhere.
 */
export default function PerfilSesiones({
  sesiones, cerrando, cerrandoTodas, onCerrar, onCerrarTodas,
}: Props) {
  if (sesiones.length === 0) return null;

  // Current session first, then most recently used. Somebody scanning this list
  // is looking for the row that is *not* them, and anchoring the one that is at
  // the top is what makes the rest read as "everything else".
  const ordenadas = [...sesiones].sort((a, b) => {
    if (a.actual !== b.actual) return a.actual ? -1 : 1;
    return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
  });

  const otras = sesiones.filter((s) => !s.actual).length;

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MonitorIcon className="h-4 w-4 text-muted-foreground" />
          Sesiones activas
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {sesiones.length} {sesiones.length === 1 ? "dispositivo" : "dispositivos"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-1">
        <ul className="m-0 p-0 list-none">
          {ordenadas.map((s) => {
            const { nombre: leido, forma } = describirDispositivo(s.user_agent);
            const nombre = leido ?? "Dispositivo desconocido";
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 py-3 border-b border-border/60 last:border-b-0"
              >
                <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Icono forma={forma} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{nombre}</span>
                    {s.actual && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shadow-none font-normal text-xs">
                        Este dispositivo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {s.ip_address ?? "IP desconocida"} · {desde(s.last_used_at)}
                  </p>
                </div>

                {!s.actual && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    aria-label={`Cerrar la sesión de ${nombre}`}
                    disabled={cerrando === s.id || cerrandoTodas}
                    onClick={() => onCerrar(s)}
                  >
                    {cerrando === s.id && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                    Cerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {otras > 0 && (
          <div className="flex justify-end pt-3 pb-1 border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={cerrandoTodas}
              onClick={onCerrarTodas}
            >
              {cerrandoTodas && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
              Cerrar todas las sesiones
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
