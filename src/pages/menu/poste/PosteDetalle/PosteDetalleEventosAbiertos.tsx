import { useMemo } from "react";
import { EventoInterface } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { CheckCircle2Icon, MoreHorizontalIcon } from "lucide-react";
import { daysOpen } from "../../inicio/helpers";

export interface EventoActionHandlers {
  onVerDetalle: (id: number) => void;
  onEditar: (id: number) => void;
  onAddRevision: (id: number) => void;
  onResolver: (evento: EventoInterface) => void;
}

interface Props {
  loading: boolean;
  eventos: EventoInterface[];
  canEditEventos: boolean;
  canCreateEventos: boolean;
  onNuevoEvento: () => void;
  actions: EventoActionHandlers;
}

export default function PosteDetalleEventosAbiertos({
  loading, eventos, canEditEventos, canCreateEventos, onNuevoEvento, actions,
}: Props) {
  const abiertos = useMemo(
    () => eventos
      .filter((e) => !e.state)
      .sort((a, b) => {
        const pa = a.priority ? 0 : 1;
        const pb = b.priority ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }),
    [eventos]
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-lg border border-border/40">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (abiertos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-3">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Sin eventos abiertos</p>
          <p className="text-sm text-muted-foreground">Este poste está operativo.</p>
        </div>
        {canCreateEventos && (
          <Button variant="outline" size="sm" onClick={onNuevoEvento} className="mt-1">
            Reportar nuevo evento
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {abiertos.map((e) => (
        <EventoCard key={e.id} evento={e} canEdit={canEditEventos} actions={actions} />
      ))}
    </ul>
  );
}

function EventoCard({
  evento, canEdit, actions,
}: {
  evento: EventoInterface;
  canEdit: boolean;
  actions: EventoActionHandlers;
}) {
  const isCritico = !!evento.priority;
  const accent = isCritico
    ? "border-red-500/30 bg-red-500/5"
    : "border-amber-500/30 bg-amber-500/5";
  const dotBg = isCritico ? "bg-red-500" : "bg-amber-500";
  const dotRing = isCritico ? "ring-red-500/20" : "ring-amber-500/20";
  const tagText = isCritico ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300";
  const tagBg = isCritico ? "bg-red-500/10" : "bg-amber-500/10";

  return (
    <li className={`group relative rounded-lg border ${accent} p-4 transition-colors hover:bg-card/50`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotBg} ring-4 ${dotRing} shrink-0 ${isCritico ? "event-marker-critical" : ""}`} />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm break-words">{evento.description}</p>
            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${tagBg} ${tagText}`}>
              {isCritico ? "Crítico" : "Pendiente"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {evento.usuario ? `${evento.usuario.name} ${evento.usuario.lastname}` : "—"}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span>hace {daysOpen(evento.date)}</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <Button
              size="sm"
              className="h-8 bg-primary/90 hover:bg-primary text-white text-xs gap-1.5"
              onClick={() => actions.onResolver(evento)}
            >
              <CheckCircle2Icon className="h-3.5 w-3.5" />
              Resolver
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => actions.onVerDetalle(evento.id as number)}
          >
            Ver
          </Button>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => actions.onEditar(evento.id as number)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onAddRevision(evento.id as number)}>
                  Agregar revisión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </li>
  );
}
